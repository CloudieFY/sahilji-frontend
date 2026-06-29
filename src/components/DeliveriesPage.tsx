import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/data/store";
import { formatCurrencyINR } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Package, CheckCircle, Calendar, ArrowDownLeft, Search } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function today() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const parts = dateStr.split("T")[0].split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function getDueAmount(rental: any, allRentals: any[] = []) {
  if (rental.billNo && allRentals.length > 0) {
    const relatedRentals = allRentals.filter((r) => r.billNo === rental.billNo);
    let aggTotal = 0;
    let aggAdvance = 0;
    for (const r of relatedRentals) {
      aggTotal += (Number(r.total) || 0) + (Number(r.securityAmount) || 0) + (Number(r.penalty) || 0) - (Number(r.discount) || 0);
      aggAdvance += Number(r.advance) || 0;
    }
    return Math.max(0, aggTotal - aggAdvance);
  }
  return Math.max(
    0,
    (Number(rental.total) || 0) +
      (Number(rental.securityAmount) || 0) +
      (Number(rental.penalty) || 0) -
      (Number(rental.discount) || 0) -
      (Number(rental.advance) || 0),
  );
}

export function DeliveriesPage() {
  const { rentals, items, customers, updateRental } = useStore();
  const storedRole = typeof window !== 'undefined' ? localStorage.getItem("user_role")?.trim().toLowerCase() || "" : "";
  const [role, setRole] = useState(storedRole);
  const [selectedDate, setSelectedDate] = useState(() => today());
  const [statusFilter, setStatusFilter] = useState("all");
  const [localSearch, setLocalSearch] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const canUpdateDeliveries = ["admin", "reception"].includes(role);
  const canSeeFinancials = ["admin", "reception"].includes(role);

  useEffect(() => {
    if (!role) {
      setRole(localStorage.getItem("user_role")?.trim().toLowerCase() || "");
    }
  }, [role]);

  const deliveriesList = useMemo(() => {
    const query = localSearch.trim().toLowerCase();
    const targetStr = selectedDate.slice(0, 10);
    return rentals
      .filter((r) => {
        const startStr = (r.deliveryDate || r.startDate || "").slice(0, 10);
        const endStr = (r.endDate || "").slice(0, 10);
        const actualReturnStr = ((r as any).returnedAt || (r as any).updatedAt || r.endDate || "").slice(0, 10);
        
        if (statusFilter !== "all" && r.status !== statusFilter) return false;
        
        if (statusFilter === "returned") {
          return targetStr === endStr || targetStr === actualReturnStr;
        }
        
        if (r.status === "returned") {
          return targetStr === startStr || targetStr === endStr || targetStr === actualReturnStr;
        }
        
        const fallsWithin = targetStr >= startStr && targetStr <= endStr;
        const isPendingAction = endStr < targetStr;
        
        return fallsWithin || isPendingAction;
      })
      .map((rental) => {
        const item = items.find((i) => i.id === rental.itemId);
        const customer = customers.find((c) => c.id === rental.customerId);
        return { ...rental, customer, item };
      })
      .filter((r) => {
        if (!query) return true;
        const searchable = [
          r.billNo,
          r.itemNo,
          r.itemId,
          r.id,
          r.customer?.name,
          r.customer?.phone
        ].filter(Boolean).join(" ").toLowerCase();
        return searchable.includes(query);
      });
  }, [rentals, items, customers, selectedDate, statusFilter, localSearch]);

  const handleStatusUpdate = async (rental: any, newStatus: string, message: string) => {
    setUpdating(rental.id);
    try {
      const payload: any = { status: newStatus };
      if (typeof rental.advance === "number") {
        payload.advance = rental.advance;
      }
      if (newStatus === "returned") {
        const d = new Date();
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        payload.returnedAt = d.toISOString();
        if (rental.securityReturned) {
          payload.securityReturned = true;
        }
        if (rental.securityReturnedAt) {
          payload.securityReturnedAt = rental.securityReturnedAt;
        }
      }

      await updateRental(rental.id, payload);
      toast.success(message);
    } catch (err) {
      toast.error("Failed to update status.");
      console.error(err);
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="p-0 sm:p-2 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-gold">Logistics</p>
          <h1 className="mt-2 text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <Package className="w-8 h-8 text-gold" />
            Deliveries & Returns
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {canUpdateDeliveries
              ? "Manage product deliveries, active rentals, and returns for the selected date."
              : "View product deliveries, active rentals, and returns for the selected date."}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-48">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search bill, item no..." 
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="pl-9 w-full bg-card border-border"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-35 bg-card border-border">
              <SelectValue placeholder="Filter Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="returned">Returned</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative w-full sm:w-40 shrink-0">
            <Input value={formatDate(selectedDate)} readOnly className="pr-8 bg-card border-border" />
            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              onClick={(e) => {
                try {
                  (e.target as HTMLInputElement).showPicker?.();
                } catch (err) {}
              }}
              className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
        </div>
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden">
        <div className="w-full overflow-x-auto">
<table className="w-full min-w-200 caption-bottom text-sm">

            <thead className="[&_tr]:border-b bg-secondary/40">
              <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Order Info</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Customer</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Piece / Item No</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Dates</th>
                <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground">Status</th>
                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {deliveriesList.length === 0 ? (
                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                  <td colSpan={6} className="p-4 align-middle text-center py-8 text-muted-foreground">
                    No deliveries scheduled for this date.
                  </td>
                </tr>
              ) : (
            deliveriesList.map((rental) => {
              const dueAmount = getDueAmount(rental, rentals);
              return (
                  <tr key={rental.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                    <td className="p-4 align-middle font-medium">
                      <div>{rental.billNo || rental.id}</div>
                      {canSeeFinancials && (
                        <div className="mt-1.5 flex flex-col gap-0.5">
                      <div className={`text-xs ${rental.status !== 'active' && dueAmount > 0 ? "text-destructive font-medium" : "text-muted-foreground font-normal"}`}>
                        Due: {formatCurrencyINR(rental.status === 'active' ? 0 : dueAmount)}
                          </div>
                      {(rental.securityAmount || 0) > 0 && !(rental as any).securityReturned && (
                            <div className="text-xs font-medium text-amber-600">
                          Refund Security: {formatCurrencyINR(rental.securityAmount || 0)}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-4 align-middle">
                      <div className="font-semibold">{rental.customer?.name || "Unknown"}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{rental.customer?.phone}</div>
                    </td>
                    <td className="p-4 align-middle">
                      <div className="font-medium text-foreground line-clamp-1">{rental.item?.name || "Unknown"}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{rental.itemNo || rental.itemId}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(rental as any).remarkCompleted ? (
                          <span className="inline-block text-[9px] font-medium tracking-wide text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">Fitting Ready</span>
                        ) : (
                          <span className="inline-block text-[9px] font-medium tracking-wide text-orange-600 bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 rounded">Fitting Pending</span>
                        )}
                        {(rental as any).drycleanCompleted ? (
                          <span className="inline-block text-[9px] font-medium tracking-wide text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">Dryclean Ready</span>
                        ) : (
                          <span className="inline-block text-[9px] font-medium tracking-wide text-orange-600 bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 rounded">Dryclean Pending</span>
                        )}
                        {(rental as any).adminReconfirmed && (
                          <span className="inline-block text-[9px] font-medium tracking-wide text-blue-600 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.5 rounded">Admin Rechecked: {(rental as any).adminReconfirmedBy}</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 align-middle">
                      <div className="whitespace-nowrap">Del: {formatDate(rental.deliveryDate || rental.startDate)}</div>
                      {rental.status === "returned" ? (
                        <div className="text-xs text-emerald-500 font-medium whitespace-nowrap mt-0.5">
                          Returned: {formatDate(((rental as any).returnedAt || (rental as any).updatedAt || rental.endDate).slice(0, 10))}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground whitespace-nowrap mt-0.5">Ret: {formatDate(rental.endDate)}</div>
                      )}
                    </td>
                    <td className="p-4 align-middle text-center">
                      <StatusBadge status={rental.status} kind="rental" />
                    </td>
                    <td className="p-4 align-middle text-right">
                      {!canUpdateDeliveries && (
                        <Button size="sm" variant="outline" disabled>
                          View Only
                        </Button>
                      )}
                      {canUpdateDeliveries && rental.status === "upcoming" && (
                        <Button
                          size="sm"
                          disabled={updating === rental.id}
                          onClick={() => {
                            const isFittingPending = !(rental as any).remarkCompleted;
                            const isDrycleanPending = !(rental as any).drycleanCompleted;

                            if (isFittingPending || isDrycleanPending) {
                              const pendingTasks = [];
                              if (isFittingPending) pendingTasks.push("Fitting");
                              if (isDrycleanPending) pendingTasks.push("Dryclean");
                              
                              window.alert(`Cannot deliver: Item is not ready.\n\nPending: ${pendingTasks.join(" and ")}`);
                              return;
                            }

                            const relatedRentals = rental.billNo ? rentals.filter((r) => r.billNo === rental.billNo) : [rental];
                            let aggRent = 0;
                            let aggSecurity = 0;
                            let aggAdvance = 0;
                            for (const r of relatedRentals) {
                              aggRent += (Number(r.total) || 0) + (Number(r.penalty) || 0) - (Number(r.discount) || 0);
                              aggSecurity += Number(r.securityAmount) || 0;
                              aggAdvance += Number(r.advance) || 0;
                            }
                            const totalBill = aggRent + aggSecurity;
                            const balance = rental.status === "active" ? 0 : Math.max(0, totalBill - aggAdvance);
                            
                            let msg = `Are you sure you want to deliver this product?\n\n`;
                            msg += `Payment Summary:\n`;
                            msg += `• Total Rent: ${formatCurrencyINR(aggRent)}\n`;
                            if (aggSecurity > 0) msg += `• Security Deposit: ${formatCurrencyINR(aggSecurity)}\n`;
                            msg += `• Total Bill: ${formatCurrencyINR(totalBill)}\n`;
                            msg += `• Amount Paid: ${formatCurrencyINR(aggAdvance)}\n`;
                            msg += `• Balance Due: ${formatCurrencyINR(balance)}\n`;
                            
                            if (balance > 0) {
                              msg += `\nIs all amount paid? Clicking OK will mark as delivered and clear the balance.`;
                            }
                            
                            const confirmed = window.confirm(msg);
                            if (confirmed) {
                              const updates: any = {};
                              if (balance > 0) {
                                updates.advance = (rental.advance || 0) + balance;
                              }
                              handleStatusUpdate({ ...rental, ...updates }, "active", "Product marked as delivered (Active)!");
                            }
                          }}
                          className={(!(rental as any).remarkCompleted || !(rental as any).drycleanCompleted) ? "bg-orange-500 hover:bg-orange-600 text-white gap-2" : "bg-emerald-500 hover:bg-emerald-600 text-white gap-2"}
                        >
                          <CheckCircle className="w-4 h-4" />
                          {updating === rental.id ? "Activating..." : (!(rental as any).remarkCompleted || !(rental as any).drycleanCompleted) ? "Not Ready" : "Deliver"}
                        </Button>
                      )}
                      {canUpdateDeliveries && (rental.status === "active" || rental.status === "overdue") && (
                        <Button
                          size="sm"
                          disabled={updating === rental.id}
                          onClick={() => {
                            const relatedRentals = rental.billNo ? rentals.filter((r) => r.billNo === rental.billNo) : [rental];
                            let aggRent = 0;
                            let aggSecurity = 0;
                            let aggAdvance = 0;
                            for (const r of relatedRentals) {
                              aggRent += (Number(r.total) || 0) + (Number(r.penalty) || 0) - (Number(r.discount) || 0);
                              aggSecurity += Number(r.securityAmount) || 0;
                              aggAdvance += Number(r.advance) || 0;
                            }
                            const totalBill = aggRent + aggSecurity;
                            const balance = Math.max(0, totalBill - aggAdvance);
                            const securityToRefund = (rental.securityAmount || 0) > 0 && !(rental as any).securityReturned ? rental.securityAmount : 0;
                            
                            let msg = `Are you sure you want to mark this product as returned?\n\n`;
                            msg += `Payment Summary:\n`;
                            msg += `• Total Rent: ${formatCurrencyINR(aggRent)}\n`;
                            if (aggSecurity > 0) msg += `• Security Deposit: ${formatCurrencyINR(aggSecurity)}\n`;
                            msg += `• Total Bill: ${formatCurrencyINR(totalBill)}\n`;
                            msg += `• Amount Paid: ${formatCurrencyINR(aggAdvance)}\n`;
                            msg += `• Balance Due: ${formatCurrencyINR(balance)}\n`;
                            
                            if (balance > 0) {
                              msg += `\nPending Balance to collect: ${formatCurrencyINR(balance)}`;
                            }
                            if (securityToRefund > 0) {
                              msg += `\nSecurity Deposit to refund: ${formatCurrencyINR(securityToRefund)}`;
                            }
                            msg += `\n\nAre all dues (balance & security) clear? Clicking OK will update and clear the amounts.`;

                            const confirmed = window.confirm(msg);
                            if (confirmed) {
                              const updates: any = {};
                              if (balance > 0) {
                                updates.advance = (rental.advance || 0) + balance;
                              }
                              if (securityToRefund > 0) {
                                updates.securityReturned = true;
                                updates.securityReturnedAt = new Date().toISOString();
                              }
                              handleStatusUpdate({ ...rental, ...updates }, "returned", "Product marked as returned!");
                            }
                          }}
                          className="bg-blue-500 hover:bg-blue-600 text-white gap-2"
                        >
                          <ArrowDownLeft className="w-4 h-4" />
                          {updating === rental.id ? "Updating..." : "Return"}
                        </Button>
                      )}
                      {canUpdateDeliveries && rental.status === "returned" && (
                        <Button size="sm" variant="outline" disabled>
                          Returned
                        </Button>
                      )}
                    </td>
                  </tr>
            );
            })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
