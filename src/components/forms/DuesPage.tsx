import { useMemo } from "react";
import { useStore } from "@/data/store";
import { formatCurrencyINR } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MessageCircle } from "lucide-react";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string) {
  if (!start || !end) return 0;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 0;
  return Math.max(1, Math.round((e - s) / 86400000));
}

export function DuesPage() {
  const { rentals, items, customers, searchQuery } = useStore();

  const duesList = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const billAggregates: Record<string, { totalWithPenalty: number; advance: number; paid: number }> = {};
    rentals.forEach(r => {
      const billNo = r.billNo || r.id;
      const item = items.find((i) => i.id === r.itemId);
      const subtotal = (r as any).rate ?? (item ? item.pricePerDay * daysBetween(r.startDate, r.endDate) : 0);
      const discount = r.discount || 0;
      const security = r.securityAmount || 0;
      const payments = (r.payments || []).reduce((sum: number, p: { amount: number }) => sum + (Number(p.amount) || 0), 0);
      
      const dynamicPenalty = (() => {
        if (r.status !== "overdue") return r.penalty || 0;
        let penalty = r.penalty || 0;
        const end = new Date(r.endDate).getTime();
        const now = new Date(today()).getTime();
        if (item && now > end) {
          const overdueDays = Math.floor((now - end) / 86400000);
          if (overdueDays > 0) penalty = Math.max(penalty, overdueDays * item.pricePerDay);
        }
        return penalty;
      })();
      
      const totalAfterDiscount = Math.max(0, subtotal - discount);
      const totalWithPenalty = totalAfterDiscount + security + dynamicPenalty;
      
      if (!billAggregates[billNo]) billAggregates[billNo] = { totalWithPenalty: 0, advance: 0, paid: 0 };
      billAggregates[billNo].totalWithPenalty += totalWithPenalty;
      billAggregates[billNo].paid += payments;
    });

    const list = rentals
      .map((rental) => {
        const billNo = rental.billNo || rental.id;
        const item = items.find((i) => i.id === rental.itemId);
        const customer = customers.find((c) => c.id === rental.customerId);
        
        let totalWithPenalty = 0;
        let finalDue = 0;
        const agg = billAggregates[billNo];

        if (rental.billNo && billAggregates[rental.billNo]) {
          const agg = billAggregates[rental.billNo];
          totalWithPenalty = agg.totalWithPenalty;
          finalDue = Math.max(0, agg.totalWithPenalty - agg.paid);
        } else {
          const subtotal = (rental as any).rate ?? (item ? item.pricePerDay * daysBetween(rental.startDate, rental.endDate) : 0);
          const discount = rental.discount || 0;
          const advance = rental.advance || 0;
          const security = rental.securityAmount || 0; 

          const dynamicPenalty = (() => {
            if (rental.status !== "overdue") return rental.penalty || 0;
            let penalty = rental.penalty || 0;
            const end = new Date(rental.endDate).getTime();
            const now = new Date(today()).getTime();
            if (item && now > end) {
              const overdueDays = Math.floor((now - end) / 86400000);
              if (overdueDays > 0) penalty = Math.max(penalty, overdueDays * item.pricePerDay);
            }
            return penalty;
          })();

          const totalAfterDiscount = Math.max(0, subtotal - discount);
          totalWithPenalty = totalAfterDiscount + security + dynamicPenalty;
          finalDue = Math.max(0, totalWithPenalty - (agg?.paid || advance));
        }

        return {
          ...rental,
          customer,
          item,
          totalWithPenalty,
          finalDue,
        };
      })
      .filter((r) => {
        if (r.finalDue <= 0) return false;
        const searchable = [
          r.id,
          r.billNo,
          r.status,
          r.startDate,
          r.endDate,
          String(r.totalWithPenalty),
          String(r.finalDue),
          r.customer?.name,
          r.customer?.phone,
          r.item?.name,
          r.item?.id,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return !query || searchable.includes(query);
      });

    // Sort by highest due amount first
    return list.sort((a, b) => b.finalDue - a.finalDue);
  }, [rentals, items, customers, searchQuery]);

  const totalBalanceDue = useMemo(() => {
    let sum = 0;
    const seenBills = new Set<string>();
    for (const due of duesList) {
      if (due.billNo) {
        if (!seenBills.has(due.billNo)) {
          seenBills.add(due.billNo);
          sum += due.finalDue;
        }
      } else {
        sum += due.finalDue;
      }
    }
    return sum;
  }, [duesList]);

  const handleWhatsApp = (phone: string, name: string, due: number, billNo: string) => {
    const message = `Hello ${name}, this is a gentle reminder from ARIHANT COLLECTION  regarding your pending balance of ${formatCurrencyINR(due)} for Bill No: ${billNo || "N/A"}. Please clear your dues at the earliest. Thank you!`;
    
    // Strip non-numeric characters from the phone number for the WhatsApp URL
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-gold">Pending Dues</h1>
        <p className="text-muted-foreground mt-1">
          List of all customers with outstanding balances and overdue penalties.
        </p>
      </div>

      {/* Total Balance Summary */}
      {duesList.length > 0 && (
        <Card className="glass-panel p-6 border border-gold/30 bg-linear-to-br from-gold/5 to-red-500/5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-semibold">
                Total Rental Balance Due
              </p>
              <p className="text-muted-foreground text-sm mt-1">
                Across {new Set(duesList.map(d => d.billNo || d.id)).size} bills
              </p>
            </div>
            <div className="text-right">
              <p className="font-display text-4xl font-bold text-red-600">
                {formatCurrencyINR(totalBalanceDue)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1">
                Requires immediate collection
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="rounded-md border border-border bg-card overflow-hidden">
        <div className="w-full overflow-x-auto">
<table className="w-full min-w-200 caption-bottom text-sm">

            <thead className="[&_tr]:border-b bg-secondary/40">
              <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Bill No</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Customer</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Phone</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Total</th>
                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Balance Due</th>
                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {duesList.length === 0 ? (
                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                  <td colSpan={7} className="p-4 align-middle text-center py-8 text-muted-foreground">
                    No pending dues found. Everyone is cleared!
                  </td>
                </tr>
              ) : (
                duesList.map((due) => (
                  <tr key={due.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                    <td className="p-4 align-middle font-medium">{due.billNo || due.id}</td>
                    <td className="p-4 align-middle">
                      <div className="font-semibold">{due.customer?.name || "Unknown"}</div>
                      <div className="text-[10px] text-muted-foreground">{due.item?.name || "Unknown item"}</div>
                    </td>
                    <td className="p-4 align-middle">{due.customer?.phone || "N/A"}</td>
                    <td className="p-4 align-middle capitalize">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        due.status === 'overdue' ? 'bg-red-500/10 text-red-500' :
                        due.status === 'active' ? 'bg-blue-500/10 text-blue-500' :
                        'bg-secondary text-secondary-foreground'
                      }`}>
                        {due.status}
                      </span>
                    </td>
                    <td className="p-4 align-middle text-right font-medium text-gold">
                      {formatCurrencyINR(due.totalWithPenalty)}
                    </td>
                    <td className="p-4 align-middle text-right font-bold text-red-500">
                      {formatCurrencyINR(due.finalDue)}
                    </td>
                    <td className="p-4 align-middle text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!due.customer?.phone}
                        onClick={() =>
                          handleWhatsApp(
                            due.customer!.phone,
                            due.customer!.name,
                            due.finalDue,
                            due.billNo || due.id
                          )
                        }
                        className="gap-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                      >
                        <MessageCircle className="w-4 h-4" />
                        WhatsApp
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
