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



export default function LoginPage() {


  const navigate = useNavigate();


  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log("[Login] Attempting login for:", phone);
    
    try {
      const user = await authApi.login({ phone, password });
      console.log("[Login] Success, user data:", user);
      
      if (user.status === "pending") {
        toast.error("Your account is pending admin approval.");
        return;
      }
      
      const role = String(user.role || "").trim().toLowerCase();
      localStorage.setItem("user_role", role);
      localStorage.setItem("user_name", user.name);
      toast.success(`Logged in as ${user.name}`);
      navigate({ to: role === "admin" ? "/" : "/availability" });
    } catch (err: any) {
      toast.error(err.message || "Failed to connect to the server.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary/30 p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-lg p-8">
        <div className="flex flex-col items-center mb-8">
          <img src={brandLogo} alt="Logo" className="h-16 w-16 mb-4 rounded-md border border-gold/30 bg-background/50 object-contain" />
          <h1 className="text-2xl font-display text-gold">Employee Portal</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to your employee account</p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-4" autoComplete="off">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input 
              id="phone" 
              type="tel" 
              placeholder="+91 0000000000" 
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="off"
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
              autoComplete="new-password"
              required 
            />
          </div>
          <Button type="submit" className="w-full bg-gold text-gold-foreground hover:bg-gold/90 mt-2">
            Sign In
          </Button>
        </form>
        
        <div className="mt-6 flex flex-col space-y-2 text-center text-sm text-muted-foreground">
          <p>
            Don't have an account? <Link to="/signup" className="text-gold hover:underline">Sign up</Link>
          </p>
          <p>
            Are you an admin? <Link to="/admin-login" className="text-gold hover:underline">Admin Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
