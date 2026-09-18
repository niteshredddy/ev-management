from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from .. import models
from ..db import get_db
from ..auth import get_current_user
from datetime import datetime

router = APIRouter()

@router.get("/me", response_model=models.UserSchema)
async def get_me(user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.post("/vehicles", response_model=models.VehicleSchema)
async def add_vehicle(vehicle: models.VehicleCreate, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    db_vehicle = models.Vehicle(**vehicle.model_dump(), user_id=int(user_id))
    db.add(db_vehicle)
    db.commit()
    db.refresh(db_vehicle)
    return db_vehicle

@router.get("/vehicles", response_model=List[models.VehicleSchema])
async def get_vehicles(user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(models.Vehicle).filter(models.Vehicle.user_id == int(user_id)).all()

@router.post("/book", response_model=models.BookingSchema)
async def book_slot(booking: models.BookingCreate, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    # Check if this vehicle belongs to the user
    vehicle = db.query(models.Vehicle).filter(models.Vehicle.id == booking.vehicle_id, models.Vehicle.user_id == int(user_id)).first()
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    # If it's a battery exchange, it's instant and doesn't take a charging slot over time (just a swap).
    # We allow it immediately.
    if not booking.is_battery_exchange:
        # Check active bookings to see if 5 slots are already full
        active_bookings = db.query(models.Booking).filter(models.Booking.status.in_(["BOOKED", "ACTIVE"])).count()
        if active_bookings >= 5:
            raise HTTPException(status_code=400, detail="All 5 charging points are currently occupied or booked. Please try a different time.")

    db_booking = models.Booking(
        **booking.model_dump(),
        user_id=int(user_id),
        current_charge_percent=booking.start_charge_percent,
        status="ACTIVE"
    )
    db.add(db_booking)
    db.commit()
    db.refresh(db_booking)
    return db_booking

@router.post("/book/{booking_id}/complete")
async def complete_booking(booking_id: int, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    booking = db.query(models.Booking).filter(models.Booking.id == booking_id, models.Booking.user_id == int(user_id)).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    booking.status = "COMPLETED"
    db.commit()
    return {"message": "Session completed"}

@router.get("/history", response_model=List[models.BookingSchema])
async def get_history(user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(models.Booking).filter(models.Booking.user_id == int(user_id)).order_by(models.Booking.arrival_time.desc()).all()
