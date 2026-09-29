import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Ban, AlertTriangle, CheckCircle2, RotateCcw, Loader2 } from "lucide-react";
import { useStore } from "@/data/store";
import { formatCurrencyINR } from "@/lib/utils";
import { toast } from "sonner";
import type { Rental } from "@/data/mock";

interface CancelOrderDialogProps {
  rental: Rental;
  trigger?: React.ReactNode;
  disabled?: boolean;
  onCancelled?: () => void;
}

export function CancelOrderDialog({
  rental,
  trigger,
  disabled,
  onCancelled,
}: CancelOrderDialogProps) {
  const [open, setOpen] = useState(false);
  const [cancellationCharge, setCancellationCharge] = useState<string>("0");
  const [cancellationReason, setCancellationReason] = useState<string>("");
  const [refundPaid, setRefundPaid] = useState<boolean>(true);
  const [loading, setLoading] = useState(false);

  const { rentals, getItem, getCustomer, cancelRental } = useStore();

  // Find all sibling pieces if this is a multi-item bill
  const relatedRentals =
    rental.billNo && rental.billNo.trim() !== ""
      ? rentals.filter((r) => r.billNo === rental.billNo)
      : [rental];

  const customer = getCustomer(rental.customerId);

  // Compute total payments / advance collected for this entire bill
  let totalPaid = 0;
  for (const r of relatedRentals) {
    if (Array.isArray(r.payments) && r.payments.length > 0) {
      totalPaid += r.payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    } else if (Number(r.advance) > 0) {
      totalPaid += Number(r.advance);
    }
  }

  // Compute total rent & security value of the order
  let totalOrderValue = 0;
  for (const r of relatedRentals) {
    totalOrderValue += Number(r.total) || 0;
    totalOrderValue += Number(r.securityAmount) || 0;
  }

  const chargeNum = Math.max(0, parseFloat(cancellationCharge) || 0);
  const refundNum = Math.max(0, totalPaid - chargeNum);
  const additionalDue = Math.max(0, chargeNum - totalPaid);

  const isReturned =
    rental.status === "returned" || relatedRentals.some((r) => r.status === "returned");
  const isAlreadyCancelled = rental.status === "cancelled";

  // Returned or already cancelled orders cannot be cancelled
  if (isReturned || isAlreadyCancelled) {
    return null;
  }

  async function handleConfirmCancel() {
    if (isReturned) {
      toast.error("Returned order cannot be cancelled (वापस हो चुका ऑर्डर कैंसिल नहीं हो सकता)।");
      setOpen(false);
      return;
    }

    if (isAlreadyCancelled) {
      toast.info("This order is already cancelled.");
      setOpen(false);
      return;
    }

    setLoading(true);
    try {
      const result = await cancelRental(rental.id, {
        cancellationCharge: chargeNum,
        cancellationReason: cancellationReason.trim(),
        refundPaid,
        cancelEntireBill: true,
      });

      toast.success(
        `Order ${result.billNo} cancelled successfully. Refund: ${formatCurrencyINR(result.refundAmount)}`,
      );
      setOpen(false);
      if (onCancelled) onCancelled();
    } catch (err: any) {
      console.error("[CancelOrderDialog] Error cancelling order:", err);
      toast.error(err.message || "Failed to cancel order. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-8 w-8 border-rose-500/30 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 bg-transparent"
            disabled={disabled || isAlreadyCancelled}
            title={isAlreadyCancelled ? "Order already cancelled" : "Cancel Order"}
            aria-label="Cancel order"
          >
            <Ban className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-lg bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-500 text-lg font-serif">
            <Ban className="h-5 w-5" />
            Cancel Rental Order
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Cancel this order, apply cancellation charges, and process customer refund.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Order Info & Customer */}
          <div className="p-3 rounded-lg border border-border bg-secondary/30 space-y-1.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Order / Bill No:</span>
              <span className="font-semibold text-foreground tracking-wider">
                {rental.billNo || rental.id}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Customer:</span>
              <span className="font-medium text-foreground">
                {customer?.name || "Customer"} {customer?.phone ? `(${customer.phone})` : ""}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Pieces in Bill:</span>
              <span className="font-medium text-foreground">
                {relatedRentals.length} item{relatedRentals.length > 1 ? "s" : ""}{" "}
                (
                {relatedRentals
                  .map((r) => getItem(r.itemId)?.name || r.itemNo || r.itemId)
                  .join(", ")}
                )
              </span>
            </div>
          </div>

          {/* Financial Summary */}
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="p-3 rounded-lg border border-border bg-background">
              <div className="text-[11px] text-muted-foreground uppercase tracking-wider">
                Total Order Value
              </div>
              <div className="text-base font-bold text-foreground mt-0.5">
                {formatCurrencyINR(totalOrderValue)}
              </div>
            </div>
            <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Advance Paid So Far
              </div>
              <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {formatCurrencyINR(totalPaid)}
              </div>
            </div>
          </div>

          {/* Cancellation Charges Input */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <Label htmlFor="cancellationCharge" className="text-xs font-medium">
                Cancellation Charges (कटौती शुल्क)
              </Label>
              <div className="flex gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={() => setCancellationCharge("0")}
                >
                  ₹0 (Full Refund)
                </Button>
                {totalPaid > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                    onClick={() => setCancellationCharge(String(totalPaid))}
                  >
                    Keep All (No Refund)
                  </Button>
                )}
              </div>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold">
                ₹
              </span>
              <Input
                id="cancellationCharge"
                type="number"
                min="0"
                step="50"
                className="pl-8 text-sm"
                placeholder="0"
                value={cancellationCharge}
                onChange={(e) => setCancellationCharge(e.target.value)}
              />
            </div>
          </div>

          {/* Refund Calculation Result Banner */}
          {chargeNum <= totalPaid ? (
            <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <div className="text-xs text-muted-foreground">
                  Amount to Return to Customer (ग्राहक को रिफंड राशि):
                </div>
                <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-sans">
                  {formatCurrencyINR(refundNum)}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  (Total Paid: {formatCurrencyINR(totalPaid)} - Deducted Charge:{" "}
                  {formatCurrencyINR(chargeNum)})
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <div className="text-xs text-muted-foreground">
                  Additional Amount to Collect (अतिरिक्त शुल्क):
                </div>
                <div className="text-xl font-bold text-amber-500 font-sans">
                  {formatCurrencyINR(additionalDue)}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Cancellation charge exceeds total advance received. Refund is ₹0.
                </div>
              </div>
            </div>
          )}

          {/* Refund Paid Checkbox */}
          {refundNum > 0 && (
            <div className="flex items-center space-x-2 pt-1">
              <Checkbox
                id="refundPaid"
                checked={refundPaid}
                onCheckedChange={(checked) => setRefundPaid(Boolean(checked))}
              />
              <label
                htmlFor="refundPaid"
                className="text-xs text-foreground cursor-pointer select-none"
              >
                Refund amount handed over / returned to customer (रिफंड लौटा दिया गया है)
              </label>
            </div>
          )}

          {/* Reason */}
          <div className="space-y-1.5">
            <Label htmlFor="cancellationReason" className="text-xs font-medium">
              Cancellation Reason (रद्द करने का कारण)
            </Label>
            <Textarea
              id="cancellationReason"
              rows={2}
              placeholder="e.g., Customer postponed function / sizing issue / emergency"
              className="text-xs resize-none"
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
            />
          </div>

          <div className="text-[11px] text-muted-foreground bg-secondary/30 p-2.5 rounded border border-border/50">
            ℹ️ <strong>Note:</strong> Cancelling this order will release all{" "}
            {relatedRentals.length} piece{relatedRentals.length > 1 ? "s" : ""} back into
            inventory as <strong>Available</strong> immediately.
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={loading}
            className="text-xs"
          >
            Keep Order
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirmCancel}
            disabled={loading}
            className="text-xs bg-rose-600 hover:bg-rose-700 text-white font-medium"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cancelling...
              </>
            ) : (
              <>
                <Ban className="mr-1.5 h-4 w-4" />
                Confirm Order Cancellation
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
