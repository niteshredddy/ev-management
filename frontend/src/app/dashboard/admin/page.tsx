"use client";
import { useEffect, useState } from "react";
import { Activity, Zap, Sun, DollarSign, LogOut } from "lucide-react";
import Link from "next/link";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function AdminDashboard() {
  const [stats, setStats] = useState({
      total_bookings: 0,
      total_solar_savings: 0.0,
      active_chargers: 0,
      transformer_capacity: 100, // kW
      building_load: 0, // kW
      solar_generation: 0, // kW
      activeEvLoad: 0 // kW
  });

  const [historyData, setHistoryData] = useState<{time: string, load: number, solar: number}[]>([]);
  const [usersList, setUsersList] = useState<{id: number, name: string, phone_number: string, green_credits: number, vehicle_count: number}[]>([]);

  useEffect(() => {
      const fetchData = async () => {
          try {
              const res = await fetch("/api/state");
              if (res.ok) {
                  const data = await res.json();
                  const grid = data.grid;
                  const vehicles = data.vehicles || [];
                  
                  // Calculate live load of all vehicles
                  const activeEvLoad = vehicles.reduce((sum: number, v: any) => sum + v.current_charge_rate_kw, 0);

                  setStats(prev => ({
                      ...prev,
                      building_load: Math.round(grid.building_base_load_kw),
                      solar_generation: Math.round(grid.solar_generation_kw),
                      active_chargers: vehicles.filter((v: any) => v.current_charge_rate_kw > 0).length,
                      transformer_capacity: grid.total_capacity_kw,
                      activeEvLoad: Math.round(activeEvLoad) // keep track of this for display
                  }));

                  // Update chart data
                  const now = new Date();
                  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  
                  setHistoryData(prev => {
                      const newData = [...prev, { time: timeStr, load: grid.building_base_load_kw + activeEvLoad, solar: grid.solar_generation_kw }];
                      if (newData.length > 20) return newData.slice(newData.length - 20); // Keep last 20 points
                      return newData;
                  });
              }

              const statsRes = await fetch("/api/admin/stats");
              if (statsRes.ok) {
                  const s = await statsRes.json();
                  setStats(prev => ({
                      ...prev,
                      total_bookings: s.total_bookings,
                      total_solar_savings: s.total_solar_savings
                  }));
              }

              const usersRes = await fetch("/api/admin/users");
              if (usersRes.ok) {
                  setUsersList(await usersRes.json());
              }
          } catch (e) {
              console.error(e);
          }
      };

      fetchData();
      const interval = setInterval(fetchData, 1000);
      return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen p-8 relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute top-1/3 left-0 w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-accent/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }} />

        <div className="max-w-7xl mx-auto relative z-10 flex flex-col gap-8">
            {/* Header */}
            <div className="flex justify-between items-center glass-panel p-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-gradient-to-br from-primary to-accent rounded-xl shadow-lg">
                        <Activity className="text-white w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">GridSync Admin Panel</h1>
                        <p className="text-gray-400 text-sm">System Overview & Load Distribution</p>
                    </div>
                </div>
                <div className="flex gap-4">
                    <Link href="/login" className="glass-button-secondary flex items-center gap-2">
                         <LogOut className="w-4 h-4" /> Logout
                    </Link>
                </div>
            </div>

            {/* Top Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="glass-panel p-6 flex items-start gap-4">
                    <div className="p-3 bg-blue-500/20 rounded-lg">
                        <Zap className="text-blue-400 w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-gray-400 text-sm">Transformer Load</p>
                        <h3 className="text-2xl font-bold text-white">{stats.building_load + stats.activeEvLoad} / {stats.transformer_capacity} kW</h3>
                        <p className="text-xs text-blue-400 mt-1">Building ({stats.building_load}kW) + EVs ({stats.activeEvLoad}kW)</p>
                    </div>
                </div>
                
                <div className="glass-panel p-6 flex items-start gap-4">
                    <div className="p-3 bg-yellow-500/20 rounded-lg">
                        <Sun className="text-yellow-400 w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-gray-400 text-sm">Solar Generation</p>
                        <h3 className="text-2xl font-bold text-white">{stats.solar_generation} kW</h3>
                        <p className="text-xs text-yellow-400 mt-1">Used by EVs instantly</p>
                    </div>
                </div>

                <div className="glass-panel p-6 flex items-start gap-4">
                    <div className="p-3 bg-green-500/20 rounded-lg">
                        <DollarSign className="text-green-400 w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-gray-400 text-sm">Total Solar Savings</p>
                        <h3 className="text-2xl font-bold text-white">₹{stats.total_solar_savings.toFixed(2)}</h3>
                        <p className="text-xs text-green-400 mt-1">Saved for customers</p>
                    </div>
                </div>

                <div className="glass-panel p-6 flex items-start gap-4">
                    <div className="p-3 bg-accent/20 rounded-lg">
                        <Activity className="text-accent w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-gray-400 text-sm">Active Chargers</p>
                        <h3 className="text-2xl font-bold text-white">{stats.active_chargers} / 5</h3>
                        <p className="text-xs text-accent mt-1">{stats.total_bookings} total bookings</p>
                    </div>
                </div>
            </div>

            {/* Charts Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 glass-panel p-6">
                    <h2 className="text-lg font-semibold text-white mb-6">Real-time Load vs Capacity</h2>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={historyData}>
                                <defs>
                                    <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                                    </linearGradient>
                                    <linearGradient id="colorSolar" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#eab308" stopOpacity={0.3}/>
                                    <stop offset="95%" stopColor="#eab308" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="time" stroke="#475569" fontSize={12} />
                                <YAxis stroke="#475569" fontSize={12} />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                    itemStyle={{ color: '#fff' }}
                                />
                                <Area type="monotone" dataKey="load" stroke="#0ea5e9" fillOpacity={1} fill="url(#colorLoad)" name="Total Load (kW)" />
                                <Area type="monotone" dataKey="solar" stroke="#eab308" fillOpacity={1} fill="url(#colorSolar)" name="Solar Gen (kW)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="flex flex-col gap-8 lg:col-span-1">
                    {/* IoT Simulator panel */}
                    <div className="glass-panel p-6 border border-accent/20">
                        <h2 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                            <Activity className="text-accent" /> IoT Simulator Hub
                        </h2>
                        <p className="text-xs text-gray-400 mb-6">Trigger real-time physical events to see the load balancer react instantly.</p>
                        
                        <div className="flex flex-col gap-4">
                            <button 
                                onClick={async () => {
                                    const res = await fetch("/api/admin/simulate/cloud", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ enable: true })
                                    });
                                    if(res.ok) alert("Heavy Cloud Cover simulated! Solar generation dropped to 0kW.");
                                }}
                                className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/5 hover:border-yellow-500/30 group"
                            >
                                <div className="p-2 bg-yellow-500/20 rounded-lg group-hover:scale-110 transition-transform">
                                    <Sun className="text-yellow-400 w-5 h-5" />
                                </div>
                                <div className="text-left">
                                    <p className="text-sm font-medium text-white">Simulate Cloud Cover</p>
                                    <p className="text-xs text-gray-400">Drops Solar to 0kW</p>
                                </div>
                            </button>

                            <button 
                                onClick={async () => {
                                    const res = await fetch("/api/admin/simulate/spike", {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ enable: true })
                                    });
                                    if(res.ok) alert("Building AC Spike simulated! Grid capacity maxed out.");
                                }}
                                className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all border border-white/5 hover:border-blue-500/30 group"
                            >
                                <div className="p-2 bg-blue-500/20 rounded-lg group-hover:scale-110 transition-transform">
                                    <Zap className="text-blue-400 w-5 h-5" />
                                </div>
                                <div className="text-left">
                                    <p className="text-sm font-medium text-white">Simulate AC Spike</p>
                                    <p className="text-xs text-gray-400">Adds +40kW building load</p>
                                </div>
                            </button>
                            
                            <button 
                                onClick={async () => {
                                    await fetch("/api/admin/simulate/cloud", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enable: false }) });
                                    await fetch("/api/admin/simulate/spike", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enable: false }) });
                                    alert("All simulations reset to normal.");
                                }}
                                className="text-xs text-gray-500 hover:text-white transition-colors mt-2 text-left"
                            >
                                Reset Simulations
                            </button>
                        </div>
                    </div>

                    {/* Live Station Status */}
                    <div className="glass-panel p-6">
                        <h2 className="text-lg font-semibold text-white mb-6">Live Station Status</h2>
                        <div className="flex flex-col gap-4">
                            {/* Mocking the 5 charging points */}
                            {[1, 2, 3, 4, 5].map(point => (
                                <div key={point} className="flex justify-between items-center p-3 bg-white/5 border border-white/5 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${point <= stats.active_chargers ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]' : 'bg-gray-600'}`} />
                                        <span className="text-white text-sm">Point {point}</span>
                                    </div>
                                    {point <= stats.active_chargers ? (
                                        <span className="text-xs text-primary font-medium">Charging (Active)</span>
                                    ) : (
                                        <span className="text-xs text-gray-500">Available</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Users Leaderboard */}
            <div className="glass-panel p-6">
                <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                    <Activity className="text-green-400" /> Registered Users & Green Credits
                </h2>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/10">
                                <th className="p-3 text-sm font-semibold text-gray-400">User ID</th>
                                <th className="p-3 text-sm font-semibold text-gray-400">Name</th>
                                <th className="p-3 text-sm font-semibold text-gray-400">Phone Number</th>
                                <th className="p-3 text-sm font-semibold text-gray-400">Vehicles</th>
                                <th className="p-3 text-sm font-semibold text-green-400 text-right">Green Credits</th>
                            </tr>
                        </thead>
                        <tbody>
                            {usersList.sort((a, b) => b.green_credits - a.green_credits).map(user => (
                                <tr key={user.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                    <td className="p-3 text-sm text-gray-400">#{user.id}</td>
                                    <td className="p-3 text-sm text-white font-medium">{user.name}</td>
                                    <td className="p-3 text-sm text-gray-400">{user.phone_number}</td>
                                    <td className="p-3 text-sm text-gray-400">{user.vehicle_count}</td>
                                    <td className="p-3 text-sm font-bold text-green-400 text-right">{user.green_credits}</td>
                                </tr>
                            ))}
                            {usersList.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-6 text-center text-gray-500 text-sm">No registered users yet.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
  );
}
