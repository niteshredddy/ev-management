from typing import List, Dict
from datetime import datetime
from .models import VehicleState, GridState

def calculate_priority_score(vehicle: VehicleState, current_time: datetime, has_solar_surplus: bool) -> float:
    """
    Computes a priority score for a vehicle. Higher score = higher priority for charging.
    """
    if vehicle.battery_percent >= 100.0:
        return 0.0

    kwh_needed = (1.0 - (vehicle.battery_percent / 100.0)) * vehicle.battery_capacity_kwh
    time_remaining_hours = max(0.1, (vehicle.departure_time - current_time).total_seconds() / 3600.0)
    
    # Base urgency: how many kW we need to constantly provide to finish exactly on time
    urgency = kwh_needed / time_remaining_hours

    # If there is a solar surplus, we could boost priority of lower battery vehicles
    # But for a greedy algorithm, sorting by required kW/h (urgency) works well.
    # The higher the urgency, the more critical it is to charge them *now*.
    return urgency

def allocate(vehicles: List[VehicleState], grid_state: GridState) -> Dict[str, float]:
    """
    Allocates available power to vehicles based on priority.
    Returns a dictionary mapping vehicle_id to allocated_kw.
    """
    # 1. Compute available power budget
    # Budget = Grid Limit - Building Load + Solar Generation
    # Solar generation effectively offsets building load, and any excess adds to available power 
    # (assuming grid limit is how much we can pull *from* the grid, solar is local).
    # If building load > solar, net load = building - solar. We pull net_load from grid.
    # So we can pull up to grid_capacity. Thus total available = grid_capacity + solar - building_load (clamped to 0 min)
    
    available_budget = grid_state.total_capacity_kw + grid_state.solar_generation_kw - grid_state.building_base_load_kw
    available_budget = max(0.0, available_budget)

    has_solar_surplus = grid_state.solar_generation_kw > grid_state.building_base_load_kw

    # 2. Score and sort vehicles
    allocations = {}
    prioritized_vehicles = []
    
    for v in vehicles:
        if not v.is_connected or v.battery_percent >= 100.0:
            allocations[v.vehicle_id] = 0.0
            continue
            
        score = calculate_priority_score(v, grid_state.timestamp, has_solar_surplus)
        prioritized_vehicles.append((score, v))

    # Sort descending by priority score
    prioritized_vehicles.sort(key=lambda x: x[0], reverse=True)

    # 3. Allocate power highest-priority-first
    remaining_budget = available_budget
    active_shedding = False

    # First pass: assign 0 to all to initialize
    for _, v in prioritized_vehicles:
        allocations[v.vehicle_id] = 0.0

    for score, v in prioritized_vehicles:
        if remaining_budget <= 0.01:
            active_shedding = True
            break
            
        # Determine how much this vehicle can take
        requested_kw = v.max_charge_rate_kw
        
        # We also shouldn't give it more than it needs to reach 100% in this tick.
        # But since we don't know the tick duration in this pure function, we just cap by max_charge_rate_kw.
        # The simulator will cap at 100% battery anyway.
        
        allocated_kw = min(requested_kw, remaining_budget)
        allocations[v.vehicle_id] = allocated_kw
        remaining_budget -= allocated_kw

        if allocated_kw < requested_kw:
            active_shedding = True

    return allocations
