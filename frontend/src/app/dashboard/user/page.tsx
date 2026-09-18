"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Car, Battery, Clock, Zap, History, Plus, X, QrCode, Leaf, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";

interface Vehicle {
  id: number;
  vehicle_type: string;
  plate_number: string;
  battery_capacity_kwh: number;
}

interface Booking {
  id: number;
  vehicle_id: number;
  status: string;
  current_charge_percent: number;
  total_paid: number;
  solar_savings: number;
  is_battery_exchange: boolean;
  vehicle?: Vehicle;
}

export default function UserDashboard() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);
  const router = useRouter();

  const [showAddVehicle, setShowAddVehicle] = useState(false);
  const [newVehicle, setNewVehicle] = useState({ plate_number: '', vehicle_type: 'Car', battery_capacity_kwh: 60 });

  const [showBooking, setShowBooking] = useState<Vehicle | null>(null);
  const [bookingDetails, setBookingDetails] = useState({ start_charge: 20, target_charge: 80, is_urgent: false, departure_time: '' });

  const [userProfile, setUserProfile] = useState<{ green_credits: number } | null>(null);
  const [gridPrice, setGridPrice] = useState<number>(10.0);
  const [showScanner, setShowScanner] = useState(false);

  const fetchData = async () => {
    try {
      const pRes = await fetch("/api/user/me");
      if (pRes.ok) setUserProfile(await pRes.json());

      const sRes = await fetch("/api/state");
      if (sRes.ok) {
          const state = await sRes.json();
          setGridPrice(state.grid.current_price_per_kwh);
      }
      const vRes = await fetch("/api/user/vehicles");
      let loadedVehicles: Vehicle[] = [];
      if (vRes.ok) {
          loadedVehicles = await vRes.json();
          setVehicles(loadedVehicles);
      }

      const hRes = await fetch("/api/user/history");
      if (hRes.ok) {
        const history: Booking[] = await hRes.json();
        const active = history.find(b => b.status === "ACTIVE" || b.status === "BOOKED");
        
        if (active) {
          const vehicle = loadedVehicles.find(v => v.id === active.vehicle_id);
          setActiveBooking({...active, vehicle});
        } else {
          setActiveBooking(null);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000); // Poll every 5s for demo
    return () => clearInterval(interval);
  }, []);

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Add default max_charge_rate_kw since the backend schema requires it
    const payload = {
        ...newVehicle,
        max_charge_rate_kw: 11.0
    };

    const res = await fetch("/api/user/vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      setShowAddVehicle(false);
      fetchData();
    } else {
      const err = await res.json();
      alert("Failed to add vehicle: " + JSON.stringify(err));
    }
  };

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showBooking) return;
    
    const arrival_time = new Date().toISOString();
    let departure_time = bookingDetails.departure_time;
    if (!departure_time) {
        const d = new Date();
        d.setHours(d.getHours() + 2);
        departure_time = d.toISOString();
    } else {
        const d = new Date();
        const [hours, mins] = departure_time.split(':');
        d.setHours(parseInt(hours), parseInt(mins));
        departure_time = d.toISOString();
    }

    const payload = {
      vehicle_id: showBooking.id,
      is_urgent: bookingDetails.is_urgent,
      start_charge_percent: bookingDetails.start_charge,
      target_charge_percent: bookingDetails.target_charge,
      arrival_time,
      departure_time,
      is_battery_exchange: false
    };

    const res = await fetch("/api/user/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    if (res.ok) {
      setShowBooking(null);
      fetchData();
    } else {
      const err = await res.json();
      alert(err.detail || "Booking failed");
    }
  };

  const handleBatterySwap = async (vehicleId: number) => {
    if (!window.confirm("Perform instant battery swap for ₹50?")) return;
    const res = await fetch("/api/user/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vehicle_id: vehicleId,
        is_urgent: true,
        start_charge_percent: 0,
        target_charge_percent: 100,
        arrival_time: new Date().toISOString(),
        departure_time: new Date().toISOString(),
        is_battery_exchange: true
      })
    });
    if (res.ok) {
        const b = await res.json();
        await fetch(`/api/user/book/${b.id}/complete`, { method: "POST" });
        alert("Battery swap successful! Saved to history.");
        fetchData();
    }
  };

  const handleStopCharging = async () => {
    if (!activeBooking) return;
    await fetch(`/api/user/book/${activeBooking.id}/complete`, { method: "POST" });
    fetchData();
  };

  return (
    <div className="min-h-screen p-8 relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-accent/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />

        {/* Modals */}
        {showAddVehicle && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="glass-panel p-6 w-full max-w-md relative">
                    <button onClick={() => setShowAddVehicle(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><X /></button>
                    <h2 className="text-xl font-bold text-white mb-4">Add Vehicle</h2>
                    <form onSubmit={handleAddVehicle} className="flex flex-col gap-4">
                        <div>
                            <label className="text-gray-400 text-sm">Plate Number</label>
                            <input required type="text" className="glass-input mt-1" value={newVehicle.plate_number} onChange={e => setNewVehicle({...newVehicle, plate_number: e.target.value})} placeholder="TS 09 EB 1234" />
                        </div>
                        <div>
                            <label className="text-gray-400 text-sm">Vehicle Type</label>
                            <select className="glass-input mt-1" value={newVehicle.vehicle_type} onChange={e => setNewVehicle({...newVehicle, vehicle_type: e.target.value})}>
                                <option className="bg-slate-900 text-white" value="Car">Car</option>
                                <option className="bg-slate-900 text-white" value="Bike">Bike</option>
                                <option className="bg-slate-900 text-white" value="Bicycle">Bicycle</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-gray-400 text-sm">Battery Capacity (kWh)</label>
                            <input required type="number" className="glass-input mt-1" value={newVehicle.battery_capacity_kwh} onChange={e => setNewVehicle({...newVehicle, battery_capacity_kwh: Number(e.target.value)})} />
                        </div>
                        <button type="submit" className="glass-button w-full mt-2">Add Vehicle</button>
                    </form>
                </div>
            </div>
        )}

        {showScanner && (
            <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md p-4">
                <div className="relative w-64 h-64 border-4 border-primary rounded-3xl overflow-hidden animate-pulse">
                    <div className="absolute inset-0 border-[40px] border-black/40 rounded-3xl"></div>
                    <div className="absolute top-0 left-0 w-full h-1 bg-accent animate-[scan_2s_ease-in-out_infinite]" style={{ boxShadow: '0 0 15px 5px rgba(56, 189, 248, 0.5)' }}></div>
                </div>
                <p className="text-white mt-8 font-medium animate-pulse">Scanning QR Code...</p>
                <button onClick={() => setShowScanner(false)} className="mt-8 text-gray-400 hover:text-white">Cancel</button>
            </div>
        )}

        {showBooking && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <div className="glass-panel p-6 w-full max-w-md relative">
                    <button onClick={() => setShowBooking(null)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><X /></button>
                    <h2 className="text-xl font-bold text-white mb-4">Book Charging Slot</h2>
                    <p className="text-sm text-gray-400 mb-4">For {showBooking.plate_number}</p>
                    <form onSubmit={handleBook} className="flex flex-col gap-4">
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label className="text-gray-400 text-sm">Current %</label>
                                <input type="number" className="glass-input mt-1" value={bookingDetails.start_charge} onChange={e => setBookingDetails({...bookingDetails, start_charge: Number(e.target.value)})} />
                            </div>
                            <div className="flex-1">
                                <label className="text-gray-400 text-sm">Target %</label>
                                <input type="number" className="glass-input mt-1" value={bookingDetails.target_charge} onChange={e => setBookingDetails({...bookingDetails, target_charge: Number(e.target.value)})} />
                            </div>
                        </div>
                        <div>
                            <label className="text-gray-400 text-sm">Departure Time (Optional)</label>
                            <input type="time" className="glass-input mt-1" value={bookingDetails.departure_time} onChange={e => setBookingDetails({...bookingDetails, departure_time: e.target.value})} />
                        </div>
                        <div className="flex items-center gap-3 bg-white/5 p-3 rounded-lg border border-white/5 mt-2">
                            <input type="checkbox" id="urgent" className="w-4 h-4" checked={bookingDetails.is_urgent} onChange={e => setBookingDetails({...bookingDetails, is_urgent: e.target.checked})} />
                            <label htmlFor="urgent" className="text-white text-sm">Mark as Urgent (Higher cost, max speed)</label>
                        </div>
                        {!bookingDetails.is_urgent && (
                            <p className="text-xs text-green-400">🌱 You will earn +50 Green Credits by allowing flexible solar charging!</p>
                        )}
                        <button type="submit" className="glass-button w-full mt-2">Confirm Booking</button>
                    </form>
                </div>
            </div>
        )}

        <div className="max-w-6xl mx-auto relative z-10 flex flex-col gap-8">
            {/* Header */}
            <div className="flex justify-between items-center glass-panel p-6">
                <div>
                    <h1 className="text-3xl font-bold text-white">Welcome back!</h1>
                    <p className="text-gray-400 mt-1">Manage your EV charging sessions and vehicles.</p>
                    <div className="mt-4 flex items-center gap-2 px-3 py-1.5 rounded-full border bg-black/20 w-max border-white/5">
                        {gridPrice === 0 ? (
                            <><TrendingDown className="w-4 h-4 text-green-400" /> <span className="text-sm font-medium text-green-400">Live Price: ₹0/unit (Free Solar Peak)</span></>
                        ) : gridPrice > 10 ? (
                            <><TrendingUp className="w-4 h-4 text-red-400" /> <span className="text-sm font-medium text-red-400">Live Price: ₹{gridPrice}/unit (Peak Demand)</span></>
                        ) : (
                            <><Zap className="w-4 h-4 text-primary" /> <span className="text-sm font-medium text-gray-300">Live Price: ₹{gridPrice}/unit (Standard)</span></>
                        )}
                    </div>
                </div>
                <div className="flex flex-col items-end gap-3">
                    {userProfile && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-full shadow-[0_0_15px_rgba(34,197,94,0.1)]">
                            <Leaf className="w-4 h-4 text-green-400" />
                            <span className="text-green-400 font-bold">{userProfile.green_credits} Green Credits</span>
                        </div>
                    )}
                    <Link href="/dashboard/user/history" className="glass-button-secondary flex items-center gap-2">
                        <History className="w-4 h-4" /> History
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Active Session */}
                <div className="lg:col-span-2 glass-panel p-6 flex flex-col gap-6">
                    <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                        <Zap className="text-primary" /> Active Session
                    </h2>
                    
                    {activeBooking ? (
                        <div className="bg-white/5 border border-white/10 rounded-xl p-6 flex flex-col gap-6">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-lg font-medium text-white">{activeBooking.vehicle?.plate_number || "Unknown"}</h3>
                                    <p className="text-primary text-sm font-semibold uppercase tracking-wider">{activeBooking.vehicle?.vehicle_type}</p>
                                </div>
                                <div className="px-3 py-1 bg-green-500/20 text-green-400 border border-green-500/30 rounded-full text-xs font-semibold">
                                    CHARGING
                                </div>
                            </div>

                            <div className="flex flex-col gap-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">Current Charge</span>
                                    <span className="text-white font-medium">{activeBooking.current_charge_percent.toFixed(1)}%</span>
                                </div>
                                <div className="h-4 bg-gray-800 rounded-full overflow-hidden border border-white/5">
                                    <div 
                                        className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-1000 relative"
                                        style={{ width: `${activeBooking.current_charge_percent}%` }}
                                    >
                                        <div className="absolute inset-0 bg-white/20 animate-pulse" />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mt-2">
                                <div className="bg-white/5 rounded-lg p-4 flex flex-col gap-1">
                                    <span className="text-gray-400 text-xs uppercase">Est. Time Remaining</span>
                                    <span className="text-white text-xl font-semibold flex items-center gap-2">
                                        <Clock className="w-5 h-5 text-accent" /> 
                                        {Math.max(1, Math.round((100 - activeBooking.current_charge_percent) * 0.5))} mins
                                    </span>
                                </div>
                                <div className="bg-white/5 rounded-lg p-4 flex flex-col gap-1">
                                    <span className="text-gray-400 text-xs uppercase">Saved by Solar ☀️</span>
                                    <span className="text-green-400 text-xl font-semibold">
                                        ₹{activeBooking.solar_savings.toFixed(2)}
                                    </span>
                                </div>
                            </div>
                            
                            <button onClick={handleStopCharging} className="glass-button w-full mt-2">
                                Stop Charging & Pay ₹{activeBooking.total_paid.toFixed(2)}
                            </button>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-12 bg-white/5 rounded-xl border border-white/5 border-dashed">
                            <Battery className="w-12 h-12 mb-4 opacity-50" />
                            <p>No active charging sessions.</p>
                        </div>
                    )}
                </div>

                {/* Vehicles & Booking */}
                <div className="glass-panel p-6 flex flex-col gap-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                            <Car className="text-primary" /> My Vehicles
                        </h2>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => {
                                    setShowScanner(true);
                                    setTimeout(() => {
                                        setShowScanner(false);
                                        if (vehicles.length > 0) setShowBooking(vehicles[0]);
                                    }, 2000);
                                }} 
                                disabled={!!activeBooking}
                                className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-primary to-accent hover:opacity-90 rounded-lg text-white text-sm font-medium transition-all shadow-[0_0_15px_rgba(56,189,248,0.3)] disabled:opacity-50 disabled:shadow-none"
                            >
                                <QrCode className="w-4 h-4" /> Scan QR
                            </button>
                            <button onClick={() => setShowAddVehicle(true)} className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors">
                                <Plus className="w-5 h-5 text-white" />
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-col gap-4">
                        {vehicles.map(v => (
                            <div key={v.id} className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col gap-3 hover:bg-white/10 transition-colors group">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="text-white font-medium">{v.plate_number}</h3>
                                        <p className="text-gray-400 text-sm">{v.vehicle_type} • {v.battery_capacity_kwh} kWh</p>
                                    </div>
                                </div>
                                <div className="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => setShowBooking(v)} disabled={!!activeBooking} className="flex-1 glass-button-secondary text-xs py-1.5 disabled:opacity-50">
                                        Book Charge
                                    </button>
                                    {(v.vehicle_type === 'Bike' || v.vehicle_type === 'Bicycle') && (
                                        <button onClick={() => handleBatterySwap(v.id)} disabled={!!activeBooking} className="flex-1 bg-accent/20 hover:bg-accent/40 text-accent border border-accent/30 rounded-lg text-xs py-1.5 transition-colors disabled:opacity-50">
                                            Battery Swap
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                        {vehicles.length === 0 && (
                            <p className="text-sm text-gray-500 text-center py-4">No vehicles added yet.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
}
