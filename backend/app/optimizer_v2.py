from typing import List, Dict, Tuple
from .models import VehicleState, GridState
import logging

logger = logging.getLogger(__name__)

class OptimizerV2:
    def __init__(self):
        pass

    def allocate(self, vehicles: List[VehicleState], grid: GridState) -> Tuple[Dict[str, float], float]:
        """
        Allocates power to connected vehicles based on the V2 rules:
        Returns:
            Dict[vehicle_id, charge_rate_kw]
            float: total_solar_used_kw
        """
        allocation = {}
        total_solar_used = 0.0

        connected_vehicles = [v for v in vehicles if v.is_connected]
        if not connected_vehicles:
            return {}, 0.0

        # Rule 1: Transformer power -> Building -> Remaining to EVs
        # Grid limit is transformer limit. Building load consumes first.
        remaining_grid_supply = grid.total_capacity_kw - grid.building_base_load_kw
        if remaining_grid_supply <= 0:
            remaining_grid_supply = 0

        urgent_vehicles = [v for v in connected_vehicles if v.is_urgent]
        non_urgent_vehicles = [v for v in connected_vehicles if not v.is_urgent]

        # Basic division logic based on user prompt.
        # "urgent gets max efficiency... divide supply to those 3 vehicles equally"
        # "non-urgent... supplied less than urgency one"

        # Let's define a base sharing factor. Urgent gets 3x more weight than non-urgent.
        weight_urgent = 3.0
        weight_non_urgent = 1.0

        total_weight = (len(urgent_vehicles) * weight_urgent) + (len(non_urgent_vehicles) * weight_non_urgent)

        is_fifth_arrival = len(connected_vehicles) == 5
        solar_available = grid.solar_generation_kw

        # Calculate standard allocation first
        for v in connected_vehicles:
            if total_weight == 0:
                allocation[v.vehicle_id] = 0.0
                continue
            
            weight = weight_urgent if v.is_urgent else weight_non_urgent
            # Raw fair share of grid
            raw_share = remaining_grid_supply * (weight / total_weight)
            
            # Cap at max vehicle charge rate
            allocation[v.vehicle_id] = min(raw_share, v.max_charge_rate_kw)

        # Rule for 5th vehicle
        # "if last point is filled with urgent vehicle then supply of previous drops (60->56)... solar compensates"
        if is_fifth_arrival:
            fifth_vehicle = connected_vehicles[-1] # Assuming last in list is the 5th
            if fifth_vehicle.is_urgent:
                # Apply the specific drop logic to *all* vehicles to represent the sharing,
                # and compensate with solar.
                # In our formula, adding a 5th urgent vehicle already drops the `raw_share` 
                # for the others mathematically (because total_weight increases).
                # We just need to allocate solar to "make up" for the drop.
                
                # To simulate the "compensation", we add solar to everyone equally up to max_charge_rate
                for v in connected_vehicles:
                    if solar_available > 0 and allocation[v.vehicle_id] < v.max_charge_rate_kw:
                        deficit = v.max_charge_rate_kw - allocation[v.vehicle_id]
                        compensation = min(deficit, solar_available / len(connected_vehicles))
                        allocation[v.vehicle_id] += compensation
                        total_solar_used += compensation
                        solar_available -= compensation

            else:
                # 5th vehicle is non-urgent
                # "supply will be divided in between previous vehicles"
                # The total_weight math already handles this gracefully by allocating it a small share
                pass
        else:
            # If less than 5 vehicles, just use solar to boost anyone who isn't capped
            for v in connected_vehicles:
                if solar_available > 0 and allocation[v.vehicle_id] < v.max_charge_rate_kw:
                    deficit = v.max_charge_rate_kw - allocation[v.vehicle_id]
                    compensation = min(deficit, solar_available / len(connected_vehicles))
                    allocation[v.vehicle_id] += compensation
                    total_solar_used += compensation
                    solar_available -= compensation

        return allocation, total_solar_used

optimizer_v2 = OptimizerV2()
