import { useMemo, useEffect, useState } from "react";
import { useStore } from "@/data/store";
import { Button } from "@/components/ui/button";
import { MessageCircle, Clock } from "lucide-react";
import { formatCurrencyINR } from "@/lib/utils";

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const parts = dateStr.split("T")[0].split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function today() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function getDueAmount(rental: any, allRentals: any[] = []) {
  if (rental.billNo && allRentals.length > 0) {
    const relatedRentals = allRentals.filter((r) => r.billNo === rental.billNo);
    let aggPiecesTotal = 0;
    let aggSecurity = 0;
    let aggPaid = 0;
    for (const r of relatedRentals) {
      aggPiecesTotal += Number(r.total) || 0;
      aggSecurity += Number(r.securityAmount) || 0;
      aggPaid += (r.payments || []).reduce((sum: number, p: { amount: number }) => sum + (Number(p.amount) || 0), 0);
    }
    const finalBillAmount = aggPiecesTotal + aggSecurity;
    return Math.max(0, finalBillAmount - aggPaid);
  }
  const paidAmount = (rental.payments || []).reduce((sum: number, p: { amount: number }) => sum + (Number(p.amount) || 0), 0);
  const finalBillAmount = (Number(rental.total) || 0) + (Number(rental.securityAmount) || 0);
  return Math.max(0, finalBillAmount - paidAmount);
}

export function ReturnItemsPage() {
  const { rentals, items, customers, updateRental } = useStore();
  const [role, setRole] = useState("");

  useEffect(() => {
    setRole(localStorage.getItem("user_role")?.trim().toLowerCase() || "");
  }, []);

  const canSeeFinancials = ["admin", "reception"].includes(role);

  useEffect(() => {
    const currentStr = today();
    const overdueRentals = rentals.filter((r) => {
      if (r.status !== "active") return false;
      const endStr = (r.endDate || "").slice(0, 10);
      return endStr && endStr < currentStr;
    });

    if (overdueRentals.length > 0) {
      Promise.all(overdueRentals.map(r => updateRental(r.id, { ...r, status: "overdue" })))
        .catch(err => console.error("Failed to auto-update overdue rentals", err));
    }
  }, [rentals, updateRental]);

  const returnItemsList = useMemo(() => {
    const list = rentals
      .filter((r) => r.status === "active" || r.status === "overdue")
      .map((rental) => {
        const item = items.find((i) => i.id === rental.itemId);
        const customer = customers.find((c) => c.id === rental.customerId);

        // For upcoming/active, don't recompute price/penalty.
        // For overdue, we still show the due item, but we keep stored values unchanged.
        // (Amount/balance changes should happen only in the EditRentalDialog calculations.)
        return {
          ...rental,
          customer,
          item,
          priceShown: rental.total,
        };
      });


    // Sort by end date (earliest due first)
    return list.sort(
      (a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime()
    );
  }, [rentals, items, customers]);

  const handleWhatsApp = (phone: string, name: string, itemName: string, endDate: string) => {
    const message = `Hello ${name}, ARIHANT COLLECTION  ki taraf se ek reminder! Aapka rented piece "${itemName}" return karne ki due date ${endDate} hai. Please time par return karein taaki koi penalty charges na lage. Thank you!`;
    
    // Strip non-numeric characters from the phone number for the WhatsApp URL
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-gold flex items-center gap-3">
          <Clock className="w-8 h-8" />
          Return Items
        </h1>
        <p className="text-muted-foreground mt-1">
          List of all currently rented items that need to be returned.
        </p>
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden">
        <div className="w-full overflow-x-auto">
<table className="w-full min-w-200 caption-bottom text-sm">

            <thead className="[&_tr]:border-b bg-secondary/40">
              <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Order Info</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Customer</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Phone</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Piece / Item No</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Return Date</th>
                <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground">Status</th>
                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {returnItemsList.length === 0 ? (
                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                  <td colSpan={7} className="p-4 align-middle text-center py-8 text-muted-foreground">
                    No products are currently pending for return.
                  </td>
                </tr>
              ) : (
            returnItemsList.map((rental) => {
              const dueAmount = getDueAmount(rental, rentals);
              return (
                  <tr key={rental.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                    <td className="p-4 align-middle font-medium">
                      <div>{rental.billNo || rental.id}</div>
                      {canSeeFinancials && (
                        <div className="mt-1.5 flex flex-col gap-0.5">
                      <div className={`text-xs ${dueAmount > 0 ? "text-destructive font-medium" : "text-muted-foreground font-normal"}`}>
                        Due: {formatCurrencyINR(dueAmount)}
                          </div>
                      {(rental.securityAmount || 0) > 0 && !(rental as any).securityReturned && (
                            <div className="text-xs font-medium text-amber-600">
                          Refund Security: {formatCurrencyINR(rental.securityAmount || 0)}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-4 align-middle font-semibold">{rental.customer?.name || "Unknown"}</td>
                    <td className="p-4 align-middle">{rental.customer?.phone || "N/A"}</td>
                    <td className="p-4 align-middle">
                      <div>{rental.item?.name || "Unknown"}</div>
                      <div className="text-xs text-muted-foreground">{rental.itemId}</div>
                    </td>
                    <td className="p-4 align-middle font-medium">{formatDate(rental.endDate)}</td>
                    <td className="p-4 align-middle text-center capitalize">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        rental.status === 'overdue' ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'
                      }`}>
                        {rental.status}
                      </span>
                    </td>
                    <td className="p-4 align-middle text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!rental.customer?.phone}
                        onClick={() =>
                          handleWhatsApp(
                            rental.customer!.phone,
                            rental.customer!.name,
                            rental.item?.name || "Item",
                            formatDate(rental.endDate)
                          )
                        }
                        className="gap-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                      >
                        <MessageCircle className="w-4 h-4" />
                        WhatsApp
                      </Button>
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