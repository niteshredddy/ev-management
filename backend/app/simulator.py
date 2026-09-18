import asyncio
import math
from datetime import datetime, timedelta
import random
from .models import VehicleState, GridState, SimulationStateSnapshot

# Configurable acceleration factor. e.g. 1 real second is 1 simulated minute
SIM_MINUTES_PER_TICK = 1 

class Simulator:
    def __init__(self, num_chargers: int = 8, grid_capacity_kw: float = 100.0):
        self.num_chargers = num_chargers
        self.grid_capacity_kw = grid_capacity_kw
        # Start at 8 AM for the demo
        self.sim_time = datetime.now().replace(hour=8, minute=0, second=0, microsecond=0)
        self.vehicles = []
        self._init_vehicles()
        self.running = False
        self.state_subscribers = [] # Simple pub/sub pattern
        self.force_cloud = False
        self.force_spike = False

    def _init_vehicles(self):
        # Create some initial vehicles
        for i in range(self.num_chargers):
            # 80% chance of a vehicle being connected initially
            is_connected = random.random() < 0.8
            # A low battery one for the demo
            if i == 0: 
                battery = 15.0
                is_connected = True
                dep_time = self.sim_time + timedelta(hours=2) # Needs charge soon
            else:
                battery = random.uniform(40.0, 90.0)
                dep_time = self.sim_time + timedelta(hours=random.uniform(3, 8))
            
            self.vehicles.append(
                VehicleState(
                    vehicle_id=f"EV-{i+1:03d}",
                    battery_percent=battery if is_connected else 0.0,
                    battery_capacity_kwh=random.choice([50.0, 65.0, 75.0, 100.0]),
                    max_charge_rate_kw=random.choice([7.2, 11.0, 22.0]),
                    departure_time=dep_time,
                    is_connected=is_connected
                )
            )

    def subscribe(self, callback):
        self.state_subscribers.append(callback)

    def unsubscribe(self, callback):
        if callback in self.state_subscribers:
            self.state_subscribers.remove(callback)

    def _simulate_grid(self) -> GridState:
        # Simulate building load: baseline + some noise
        # Between 20kW and 60kW
        base_load = 40.0 + math.sin(self.sim_time.hour * math.pi / 12) * 20.0 + random.uniform(-5, 5)
        
        if self.force_spike:
            base_load += 40.0 # Huge spike!

        # Simulate solar generation: bell curve peaking at solar noon (12-1 PM)
        # Solar dip for the demo: around 8:30 AM
        solar_generation = 0.0
        if 6 <= self.sim_time.hour <= 18:
            # Basic solar curve
            hour_offset = self.sim_time.hour + (self.sim_time.minute / 60) - 12
            solar_generation = max(0, 50.0 * math.cos(hour_offset * math.pi / 8))
            
            # Artificial dip around 8:30 AM for demo purposes
            if 8 <= self.sim_time.hour < 9 and 15 <= self.sim_time.minute <= 45:
                solar_generation *= 0.2 # Cloud cover!
            
            if self.force_cloud:
                solar_generation = 0.0

        return GridState(
            total_capacity_kw=self.grid_capacity_kw,
            building_base_load_kw=max(0.0, base_load),
            solar_generation_kw=solar_generation,
            timestamp=self.sim_time
        )

    def _update_vehicle_batteries(self, delta_minutes: float):
        for v in self.vehicles:
            if v.is_connected and v.current_charge_rate_kw > 0:
                # Add energy: kW * hours = kWh
                energy_added_kwh = v.current_charge_rate_kw * (delta_minutes / 60.0)
                percent_added = (energy_added_kwh / v.battery_capacity_kwh) * 100
                v.battery_percent = min(100.0, v.battery_percent + percent_added)
                
                # If fully charged, stop charging
                if v.battery_percent >= 100.0:
                    v.current_charge_rate_kw = 0.0

    async def run_loop(self):
        self.running = True

        while self.running:
            # 1. Advance time
            self.sim_time += timedelta(minutes=SIM_MINUTES_PER_TICK)
            grid_state = self._simulate_grid()
            
            # Open DB Session
            from .db import SessionLocal
            from .models import Booking, Vehicle
            db = SessionLocal()
            try:
                # 2. Fetch Active Bookings from Database
                active_bookings = db.query(Booking).filter(Booking.status == "ACTIVE").all()
                
                # Dynamic Pricing Logic
                # Base grid price: 10
                current_price = 10.0
                if grid_state.building_base_load_kw > 80:
                    current_price = 15.0 # Peak load penalty
                if grid_state.solar_generation_kw > 15:
                    current_price = 0.0 # Free solar peak
                
                # Expose this to grid state for the frontend
                grid_state.current_price_per_kwh = current_price

                # Sync self.vehicles list from active bookings
                self.vehicles = []
                for b in active_bookings:
                    v_db = b.vehicle
                    # Create simulation state for each active booking
                    self.vehicles.append(
                        VehicleState(
                            vehicle_id=str(b.id), # Use booking ID as unique identifier for this run
                            battery_percent=b.current_charge_percent,
                            battery_capacity_kwh=v_db.battery_capacity_kwh,
                            max_charge_rate_kw=v_db.max_charge_rate_kw,
                            departure_time=b.departure_time,
                            is_connected=True,
                            is_urgent=b.is_urgent
                        )
                    )

                # 3. Simulate vehicle battery filling (this updates self.vehicles)
                # But wait, current_charge_rate_kw is 0 for newly fetched.
                # So we must allocate FIRST, then fill!
                from .optimizer_v2 import optimizer_v2
                allocations, total_solar_used = optimizer_v2.allocate(self.vehicles, grid_state)
                
                active_shedding = False
                for v in self.vehicles:
                    allocated_kw = allocations.get(v.vehicle_id, 0.0)
                    if allocated_kw < v.max_charge_rate_kw:
                        active_shedding = True
                    v.current_charge_rate_kw = allocated_kw
                    
                # 4. Apply charge based on allocation
                self._update_vehicle_batteries(SIM_MINUTES_PER_TICK)
                
                # 5. Sync back to Database & Calculate Money
                for b in active_bookings:
                    v_state = next((v for v in self.vehicles if v.vehicle_id == str(b.id)), None)
                    if v_state:
                        # How much energy was added?
                        energy_added_kwh = v_state.current_charge_rate_kw * (SIM_MINUTES_PER_TICK / 60.0)
                        
                        # Did it use solar? We approximate by giving solar equally to all who are charging
                        total_charging_kw = sum(v.current_charge_rate_kw for v in self.vehicles)
                        my_solar_ratio = (v_state.current_charge_rate_kw / total_charging_kw) if total_charging_kw > 0 else 0
                        my_solar_kwh = my_solar_ratio * (total_solar_used * (SIM_MINUTES_PER_TICK / 60.0))
                        my_grid_kwh = max(0, energy_added_kwh - my_solar_kwh)
                        
                        # Update DB Model
                        b.current_charge_percent = v_state.battery_percent
                        b.total_paid += my_grid_kwh * current_price
                        b.solar_savings += my_solar_kwh * 10.0 # Calculate savings based on base price
                        
                        # Award green credits if not urgent and used solar
                        if not b.is_urgent and my_solar_kwh > 0:
                            # 100 credits per 1 kWh of solar used
                            b.user.green_credits += int(my_solar_kwh * 100)
                        
                        if b.current_charge_percent >= 100.0:
                            b.status = "COMPLETED"

                db.commit()
            except Exception as e:
                db.rollback()
                print("Sim error:", e)
            finally:
                db.close()
            
            # For dashboard frontend rendering
            for v in self.vehicles:
                v.priority_score = 100 if v.is_urgent else 50

            # 4. Snapshot state
            snapshot = SimulationStateSnapshot(
                grid=grid_state,
                vehicles=[v.model_copy() for v in self.vehicles],
                active_shedding=active_shedding
            )

            # 5. Publish to subscribers
            for sub in self.state_subscribers:
                await sub(snapshot)
            
            # Tick every real second (which is SIM_MINUTES_PER_TICK simulated minutes)
            await asyncio.sleep(1.0)

    def stop(self):
        self.running = False

# Global instance for the backend to use
simulator_instance = Simulator()
