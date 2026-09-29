import { useMemo, useState, useEffect } from "react";

import { AppShell } from "@/components/AppShell";
import { useStore } from "@/data/store";
import { formatCurrencyINR } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Mail, Phone, Plus, Trash2, Search, Edit2, Users, ShoppingBag } from "lucide-react";
import { AddCustomerDialog } from "@/components/forms/AddCustomerDialog";
import { EditCustomerDialog } from "@/components/forms/EditCustomerDialog";
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
  return (options: { to: string; params?: any }) => {
    let path = options.to;
    if (options.params?.customerId) {
      path = path.replace("$customerId", options.params.customerId);
    }
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
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
  const [localSearch, setLocalSearch] = useState("");
  const query = (localSearch || searchQuery || "").trim().toLowerCase();

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
    return customers.map((c) => {
      const customerRentals = rentals.filter((r) => r.customerId === c.id);
      const liveTotalSpent = customerRentals.reduce(
        (sum, r) => sum + (r.total || 0) + (r.penalty || 0),
        0,
      );
      return {
        ...c,
        rentals: customerRentals.length,
        totalSpent: liveTotalSpent,
      };
    });
  }, [customers, rentals]);

  const filteredCustomers = customersWithLiveStats.filter((c) => {
    const searchable = [
      c.id,
      c.name,
      c.email,
      c.phone,
      c.secondaryPhone,
      c.tier,
      String(c.totalSpent),
      String(c.rentals),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return !query || searchable.includes(query);
  });

  const totalClients = customers.length;
  const platinumCount = customers.filter((c) => c.tier === "Platinum").length;
  const totalLifetimeSpent = customersWithLiveStats.reduce((sum, c) => sum + c.totalSpent, 0);
  const activeRentersCount = customersWithLiveStats.filter((c) => c.rentals > 0).length;

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
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-gold font-medium">Clientele</p>
          <h1 className="mt-1 font-serif text-3xl sm:text-4xl text-foreground font-semibold">Clients</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {totalClients} members · {platinumCount} Platinum · {activeRentersCount} Active Renters
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search bar */}
          <div className="relative min-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by name, phone, email, ID..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="pl-9 h-9 text-xs bg-background/50 border-border"
            />
          </div>

          <AddCustomerDialog
            trigger={
              <Button className="bg-gold text-gold-foreground hover:bg-gold/90 h-9 text-xs font-medium">
                <Plus className="h-4 w-4 mr-1.5" /> Add Client
              </Button>
            }
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="glass-panel p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
              Total Clients
            </p>
            <p className="text-2xl font-bold font-sans text-foreground mt-1">{totalClients}</p>
          </div>
          <div className="h-10 w-10 rounded-full bg-secondary/60 flex items-center justify-center text-muted-foreground border border-border">
            <Users className="h-5 w-5" />
          </div>
        </Card>

        <Card className="glass-panel p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
              Active Renters
            </p>
            <p className="text-2xl font-bold font-sans text-foreground mt-1">{activeRentersCount}</p>
          </div>
          <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
            <ShoppingBag className="h-5 w-5" />
          </div>
        </Card>

        <Card className="glass-panel p-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
              Total Lifetime Spent
            </p>
            <p className="text-2xl font-bold font-sans text-gold mt-1">
              {formatCurrencyINR(totalLifetimeSpent)}
            </p>
          </div>
          <div className="h-10 w-10 rounded-full bg-gold/10 flex items-center justify-center text-gold border border-gold/20">
            <span className="font-bold text-sm font-sans">₹</span>
          </div>
        </Card>
      </div>

      {/* Column & Row Table */}
      <Card className="glass-panel overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table className="w-full min-w-180">
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border bg-secondary/30">
                <TableHead className="text-[10px] uppercase tracking-[0.25em] w-24">
                  Client ID
                </TableHead>
                <TableHead className="text-[10px] uppercase tracking-[0.25em]">
                  Client Name
                </TableHead>
                <TableHead className="text-[10px] uppercase tracking-[0.25em]">
                  Contact
                </TableHead>
                <TableHead className="text-[10px] uppercase tracking-[0.25em]">
                  Tier
                </TableHead>
                <TableHead className="text-[10px] uppercase tracking-[0.25em] text-right">
                  Rentals
                </TableHead>
                <TableHead className="text-[10px] uppercase tracking-[0.25em] text-right">
                  Lifetime Spent
                </TableHead>
                <TableHead className="text-[10px] uppercase tracking-[0.25em] text-right w-28">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.length === 0 && (
                <TableRow className="border-border hover:bg-transparent">
                  <TableCell
                    colSpan={7}
                    className="py-12 text-center text-sm text-muted-foreground"
                  >
                    No clients match your search.
                  </TableCell>
                </TableRow>
              )}

              {filteredCustomers.map((c) => (
                <TableRow
                  key={c.id}
                  className="border-border hover:bg-secondary/30 transition-colors"
                >
                  {/* Client ID */}
                  <TableCell className="font-mono text-xs text-muted-foreground font-medium">
                    {c.id}
                  </TableCell>

                  {/* Client Name with Avatar */}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border border-gold/40 shrink-0">
                        <AvatarFallback className="bg-secondary font-display text-xs text-foreground font-semibold">
                          {initials(c.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                          {c.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          Member since {c.joined ? c.joined.slice(0, 4) : "2026"}
                        </p>
                      </div>
                    </div>
                  </TableCell>

                  {/* Contact Info (Phone & Email) */}
                  <TableCell>
                    <div className="space-y-0.5 text-xs text-foreground">
                      <div className="flex items-center gap-1.5 font-medium">
                        <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span>{c.phone}</span>
                        {c.secondaryPhone && (
                          <span className="text-[11px] text-muted-foreground">
                            / {c.secondaryPhone}
                          </span>
                        )}
                      </div>
                      {c.email && (
                        <div className="flex items-center gap-1.5 text-muted-foreground text-[11px] truncate max-w-56">
                          <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                          <span className="truncate">{c.email}</span>
                        </div>
                      )}
                    </div>
                  </TableCell>

                  {/* Tier Badge */}
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-[0.18em] border font-medium ${tierStyle[c.tier] || tierStyle.Standard}`}
                    >
                      {c.tier}
                    </span>
                  </TableCell>

                  {/* Rentals Count */}
                  <TableCell className="text-right font-sans font-bold text-sm text-foreground">
                    {c.rentals}
                  </TableCell>

                  {/* Lifetime Spent */}
                  <TableCell className="text-right font-sans font-bold text-sm text-gold whitespace-nowrap">
                    {formatCurrencyINR(c.totalSpent)}
                  </TableCell>

                  {/* Action Buttons */}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <EditCustomerDialog
                        customer={c}
                        trigger={
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-8 w-8 border-border bg-transparent hover:bg-secondary/40 text-muted-foreground hover:text-foreground"
                            aria-label={`Edit ${c.name}`}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                        }
                        onUpdated={() => toast.success(`Client ${c.name} updated`)}
                      />

                      <DeleteCustomerDialog
                        customerId={c.id}
                        customerName={c.name}
                        disabled={deletingId === c.id}
                        onDelete={() => handleDelete(c.id, c.name)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>
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
          variant="outline"
          className="h-8 w-8 border-border bg-transparent hover:bg-destructive/10 text-muted-foreground hover:text-destructive hover:border-destructive/30"
          aria-label={`Delete client ${customerName}`}
          onClick={(e) => e.stopPropagation()}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-serif text-xl">
            Delete client {customerName}?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs">
            This will permanently remove this client from the database. Note that clients with active or upcoming bookings cannot be deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={disabled} onClick={(e) => e.stopPropagation()}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs"
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
