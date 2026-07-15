import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authApi, type User } from "@/lib/api";
import { Eye, EyeOff } from "lucide-react";
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
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log("[Login] Attempting login for:", phone);
    
    try {
      const user = await authApi.login({ phone, password }) as User;
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
    <div className="w-full lg:grid lg:min-h-screen lg:grid-cols-2 xl:min-h-screen">
      <div className="flex items-center justify-center py-12">
        <div className="mx-auto grid w-87.5 gap-6">
        <div className="flex flex-col items-center mb-8">
            <img src="/logo.png" alt="Arihant Collection Logo" className="h-20 w-20 mb-4 rounded-full border-2 border-gold/30 p-1 object-contain" />
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
