from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Float, DateTime
from sqlalchemy.orm import relationship
from .db import Base
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

# --- SQLAlchemy ORM Models (Database) ---

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    phone_number = Column(String, unique=True, index=True)
    name = Column(String)
    hashed_password = Column(String)
    role = Column(String, default="user") # 'admin' or 'user'
    green_credits = Column(Integer, default=0)
    
    vehicles = relationship("Vehicle", back_populates="owner")
    bookings = relationship("Booking", back_populates="user")

class Vehicle(Base):
    __tablename__ = "vehicles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    vehicle_type = Column(String) # 'Car', 'Bike', 'Bicycle'
    plate_number = Column(String)
    battery_capacity_kwh = Column(Float)
    max_charge_rate_kw = Column(Float)
    
    owner = relationship("User", back_populates="vehicles")
    bookings = relationship("Booking", back_populates="vehicle")

class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"))
    
    arrival_time = Column(DateTime)
    departure_time = Column(DateTime)
    is_urgent = Column(Boolean, default=False)
    start_charge_percent = Column(Float)
    current_charge_percent = Column(Float)
    
    status = Column(String, default="BOOKED") # 'BOOKED', 'ACTIVE', 'COMPLETED'
    is_battery_exchange = Column(Boolean, default=False)
    
    total_paid = Column(Float, default=0.0)
    solar_savings = Column(Float, default=0.0)
    
    user = relationship("User", back_populates="bookings")
    vehicle = relationship("Vehicle", back_populates="bookings")

# --- Pydantic Schemas (API) ---

class VehicleBase(BaseModel):
    vehicle_type: str
    plate_number: str
    battery_capacity_kwh: float
    max_charge_rate_kw: float

class VehicleCreate(VehicleBase):
    pass

class VehicleSchema(VehicleBase):
    id: int
    user_id: int
    class Config:
        from_attributes = True

class UserBase(BaseModel):
    phone_number: str
    name: str

class UserCreate(UserBase):
    password: str # For simplicity in this prototype, though real systems use OTP

class UserSchema(UserBase):
    id: int
    role: str
    green_credits: int
    vehicles: List[VehicleSchema] = []
    class Config:
        from_attributes = True

class BookingCreate(BaseModel):
    vehicle_id: int
    arrival_time: datetime
    departure_time: datetime
    is_urgent: bool
    start_charge_percent: float
    is_battery_exchange: bool = False

class BookingSchema(BaseModel):
    id: int
    user_id: int
    vehicle_id: int
    arrival_time: datetime
    departure_time: datetime
    is_urgent: bool
    start_charge_percent: float
    current_charge_percent: float
    status: str
    is_battery_exchange: bool
    total_paid: float
    solar_savings: float
    
    vehicle: Optional[VehicleSchema] = None
    
    class Config:
        from_attributes = True

# Legacy Simulator Models (kept temporarily for transition)
class VehicleState(BaseModel):
    vehicle_id: str
    battery_percent: float
    battery_capacity_kwh: float
    max_charge_rate_kw: float
    departure_time: datetime
    is_connected: bool
    current_charge_rate_kw: float = 0.0
    priority_score: float = 0.0
    is_urgent: bool = False # Added for new requirement

class GridState(BaseModel):
    total_capacity_kw: float
    building_base_load_kw: float
    solar_generation_kw: float
    current_price_per_kwh: float = 10.0
    timestamp: datetime

class SimulationStateSnapshot(BaseModel):
    grid: GridState
    vehicles: List[VehicleState]
    active_shedding: bool = False
