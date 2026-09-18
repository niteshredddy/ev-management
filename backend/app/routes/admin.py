from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from .. import models
from ..db import get_db
from ..auth import get_current_user

router = APIRouter()

@router.get("/stats")
async def get_admin_stats(user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    # Very basic aggregation for the demo
    total_bookings = db.query(models.Booking).count()
    total_solar_savings = sum([b.solar_savings for b in db.query(models.Booking).all()])
    
    return {
        "total_bookings": total_bookings,
        "total_solar_savings": total_solar_savings,
        "active_chargers": db.query(models.Booking).filter(models.Booking.status == "ACTIVE").count()
    }

from ..simulator import simulator_instance
from pydantic import BaseModel

class ToggleRequest(BaseModel):
    enable: bool

@router.post("/simulate/cloud")
async def toggle_cloud(req: ToggleRequest):
    simulator_instance.force_cloud = req.enable
    return {"message": f"Cloud cover {'enabled' if req.enable else 'disabled'}"}

@router.post("/simulate/spike")
async def toggle_spike(req: ToggleRequest):
    simulator_instance.force_spike = req.enable
    return {"message": f"Building spike {'enabled' if req.enable else 'disabled'}"}

@router.get("/users")
async def get_all_users(user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    users = db.query(models.User).all()
    # return stripped down data suitable for admin table
    return [
        {
            "id": u.id,
            "name": u.name or "Anonymous",
            "phone_number": u.phone_number,
            "green_credits": getattr(u, "green_credits", 0),
            "vehicle_count": len(u.vehicles)
        } for u in users
    ]
