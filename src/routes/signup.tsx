import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import brandLogo from "@/assets/logo.png";
import { authApi } from "@/lib/api";
import { Link } from "../App";

// Custom lightweight navigation hook
const useNavigate = () => {
  return (options: { to: string }) => {
    window.history.pushState({}, '', options.to);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };
};



export default function SignupPage() {

  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log("[Signup] Attempting signup for:", { name, phone });
    
    try {
      await authApi.signup({ name, phone, password, role: "employee", status: "pending" });
      console.log("[Signup] Success!");
      
      toast.success("Signup successful! Your account is pending admin approval.");
      navigate({ to: "/login" });
    } catch (err: any) {
      toast.error(err.message || "Failed to connect to the server.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary/30 p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-lg p-8">
        <div className="flex flex-col items-center mb-8">
          <img src={brandLogo} alt="Logo" className="h-16 w-16 mb-4 rounded-md border border-gold/30 bg-background/50 object-contain" />
          <h1 className="text-2xl font-display text-gold">Create Account</h1>
          <p className="text-sm text-muted-foreground mt-1">Apply for employee access</p>
        </div>
        
        <form onSubmit={handleSignup} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input 
              id="name" 
              type="text" 
              placeholder="John Doe" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              required 
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input 
              id="phone" 
              type="tel" 
              placeholder="+91 98765 43210" 
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required 
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input 
              id="password" 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </div>
          <Button type="submit" className="w-full bg-gold text-gold-foreground hover:bg-gold/90 mt-2">
            Sign Up
          </Button>
        </form>
        
        <p className="text-center text-sm text-muted-foreground mt-6">
          Already have an account? <Link to="/login" className="text-gold hover:underline">Sign in</Link>
        </p>
        
        <p className="text-center text-sm text-muted-foreground mt-4">
          Are you a reception staff? <Link to="/reception-signup" className="text-gold hover:underline">Reception Signup</Link>
        </p>
      </div>
    </div>
  );
}
