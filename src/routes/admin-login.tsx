import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import brandLogo from "@/assets/logo.png";
import { Eye, EyeOff } from "lucide-react";
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
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedUser = username.trim();
    const trimmedPass = password.trim();

    // Mock Admin Authentication Logic
    if ((trimmedUser === "90394 89995") && trimmedPass === "arihant@55") {
      localStorage.setItem("user_role", "admin");
      localStorage.setItem("user_name", "Admin");
      toast.success("Logged in as Admin");
      navigate({ to: "/" });
    } else {
      toast.error("Invalid admin credentials. Please try again.");
    }
  };

  return (
    <div className="w-full lg:grid lg:min-h-screen lg:grid-cols-2 xl:min-h-screen">
      <div className="flex items-center justify-center py-12">
        <div className="mx-auto grid w-87.5 gap-6">
        <div className="flex flex-col items-center mb-8">
            <img src={brandLogo} alt="Logo" className="h-20 w-20 mb-4 rounded-full border-2 border-gold/30 p-1 object-contain" />
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
            <div className="relative space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input 
              id="password" 
                type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
                className="pr-10"
              required 
            />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-[2.1rem] -translate-y-1/2 h-7 w-7 text-muted-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
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
      <div className="hidden bg-muted lg:block">
        <img
          src="/logo.png"
          alt="Image"
          width="1920"
          height="1080"
          className="h-full w-full object-cover dark:brightness-[0.2] dark:grayscale"
        />
      </div>
    </div>
  );
}