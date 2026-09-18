"use client";
import { useEffect, useState } from "react";
import { History, ArrowLeft, Download } from "lucide-react";
import Link from "next/link";

interface BookingHistory {
  id: number;
  date: string;
  vehicle_type: string;
  plate_number: string;
  charge_amount: number; // percentage gained
  total_paid: number;
  solar_savings: number;
  is_battery_exchange: boolean;
}

export default function UserHistory() {
  const [history, setHistory] = useState<BookingHistory[]>([]);

  useEffect(() => {
    // Mock data for history
    setHistory([
      {
        id: 104,
        date: "2026-09-17 14:30",
        vehicle_type: "Car",
        plate_number: "TS 09 EB 1234",
        charge_amount: 45,
        total_paid: 120.0,
        solar_savings: 15.5,
        is_battery_exchange: false
      },
      {
        id: 103,
        date: "2026-09-15 09:15",
        vehicle_type: "Bike",
        plate_number: "TS 07 BP 9876",
        charge_amount: 100,
        total_paid: 45.0,
        solar_savings: 0,
        is_battery_exchange: true // Instantly swapped to 100%
      },
      {
        id: 102,
        date: "2026-09-10 18:45",
        vehicle_type: "Car",
        plate_number: "TS 09 EB 1234",
        charge_amount: 30,
        total_paid: 85.5,
        solar_savings: 8.0,
        is_battery_exchange: false
      }
    ]);
  }, []);

  return (
    <div className="min-h-screen p-8 relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute top-0 right-1/4 w-[400px] h-[400px] bg-primary/10 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 left-1/4 w-[500px] h-[500px] bg-accent/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1.5s' }} />

        <div className="max-w-4xl mx-auto relative z-10 flex flex-col gap-8">
            {/* Header */}
            <div className="flex justify-between items-center glass-panel p-6">
                <div className="flex items-center gap-4">
                    <Link href="/dashboard/user" className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                        <ArrowLeft className="w-6 h-6 text-white" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                            <History className="text-primary w-6 h-6" /> Charging History
                        </h1>
                        <p className="text-gray-400 text-sm mt-1">Your past charging sessions and battery swaps.</p>
                    </div>
                </div>
                <button className="glass-button-secondary flex items-center gap-2 text-sm">
                    <Download className="w-4 h-4" /> Export CSV
                </button>
            </div>

            <div className="glass-panel p-2">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-300">
                        <thead className="text-xs uppercase bg-white/5 text-gray-400 border-b border-white/10">
                            <tr>
                                <th className="px-6 py-4 rounded-tl-lg">Date & Time</th>
                                <th className="px-6 py-4">Vehicle</th>
                                <th className="px-6 py-4">Type</th>
                                <th className="px-6 py-4">Charged</th>
                                <th className="px-6 py-4 text-green-400">Solar Savings</th>
                                <th className="px-6 py-4 rounded-tr-lg">Total Paid</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.map((item, index) => (
                                <tr key={item.id} className={`border-b border-white/5 hover:bg-white/5 transition-colors ${index === history.length - 1 ? 'border-none' : ''}`}>
                                    <td className="px-6 py-4 font-medium text-white whitespace-nowrap">
                                        {item.date}
                                    </td>
                                    <td className="px-6 py-4">
                                        {item.plate_number}
                                    </td>
                                    <td className="px-6 py-4">
                                        {item.is_battery_exchange ? (
                                            <span className="px-2 py-1 bg-accent/20 text-accent rounded-full text-xs">Swap</span>
                                        ) : (
                                            <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs">Charge</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {item.is_battery_exchange ? 'Full Swap' : `+${item.charge_amount}%`}
                                    </td>
                                    <td className="px-6 py-4 text-green-400">
                                        {item.solar_savings > 0 ? `₹${item.solar_savings.toFixed(2)}` : '-'}
                                    </td>
                                    <td className="px-6 py-4 text-white font-medium">
                                        ₹{item.total_paid.toFixed(2)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
  );
}
