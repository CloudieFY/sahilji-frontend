import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/data/store";
import { formatCurrencyINR, getBillRepresentative } from "@/lib/utils";
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

function getBillDueAmount(rental: any, allRentals: any[]) {
  console.log('[DeliveriesPage] getBillDueAmount called for rental:', rental.id);
  const relatedRentals = rental.billNo ? allRentals.filter((r) => r.billNo === rental.billNo) : [rental];

  let aggPiecesTotal = 0;
  let aggSecurity = 0;
  let aggDiscount = 0;
  let aggPaid = 0;

  for (const r of relatedRentals) {
    aggPiecesTotal += Number(r.total) || 0;
    aggSecurity += Number(r.securityAmount) || 0;
    aggDiscount += Number(r.discount) || 0;
    aggPaid += (r.payments || []).reduce((sum: number, p: { amount: number }) => sum + (Number(p.amount) || 0), 0);
  }

  const finalBillAmount = aggPiecesTotal + aggSecurity - aggDiscount;
  const dueAmount = Math.max(0, finalBillAmount - aggPaid);
  console.log('[DeliveriesPage] getBillDueAmount calculated:', { rentalId: rental.id, aggPiecesTotal, aggSecurity, aggDiscount, aggPaid, finalBillAmount, dueAmount });
  return dueAmount;
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
    console.log('[DeliveriesPage] Computing deliveriesList...');
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

  function buildStatusPayload(newStatus: string) {
    const payload: any = { status: newStatus };
    if (newStatus === "returned") {
      const d = new Date();
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      payload.returnedAt = d.toISOString();
    }
    return payload;
  }

  // Collects a payment (if any) at delivery/return time, then advances status.
  // A multi-item bill stores its payments on a single representative piece
  // (see getBillRepresentative). We PATCH that representative directly with the
  // combined payments array instead of patching the clicked piece and hoping the
  // backend reroutes it correctly - that indirection is what let money go missing
  // from the Edit Rental bill summary / invoice for bills with more than one item.
  const collectPaymentAndAdvanceStatus = async (
    rental: any,
    newStatus: "active" | "returned",
    messages: { collected: string; uncollected: string },
  ) => {
    const currentDue = getBillDueAmount(rental, rentals);
    const collectedEntry = window.prompt(
      `Enter amount collected now.\nTotal due: ${formatCurrencyINR(currentDue)}`,
      String(currentDue),
    );
    if (collectedEntry == null) return;

    const collectedAmount = Math.max(0, Number(collectedEntry) || 0);

    setUpdating(rental.id);
    try {
      const statusPayload = buildStatusPayload(newStatus);

      // Always record an entry for this delivery/return checkpoint, even ₹0 - the
      // Bill Summary and invoice already render every payments[] entry regardless
      // of amount, so a ₹0 entry shows as "Paid on <date> -₹0", a dated record that
      // nothing was collected at this checkpoint instead of silently omitting it.
      const relatedRentals = rental.billNo ? rentals.filter((r) => r.billNo === rental.billNo) : [rental];
      const representative = getBillRepresentative(relatedRentals) ?? rental;
      const existingPayments = relatedRentals.flatMap((r) => r.payments || []);
      const combinedPayments = [...existingPayments, { amount: collectedAmount, date: today() }];
      const combinedAdvance = combinedPayments.reduce((sum: number, p: { amount: number }) => sum + (Number(p.amount) || 0), 0);

      if (representative.id === rental.id) {
        // The clicked piece IS the bill representative - one combined update.
        await updateRental(rental.id, { ...statusPayload, payments: combinedPayments, advance: combinedAdvance });
      } else {
        // These two writes touch different documents (the representative's
        // payments, this piece's status) with no dependency between them - run
        // them in parallel instead of waiting on one round trip before starting
        // the next.
        await Promise.all([
          updateRental(representative.id, { payments: combinedPayments, advance: combinedAdvance }),
          updateRental(rental.id, statusPayload),
        ]);
      }

      toast.success(collectedAmount > 0 ? messages.collected : messages.uncollected);
    } catch (err) {
      toast.error("Failed to update status. See console for details.");
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
              const dueAmount = getBillDueAmount(rental, rentals);
              const relatedRentals = rental.billNo ? rentals.filter(r => r.billNo === rental.billNo) : [rental];
              const billSecurityAmount = relatedRentals.reduce((sum, r) => sum + (Number(r.securityAmount) || 0), 0);
              const isSecurityReturned = relatedRentals.some(r => (r as any).securityReturned);

              return (
                  <tr key={rental.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                    <td className="p-4 align-middle font-medium">
                      <div>{rental.billNo || rental.id}</div>
                      {canSeeFinancials && (
                        <div className="mt-1.5 flex flex-col gap-0.5">
                          <div className={`text-xs ${dueAmount > 0 ? "text-destructive font-medium" : "text-muted-foreground font-normal"}`}>
                            Due: {formatCurrencyINR(dueAmount)}
                          </div>
                          {billSecurityAmount > 0 && !isSecurityReturned && (
                            <div className="text-xs font-medium text-amber-600">
                              Refund Security: {formatCurrencyINR(billSecurityAmount)}
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

                            collectPaymentAndAdvanceStatus(rental, "active", {
                              collected: "Delivery status updated successfully!",
                              uncollected: "Delivery status updated successfully!",
                            });
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
                            collectPaymentAndAdvanceStatus(rental, "returned", {
                              collected: "Amount collected and product marked as returned.",
                              uncollected: "Product marked as returned!",
                            });
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
