export interface VehicleState {
    vehicle_id: string;
    battery_percent: number;
    battery_capacity_kwh: number;
    max_charge_rate_kw: number;
    departure_time: string;
    is_connected: boolean;
    current_charge_rate_kw: number;
    priority_score: number;
}

export interface GridState {
    total_capacity_kw: number;
    building_base_load_kw: number;
    solar_generation_kw: number;
    timestamp: string;
}

export interface SimulationStateSnapshot {
    grid: GridState;
    vehicles: VehicleState[];
    active_shedding: boolean;
}
