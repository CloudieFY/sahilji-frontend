import { useState, useEffect } from "react";


import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { useStore } from "@/data/store";
import { formatCurrencyINR } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Edit2, Plus, Trash2, Search } from "lucide-react";
import { EditRentalDialog } from "@/components/forms/EditRentalDialog";
import { NewRentalDialog } from "@/components/forms/NewRentalDialog";
import { toast } from "sonner";

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const parts = dateStr.split("T")[0].split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// Custom lightweight navigation hook
const useNavigate = () => {
  return (options: { to: string }) => {
    window.history.pushState({}, '', options.to);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };
};

function getBillDueAmount(rentalsList: any[], allRentals: any[] = []) {
  const relatedRentals = rentalsList.length > 0 && rentalsList[0]?.billNo && allRentals.length > 0
    ? allRentals.filter((r) => r.billNo === rentalsList[0].billNo)
    : rentalsList;

  // Sum the total for each piece (which includes discounts and penalties).
  // Security and payments are bill-level.
  let aggPiecesTotal = 0;
  let aggSecurity = 0;
  let aggDiscount = 0;
  let aggPaid = 0;

  for (const r of relatedRentals) {
    aggPiecesTotal += Number((r as any).total) || 0;
    aggSecurity += Number((r as any).securityAmount) || 0;
    aggDiscount += Number((r as any).discount) || 0;
    aggPaid += (r.payments || []).reduce((sum: number, p: { amount: number }) => sum + (Number(p.amount) || 0), 0);
  }

  const finalBillAmount = aggPiecesTotal + aggSecurity - aggDiscount;
  return Math.max(0, finalBillAmount - aggPaid);
}


export default function RentalsPage() {

  const navigate = useNavigate();
  const role = typeof window !== 'undefined' ? localStorage.getItem("user_role") : null;

  useEffect(() => {
    if (!role) {
      navigate({ to: "/login" });
    } else if (role !== "admin" && role !== "reception") {
      navigate({ to: "/availability" });
    }
  }, [role]);

  const { rentals, getItem, getCustomer, loading, deleteRental, searchQuery } = useStore();

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [localSearch, setLocalSearch] = useState("");
  const query = (localSearch || searchQuery || "").trim().toLowerCase();

  const filteredRentals = rentals.filter((r) => {
    const item = getItem(r.itemId);
    const customer = getCustomer(r.customerId);
    const dueAmount = getBillDueAmount([r], rentals);
    const searchable = [
      r.id,
      r.billNo,
      r.itemNo,
      r.status,
      r.startDate,
      r.endDate,
      r.deliveryDate,
      String(r.total),
      String(dueAmount),
      String(r.discount),
      String(r.advance),
      String(r.securityAmount),
      r.remark,
      item?.id,
      item?.name,
      item?.designer,
      item?.category,
      item?.color,
      customer?.id,
      customer?.name,
      customer?.email,
      customer?.phone,
      customer?.tier,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return !query || searchable.includes(query);
  });

  const groupedBills = Array.from(
    filteredRentals.reduce((groups, rental) => {
      const key = rental.billNo ? rental.billNo : rental.id;
      const existing = groups.get(key);
      if (existing) {
        existing.rentals.push(rental);
      } else {
        groups.set(key, {
          key,
          rentals: [rental],
          representative: rental,
        });
      }
      return groups;
    }, new Map<string, { key: string; rentals: typeof rentals; representative: (typeof rentals)[number] }>()).values(),
  );

  const getUniqueBillBalances = (billsList: typeof groupedBills) => {
    return billsList.reduce((total, bill) => total + getBillDueAmount(bill.rentals, rentals), 0);
  };

  // Calculate balance summary
  const balanceSummary = {
    active: getUniqueBillBalances(groupedBills.filter((bill) => bill.representative.status === "active")),
    upcoming: getUniqueBillBalances(groupedBills.filter((bill) => bill.representative.status === "upcoming")),
    overdue: getUniqueBillBalances(groupedBills.filter((bill) => bill.representative.status === "overdue")),
    returned: getUniqueBillBalances(groupedBills.filter((bill) => bill.representative.status === "returned")),
    total: getUniqueBillBalances(groupedBills),
  };

  async function handleDelete(id: string, billNo?: string) {
    console.info("[RentalsPage] delete requested", { id });
    setDeletingId(id);
    try {
      await deleteRental(id, billNo);
      toast.success(`Order ${billNo || id} deleted`);
      console.info("[RentalsPage] delete success", { id });
    } catch (error) {
      console.error("[RentalsPage] delete failed", { id, error });
      toast.error(`Failed to delete order ${billNo || id}`);
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading rentals...</div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-gold">Ledger</p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl">Rentals</h1>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto mt-4 sm:mt-0">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search bill no, item no..." 
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="pl-9 w-full bg-card border-border"
            />
          </div>
          <NewRentalDialog
            trigger={
              <Button className="bg-gold text-gold-foreground hover:bg-gold/90 self-start sm:self-auto w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-1.5" /> New Rental
              </Button>
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {(["active", "upcoming", "returned"] as const).map((k) => (
          <Card key={`balance-${k}`} className="glass-panel p-4 sm:p-5 border-gold/20">
            <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              {k} Balance
            </p>
            <p className={`font-display text-lg sm:text-2xl mt-2 ${balanceSummary[k] > 0 ? "text-red-500" : "text-emerald-500"}`}>
              {formatCurrencyINR(balanceSummary[k])}
            </p>
          </Card>
        ))}
        <Card className="glass-panel p-4 sm:p-5 border border-gold/30 bg-gold/5 col-span-2 lg:col-span-1">
          <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.25em] text-gold font-semibold">
            Total Balance
          </p>
          <p className={`font-display text-2xl sm:text-3xl mt-2 font-bold ${balanceSummary.total > 0 ? "text-red-600" : "text-emerald-600"}`}>
            {formatCurrencyINR(balanceSummary.total)}
          </p>
        </Card>
      </div>

      {/* Mobile: card list */}
      <div className="space-y-3 sm:hidden">
        {groupedBills.length === 0 && (
          <Card className="glass-panel p-4 text-sm text-muted-foreground">
            {query
              ? "No rented items match your search."
              : "No rented items found. Create a rental to show it here."}
          </Card>
        )}
        {groupedBills.map((bill) => {
          const r = bill.representative;
          const item = getItem(r.itemId);
          const customer = getCustomer(r.customerId);
          const dueAmount = getBillDueAmount(bill.rentals, rentals);
          const itemNames = bill.rentals
            .map((entry) => getItem(entry.itemId)?.name || entry.itemNo || entry.itemId)
            .filter(Boolean);
          const itemLabel = itemNames.length > 1
            ? `${itemNames[0]} +${itemNames.length - 1} more`
            : itemNames[0] || "Unknown item";
          return (
            <Card key={bill.key} className="glass-panel p-4">
              <div className="flex items-start gap-3">
                {item ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    width={48}
                    height={64}
                    loading="lazy"
                    className="h-16 w-12 object-cover rounded-sm border border-border shrink-0"
                  />
                ) : (
                  <div className="h-16 w-12 rounded-sm border border-border bg-secondary shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-display text-base leading-tight truncate">
                        {item ? `${item.id} - ${item.name}` : `Missing piece (${r.itemId || "unknown"})`}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {bill.rentals.length > 1 ? `${bill.rentals.length} items in bill · ${itemLabel}` : item?.designer ?? "Piece details unavailable"}
                      </p>
                    </div>
                    <StatusBadge status={r.status} kind="rental" />
                  </div>
                  <div className="hairline mt-3" />
                  <div className="mt-2.5 flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        {r.billNo || r.id} - {customer?.name ?? `Missing client (${r.customerId || "unknown"})`}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {formatDate(r.startDate)} to {formatDate(r.endDate)}{bill.rentals.length > 1 ? ` · ${bill.rentals.length} items` : ""}
                      </p>
                    </div>
                    <p className="font-display text-xl text-gold shrink-0">
                      {formatCurrencyINR(bill.rentals.reduce((sum, entry) => sum + (Number(entry.total) || 0), 0))}
                    </p>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between gap-3 text-xs">
                    <span className="text-muted-foreground">Due Amount</span>
                    <span className={dueAmount > 0 ? "font-semibold text-destructive" : "font-semibold text-emerald-500"}>
                      {formatCurrencyINR(dueAmount)}
                    </span>
                  </div>
                  <div className="mt-3 flex justify-end items-center gap-2">
                    <EditRentalDialog
                      rental={r}
                      trigger={
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="h-8 w-8 border-border bg-transparent hover:bg-secondary/30"
                          aria-label={`Edit rental ${r.id}`}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      }
                      disabled={deletingId === r.id}
                      onUpdated={() => {
                        toast.success(`Rental ${r.id} updated`);
                      }}
                    />
                    <DeleteRentalDialog
                      rentalId={r.id}
                      billNo={r.billNo}
                      disabled={deletingId === r.id}
                      onDelete={() => handleDelete(r.id, r.billNo)}
                    />
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Tablet/desktop: table */}
      <Card className="glass-panel overflow-hidden p-0 hidden sm:block">
        <div className="overflow-x-auto">
        <Table className="w-full min-w-200">
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border">
              <TableHead className="text-[10px] uppercase tracking-[0.25em]">
                Order
              </TableHead>
              <TableHead className="text-[10px] uppercase tracking-[0.25em]">
                Piece
              </TableHead>
              <TableHead className="text-[10px] uppercase tracking-[0.25em]">
                Client
              </TableHead>
              <TableHead className="text-[10px] uppercase tracking-[0.25em]">
                Dates
              </TableHead>
              <TableHead className="text-[10px] uppercase tracking-[0.25em] text-right">
                Total
              </TableHead>
              <TableHead className="text-[10px] uppercase tracking-[0.25em] text-right">
                Due
              </TableHead>
              <TableHead className="text-[10px] uppercase tracking-[0.25em] text-right">
                Status
              </TableHead>
              <TableHead className="text-[10px] uppercase tracking-[0.25em] text-right">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groupedBills.length === 0 && (
              <TableRow className="border-border hover:bg-transparent">
                <TableCell
                  colSpan={8}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No rented items match your search.
                </TableCell>
              </TableRow>
            )}
            {groupedBills.map((bill) => {
              const r = bill.representative;
              const item = getItem(r.itemId);
              const customer = getCustomer(r.customerId);
              const dueAmount = getBillDueAmount(bill.rentals, rentals);
              const itemNames = bill.rentals
                .map((entry) => getItem(entry.itemId)?.name || entry.itemNo || entry.itemId)
                .filter(Boolean);
              const itemLabel = itemNames.length > 1
                ? `${itemNames[0]} +${itemNames.length - 1} more`
                : itemNames[0] || "Unknown item";
              return (
                <TableRow
                  key={bill.key}
                  className="border-border hover:bg-secondary/30 cursor-pointer"
                >
                  <TableCell className="text-xs text-muted-foreground tracking-wider">
                    {r.billNo || r.id}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {item ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          width={40}
                          height={52}
                          loading="lazy"
                          className="h-12 w-9 object-cover rounded-sm border border-border"
                        />
                      ) : (
                        <div className="h-12 w-9 rounded-sm border border-border bg-secondary" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm truncate">
                          {item ? `${item.id} - ${item.name}` : `Missing piece (${r.itemId || "unknown"})`}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {bill.rentals.length > 1 ? `${bill.rentals.length} items in bill · ${itemLabel}` : item?.designer ?? "Piece details unavailable"}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {customer?.name ?? `Missing client (${r.customerId || "unknown"})`}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(r.startDate)}
                    <br />to {formatDate(r.endDate)}
                  </TableCell>
                  <TableCell className="text-right font-display text-lg whitespace-nowrap text-gold">
                    {formatCurrencyINR(bill.rentals.reduce((sum, entry) => sum + (Number(entry.total) || 0), 0))}
                  </TableCell>
                  <TableCell className={`text-right font-display text-lg whitespace-nowrap ${dueAmount > 0 ? "text-destructive" : "text-emerald-500"}`}>
                    {formatCurrencyINR(dueAmount)}
                  </TableCell>
                  <TableCell className="text-right">
                    <StatusBadge status={r.status} kind="rental" />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <EditRentalDialog
                        rental={r}
                        trigger={
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-8 w-8 border-border bg-transparent hover:bg-secondary/30"
                            aria-label={`Edit rental ${r.id}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        }
                        disabled={deletingId === r.id}
                        onUpdated={() => toast.success(`Rental ${r.id} updated`)}
                      />
                      <DeleteRentalDialog
                        rentalId={r.id}
                        billNo={r.billNo}
                        disabled={deletingId === r.id}
                        onDelete={() => handleDelete(r.id, r.billNo)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </div>
      </Card>
    </AppShell>
  );
}

function DeleteRentalDialog({
  rentalId,
  billNo,
  disabled,
  onDelete,
}: {
  rentalId: string;
  billNo?: string;
  disabled: boolean;
  onDelete: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);


  const handleDelete = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault();
    await onDelete();
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="destructive"
          className="h-8 w-8 bg-destructive/90 text-destructive-foreground hover:bg-destructive"
          aria-label={`Delete rental ${rentalId}`}
          onClick={(e) => e.stopPropagation()}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-2xl">
            Delete order {billNo || rentalId}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will remove this rented item record from the rentals ledger.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={disabled}>Cancel</AlertDialogCancel>
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
