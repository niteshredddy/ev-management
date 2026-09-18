import pytest
from datetime import datetime, timedelta
from app.models import VehicleState, GridState
from app.optimizer import allocate

def test_allocate_respects_grid_limit():
    now = datetime.now()
    grid = GridState(
        total_capacity_kw=50.0,
        building_base_load_kw=10.0,
        solar_generation_kw=0.0,
        timestamp=now
    )
    # Available budget: 40.0 kW
    
    vehicles = [
        VehicleState(
            vehicle_id=f"EV-{i}",
            battery_percent=20.0,
            battery_capacity_kwh=50.0,
            max_charge_rate_kw=22.0,
            departure_time=now + timedelta(hours=2),
            is_connected=True
        ) for i in range(3)
    ]
    # Total requested: 66 kW (3 * 22). Budget: 40 kW.

    allocations = allocate(vehicles, grid)
    
    total_allocated = sum(allocations.values())
    assert total_allocated <= 40.0
    assert total_allocated == 40.0 # Greedy should use all available budget

def test_allocate_prioritizes_urgency():
    now = datetime.now()
    grid = GridState(
        total_capacity_kw=20.0,
        building_base_load_kw=0.0,
        solar_generation_kw=0.0,
        timestamp=now
    )
    # Budget: 20 kW

    v_urgent = VehicleState(
        vehicle_id="EV-URGENT",
        battery_percent=10.0,
        battery_capacity_kwh=50.0,
        max_charge_rate_kw=22.0,
        departure_time=now + timedelta(hours=1), # Needs 45kWh in 1 hour -> 45kW required! Very urgent.
        is_connected=True
    )
    
    v_chill = VehicleState(
        vehicle_id="EV-CHILL",
        battery_percent=80.0,
        battery_capacity_kwh=50.0,
        max_charge_rate_kw=22.0,
        departure_time=now + timedelta(hours=10), # Needs 10kWh in 10 hours -> 1kW required. Not urgent.
        is_connected=True
    )

    allocations = allocate([v_chill, v_urgent], grid)

    # Urgent should get the full 20kW budget since it requests 22kW
    assert allocations["EV-URGENT"] == 20.0
    assert allocations["EV-CHILL"] == 0.0

def test_allocate_with_solar():
    now = datetime.now()
    grid = GridState(
        total_capacity_kw=50.0,
        building_base_load_kw=60.0, # Building using more than grid limit
        solar_generation_kw=30.0,   # Solar offsets it
        timestamp=now
    )
    # Budget: 50 - 60 + 30 = 20 kW
    
    v = VehicleState(
        vehicle_id="EV-1",
        battery_percent=50.0,
        battery_capacity_kwh=50.0,
        max_charge_rate_kw=11.0,
        departure_time=now + timedelta(hours=2),
        is_connected=True
    )

    allocations = allocate([v], grid)
    assert allocations["EV-1"] == 11.0 # Should have enough budget (20kW > 11kW)

def test_ignores_disconnected_and_full():
    now = datetime.now()
    grid = GridState(total_capacity_kw=100.0, building_base_load_kw=0.0, solar_generation_kw=0.0, timestamp=now)
    
    v_disc = VehicleState(
        vehicle_id="EV-1", battery_percent=50.0, battery_capacity_kwh=50.0, 
        max_charge_rate_kw=11.0, departure_time=now + timedelta(hours=2), is_connected=False
    )
    v_full = VehicleState(
        vehicle_id="EV-2", battery_percent=100.0, battery_capacity_kwh=50.0, 
        max_charge_rate_kw=11.0, departure_time=now + timedelta(hours=2), is_connected=True
    )

    allocations = allocate([v_disc, v_full], grid)
    assert allocations["EV-1"] == 0.0
    assert allocations["EV-2"] == 0.0
