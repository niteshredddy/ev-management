"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";

export default function Login() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = isRegistering ? "/api/auth/register" : "/api/auth/login";
    
    const body = isRegistering 
        ? { phone_number: phone, password, name }
        : { phone_number: phone, password };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        if (isRegistering) {
            setIsRegistering(false); // Switch to login after register
            alert("Registration successful! Please login.");
        } else {
            router.push("/dashboard/user");
        }
      } else {
        const error = await res.json();
        alert(error.detail || "Error occurred");
      }
    } catch (err) {
      console.error(err);
      alert("Network error");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '3s' }} />

        <div className="glass-panel p-8 w-full max-w-md relative z-10 flex flex-col items-center">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-3 bg-gradient-to-br from-primary to-accent rounded-xl shadow-lg">
                    <Zap className="text-white w-8 h-8" />
                </div>
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-300">
                    GridSync
                </h1>
            </div>

            <h2 className="text-xl font-medium text-white mb-6">
                {isRegistering ? "Create an Account" : "Welcome Back"}
            </h2>

            <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
                {isRegistering && (
                    <input 
                        type="text" 
                        placeholder="Full Name" 
                        className="glass-input w-full"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        required
                    />
                )}
                <input 
                    type="tel" 
                    placeholder="Phone Number" 
                    className="glass-input w-full"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    required
                />
                <input 
                    type="password" 
                    placeholder="Password" 
                    className="glass-input w-full"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                />
                <button type="submit" className="glass-button w-full mt-2">
                    {isRegistering ? "Register" : "Login"}
                </button>
            </form>

            <p className="text-sm text-gray-400 mt-6 cursor-pointer hover:text-white transition-colors" onClick={() => setIsRegistering(!isRegistering)}>
                {isRegistering ? "Already have an account? Login" : "Don't have an account? Register"}
            </p>
        </div>
    </div>
  );
}
