import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { useStore } from "@/data/store";
import { formatCurrencyINR } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { ArrowLeft, Mail, Phone, Pencil, Trash2, CalendarDays } from "lucide-react";
import { EditCustomerDialog } from "@/components/forms/EditCustomerDialog";
import { toast } from "sonner";

const useNavigate = () => {
  return (to: string) => {
    window.history.pushState({}, "", to);
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

function formatDate(dateStr?: string) {
  if (!dateStr) return "—";
  const iso = String(dateStr).split("T")[0];
  const parts = iso.split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export default function CustomerDetailPage({ id }: { id: string }) {
  const navigate = useNavigate();

  useEffect(() => {
    const role = localStorage.getItem("user_role");
    if (!role) navigate("/login");
    else if (role !== "admin" && role !== "reception") navigate("/availability");
  }, []);

  const { customers, rentals, loading, getItem, deleteCustomer } = useStore();
  const [deleting, setDeleting] = useState(false);

  const customer = useMemo(
    () => customers.find((c) => c.id === id),
    [customers, id],
  );

  const customerRentals = useMemo(
    () =>
      rentals
        .filter((r) => r.customerId === id)
        .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")),
    [rentals, id],
  );

  const liveStats = useMemo(() => {
    const totalSpent = customerRentals.reduce(
      (sum, r) => sum + (r.total || 0) + (r.penalty || 0),
      0,
    );
    return { totalSpent, count: customerRentals.length };
  }, [customerRentals]);

  async function handleDelete() {
    if (!customer) return;
    setDeleting(true);
    try {
      await deleteCustomer(customer.id);
      toast.success(`Client ${customer.name} deleted`);
      navigate("/customers");
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : "Failed to delete client";
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          Loading client...
        </div>
      </AppShell>
    );
  }

  if (!customer) {
    return (
      <AppShell>
        <button
          onClick={() => navigate("/customers")}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to clients
        </button>
        <Card className="glass-panel mt-6 p-6 text-sm text-muted-foreground">
          No client found for <span className="font-mono">{id}</span>.
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <button
        onClick={() => navigate("/customers")}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" /> Back to clients
      </button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <Avatar className="h-16 w-16 border border-gold/40">
            <AvatarFallback className="bg-secondary font-display text-xl">
              {initials(customer.name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="font-display text-3xl leading-tight">{customer.name}</h1>
            <p className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground mt-1">
              {customer.id} - since {String(customer.joined || "").slice(0, 4) || "—"}
            </p>
            <span
              className={`inline-block mt-2 text-[10px] uppercase tracking-[0.2em] px-2.5 py-1 rounded-full border ${tierStyle[customer.tier]}`}
            >
              {customer.tier}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <EditCustomerDialog
            customer={customer}
            trigger={
              <Button variant="outline" className="gap-1.5">
                <Pencil className="h-4 w-4" /> Edit
              </Button>
            }
          />
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                className="gap-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="font-display text-2xl">
                  Delete client {customer.name}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This permanently removes the client. Clients with open rentals cannot be
                  deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={deleting}
                  onClick={(e) => {
                    e.preventDefault();
                    handleDelete();
                  }}
                >
                  {deleting ? "Deleting..." : "Delete"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Details grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 mt-8">
        <Card className="glass-panel">
          <CardContent className="p-5 space-y-3">
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              Contact
            </p>
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground" />
              {customer.email ? (
                <a href={`mailto:${customer.email}`} className="hover:underline break-all">
                  {customer.email}
                </a>
              ) : (
                <span className="text-muted-foreground">No email</span>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <a href={`tel:${customer.phone}`} className="hover:underline">
                {customer.phone}
              </a>
            </div>
            {customer.secondaryPhone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a href={`tel:${customer.secondaryPhone}`} className="hover:underline">
                  {customer.secondaryPhone}
                </a>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span>Joined {formatDate(customer.joined)}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardContent className="p-5">
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              Lifetime value
            </p>
            <p className="font-display text-3xl text-gold mt-2">
              {formatCurrencyINR(liveStats.totalSpent)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Stored: {formatCurrencyINR(customer.totalSpent || 0)}
            </p>
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardContent className="p-5">
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              Rentals
            </p>
            <p className="font-display text-3xl mt-2">{liveStats.count}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Stored: {customer.rentals || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Rental history */}
      <div className="mt-10">
        <h2 className="font-display text-xl mb-3">Rental history</h2>
        <Card className="glass-panel overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Bill</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customerRentals.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                      No rentals yet for this client.
                    </TableCell>
                  </TableRow>
                )}
                {customerRentals.map((r) => {
                  const item = getItem(r.itemId);
                  return (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer"
                      onClick={() => navigate("/rentals")}
                    >
                      <TableCell className="font-medium whitespace-nowrap">
                        {r.billNo || r.id}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {item?.name || r.itemNo || r.itemId || "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(r.startDate)}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(r.endDate)}</TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} kind="rental" />
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        {formatCurrencyINR((r.total || 0) + (r.penalty || 0))}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
