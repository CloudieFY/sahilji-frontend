import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import brandLogo from "@/assets/logo.png";
import { Link } from "../App";

// Custom lightweight navigation hook
const useNavigate = () => {
  return (options: { to: string }) => {
    window.history.pushState({}, '', options.to);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };
};

export default function AdminLoginPage() {


  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedUser = username.trim();
    const trimmedPass = password.trim();

    // Mock Admin Authentication Logic
    if ((trimmedUser === "Sajansagar2516") && trimmedPass === "Shilpa2516") {
      localStorage.setItem("user_role", "admin");
      localStorage.setItem("user_name", "Admin");
      toast.success("Logged in as Admin");
      navigate({ to: "/" });
    } else {
      toast.error("Invalid admin credentials. Please try again.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-secondary/30 p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-lg p-8">
        <div className="flex flex-col items-center mb-8">
          <img src={brandLogo} alt="Logo" className="h-16 w-16 mb-4 rounded-md border border-gold/30 bg-background/50 object-contain" />
          <h1 className="text-2xl font-display text-gold">Admin Portal</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to manage the atelier</p>
        </div>
        
        <form onSubmit={handleLogin} className="space-y-4" autoComplete="off">
          <div className="space-y-2">
            <Label htmlFor="username">Admin Username</Label>
            <Input 
              id="username" 
              type="text" 
              placeholder="Enter admin username" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
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
            Sign In as Admin
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Are you an employee? <Link to="/login" className="text-gold hover:underline">Employee Login</Link>
        </p>
      </div>
    </div>
  );
}