import { useMemo, useState, useEffect } from "react";

import { AppShell } from "@/components/AppShell";
import { useStore } from "@/data/store";
import { formatCurrencyINR } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Mail, Phone, Plus, Trash2 } from "lucide-react";
import { AddCustomerDialog } from "@/components/forms/AddCustomerDialog";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// Custom lightweight navigation hook
const useNavigate = () => {
  return (options: { to: string, params?: any }) => {
    let path = options.to;
    if (options.params?.customerId) {
      path = path.replace('$customerId', options.params.customerId);
    }
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };
};

const tierStyle: Record<string, string> = {
  Platinum: "border-gold bg-gold/10 text-gold",
  Gold: "border-gold/50 bg-gold/5 text-gold",
  Standard: "border-border bg-secondary/40 text-muted-foreground",
};

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
}

export default function CustomersPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const role = localStorage.getItem("user_role");
    if (!role) {
      navigate({ to: "/login" });
    } else if (role !== "admin" && role !== "reception") {
      navigate({ to: "/availability" });
    }
  }, []);

  const { customers, rentals, loading, searchQuery, deleteCustomer } = useStore();
  const query = searchQuery.trim().toLowerCase();

  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string, name: string) {
    setDeletingId(id);
    try {
      if (deleteCustomer) await deleteCustomer(id);
      toast.success(`Client ${name} deleted`);
    } catch (error) {
      console.error(error);
      toast.error(`Failed to delete client ${name}`);
    } finally {
      setDeletingId(null);
    }
  }

  const customersWithLiveStats = useMemo(() => {
    return customers.map(c => {
      const customerRentals = rentals.filter(r => r.customerId === c.id);
      const liveTotalSpent = customerRentals.reduce((sum, r) => sum + (r.total || 0) + (r.penalty || 0), 0);
      return {
        ...c,
        rentals: customerRentals.length,
        totalSpent: liveTotalSpent
      };
    });
  }, [customers, rentals]);

  const filteredCustomers = customersWithLiveStats.filter((c) => {
    const searchable = [
      c.id,
      c.name,
      c.email,
      c.phone,
      c.tier,
      String(c.totalSpent),
      String(c.rentals),
    ]
      .join(" ")
      .toLowerCase();
    return !query || searchable.includes(query);
  });

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading clients...</div>
        </div>
      </AppShell>
    );
  }
  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-gold">Clientele</p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl">Clients</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {customers.length} members - {customers.filter((c) => c.tier === "Platinum").length} Platinum
          </p>
        </div>
        <AddCustomerDialog
          trigger={
            <Button className="bg-gold text-gold-foreground hover:bg-gold/90 self-start sm:self-auto">
              <Plus className="h-4 w-4 mr-1.5" /> Add Client
            </Button>
          }
        />
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
        {filteredCustomers.length === 0 && (
          <Card className="glass-panel p-6 text-sm text-muted-foreground sm:col-span-2 xl:col-span-3">
            No clients match your search.
          </Card>
        )}
        {filteredCustomers.map((c) => (
              <Card
                key={c.id}
                className="glass-panel transition-shadow cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={() => navigate({ to: "/customers/$customerId", params: { customerId: c.id } })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    navigate({ to: "/customers/$customerId", params: { customerId: c.id } });
                  }
                }}
              >
            <CardContent className="p-6 relative">
              <div className="flex items-start gap-4">
                <Avatar className="h-14 w-14 border border-gold/40">
                  <AvatarFallback className="bg-secondary font-display text-lg">
                    {initials(c.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display text-xl leading-tight">{c.name}</h3>
                  <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mt-0.5">
                    {c.id} - since {c.joined.slice(0, 4)}
                  </p>
                </div>
                <span
                  className={`text-[10px] uppercase tracking-[0.2em] px-2.5 py-1 rounded-full border ${tierStyle[c.tier]}`}
                >
                  {c.tier}
                </span>

                <DeleteCustomerDialog
                  customerId={c.id}
                  customerName={c.name}
                  disabled={deletingId === c.id}
                  onDelete={() => handleDelete(c.id, c.name)}
                />
              </div>

              <div className="mt-5 space-y-1.5 text-xs text-muted-foreground">
                {c.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5" /> {c.email}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5" /> {c.phone}
              </div>
              {c.secondaryPhone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5" /> {c.secondaryPhone}
                </div>
              )}
              </div>

              <div className="hairline mt-5" />
              <div className="grid grid-cols-2 mt-4">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    Lifetime
                  </p>
                  <p className="font-display text-2xl text-gold">
                    {formatCurrencyINR(c.totalSpent)}
                  </p>
                </div>
                <div className="border-l border-border pl-4">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    Rentals
                  </p>
                  <p className="font-display text-2xl">{c.rentals}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </AppShell>
  );
}

function DeleteCustomerDialog({
  customerId,
  customerName,
  disabled,
  onDelete,
}: {
  customerId: string;
  customerName: string;
  disabled: boolean;
  onDelete: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);

  const handleDelete = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    await onDelete();
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 absolute top-4 right-4"
          aria-label={`Delete client ${customerName}`}
          onClick={(e) => e.stopPropagation()}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-2xl">
            Delete client {customerName}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove this client from the database.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={disabled} onClick={(e) => e.stopPropagation()}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={disabled}
            onClick={handleDelete}
          >
            {disabled ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
