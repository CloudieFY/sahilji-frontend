import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { DeliveriesPage } from "@/components/DeliveriesPage";

// Custom lightweight navigation hook
const useNavigate = () => {
  return (options: { to: string }) => {
    window.history.pushState({}, '', options.to);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };
};

export default function DeliveriesRoute() {
  const navigate = useNavigate();

  useEffect(() => {
    const role = localStorage.getItem("user_role")?.trim().toLowerCase();
    if (!role) {
      navigate({ to: "/login" });
    } else if (role !== "admin" && role !== "employee" && role !== "reception") {
      navigate({ to: "/availability" });
    }
  }, []);

  return <AppShell><DeliveriesPage /></AppShell>;
}
