import { useState, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Ban, AlertTriangle, CheckCircle2, Loader2, Layers, Shirt } from "lucide-react";
import { useStore } from "@/data/store";
import { formatCurrencyINR } from "@/lib/utils";
import { toast } from "sonner";
import type { Rental } from "@/data/mock";

interface CancelOrderDialogProps {
  rental: Rental;
  targetPieceId?: string;
  trigger?: React.ReactNode;
  disabled?: boolean;
  onCancelled?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function CancelOrderDialog({
  rental,
  targetPieceId,
  trigger,
  disabled,
  onCancelled,
  open: controlledOpen,
  onOpenChange,
}: CancelOrderDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (newOpen: boolean) => {
    if (isControlled) {
      onOpenChange?.(newOpen);
    } else {
      setInternalOpen(newOpen);
    }
  };

  const { rentals, getItem, getCustomer, cancelRental } = useStore();

  // Find all sibling pieces if this is a multi-item bill
  const relatedRentals =
    rental.billNo && rental.billNo.trim() !== ""
      ? rentals.filter((r) => r.billNo === rental.billNo)
      : [rental];

  const hasMultiplePieces = relatedRentals.length > 1;

  const [cancelScope, setCancelScope] = useState<"entire" | "piece">(() =>
    targetPieceId ? "piece" : "entire"
  );
  const [selectedPieceId, setSelectedPieceId] = useState<string>(() =>
    targetPieceId || rental.id
  );

  const isPieceMode = hasMultiplePieces && cancelScope === "piece";
  const activePiece = relatedRentals.find((r) => r.id === selectedPieceId) || rental;
  const activePieceItem = getItem(activePiece.itemId);
  const activePieceRate =
    Number(activePiece.total) ||
    Number((activePiece as any).rate) ||
    (activePieceItem ? activePieceItem.pricePerDay : 0);

  const [cancellationCharge, setCancellationCharge] = useState<string>("0");
  const [cancellationReason, setCancellationReason] = useState<string>("");
  const [refundPaid, setRefundPaid] = useState<boolean>(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (targetPieceId) {
        setCancelScope("piece");
        setSelectedPieceId(targetPieceId);
        const p = relatedRentals.find((r) => r.id === targetPieceId);
        setCancellationCharge(
          p?.cancellationCharge !== undefined ? String(p.cancellationCharge) : "0"
        );
        setCancellationReason(p?.cancellationReason || "");
        setRefundPaid(p?.refundPaid !== undefined ? Boolean(p.refundPaid) : true);
      } else {
        setCancelScope("entire");
        setSelectedPieceId(rental.id);
        setCancellationCharge(
          rental.cancellationCharge !== undefined ? String(rental.cancellationCharge) : "0"
        );
        setCancellationReason(rental.cancellationReason || "");
        setRefundPaid(rental.refundPaid !== undefined ? Boolean(rental.refundPaid) : true);
      }
    }
  }, [open, rental, targetPieceId]);

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

  const isPieceAlreadyCancelled = activePiece.status === "cancelled";
  const isEntireAlreadyCancelled = rental.status === "cancelled";
  const isCurrentlyCancelled = isPieceMode ? isPieceAlreadyCancelled : isEntireAlreadyCancelled;

  // Returned pieces cannot be cancelled
  const isReturned = isPieceMode
    ? activePiece.status === "returned"
    : rental.status === "returned" || relatedRentals.some((r) => r.status === "returned");

  if (!isControlled && (isReturned || isCurrentlyCancelled)) {
    return null;
  }

  async function handleConfirmCancel() {
    if (isReturned) {
      toast.error("Returned order or item cannot be cancelled (वापस हो चुका आइटम कैंसिल नहीं हो सकता)।");
      setOpen(false);
      return;
    }

    const isEntire = !isPieceMode;
    const targetRentalToCancel = isEntire ? rental : activePiece;

    setLoading(true);
    try {
      const result = await cancelRental(targetRentalToCancel.id, {
        cancellationCharge: chargeNum,
        cancellationReason: cancellationReason.trim(),
        refundPaid,
        cancelEntireBill: isEntire,
      });

      if (isEntire) {
        toast.success(
          `Order ${result.billNo || rental.billNo || rental.id} cancelled. Refund: ${formatCurrencyINR(result.refundAmount ?? refundNum)}`
        );
      } else {
        const pieceName = activePieceItem?.name || activePiece.itemNo || "Piece";
        toast.success(
          `Item "${pieceName}" cancelled with cancellation fee ${formatCurrencyINR(chargeNum)}.`
        );
      }
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
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : !isControlled ? (
        <DialogTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-8 w-8 border-rose-500/30 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 bg-transparent"
            disabled={disabled || isCurrentlyCancelled}
            title={isCurrentlyCancelled ? "Already cancelled" : "Cancel"}
            aria-label="Cancel order or piece"
          >
            <Ban className="h-4 w-4" />
          </Button>
        </DialogTrigger>
      ) : null}

      <DialogContent className="max-w-lg bg-card border-border text-foreground">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-500 text-lg font-serif">
            <Ban className="h-5 w-5" />
            {isPieceMode
              ? isCurrentlyCancelled
                ? "Edit Piece Cancellation Fee"
                : "Cancel Individual Piece"
              : isCurrentlyCancelled
              ? "Edit Cancellation Charges"
              : "Cancel Rental Order"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            {isPieceMode
              ? "Cancel only this selected piece from the bill and apply cancellation charges."
              : "Cancel this entire order, apply cancellation charges, and process customer refund."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Multi-piece scope selector if bill has multiple pieces */}
          {hasMultiplePieces && (
            <div className="flex rounded-lg border border-border p-1 bg-secondary/30">
              <button
                type="button"
                onClick={() => {
                  setCancelScope("piece");
                  setCancellationCharge(
                    activePiece.cancellationCharge !== undefined
                      ? String(activePiece.cancellationCharge)
                      : "0"
                  );
                }}
                className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
                  isPieceMode
                    ? "bg-rose-600 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Shirt className="h-3.5 w-3.5" />
                Cancel 1 Piece Only
              </button>
              <button
                type="button"
                onClick={() => {
                  setCancelScope("entire");
                  setCancellationCharge(
                    rental.cancellationCharge !== undefined
                      ? String(rental.cancellationCharge)
                      : "0"
                  );
                }}
                className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-all flex items-center justify-center gap-1.5 ${
                  !isPieceMode
                    ? "bg-rose-600 text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Layers className="h-3.5 w-3.5" />
                Cancel Full Order ({relatedRentals.length} Items)
              </button>
            </div>
          )}

          {/* Piece selection dropdown when in single piece mode */}
          {isPieceMode && hasMultiplePieces && (
            <div className="space-y-1.5 p-3 rounded-lg border border-rose-500/20 bg-rose-500/5">
              <Label className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                Select Piece to Cancel (कैंसिल करने के लिए पीस चुनें):
              </Label>
              <Select
                value={selectedPieceId}
                onValueChange={(val) => {
                  setSelectedPieceId(val);
                  const p = relatedRentals.find((r) => r.id === val);
                  if (p) {
                    setCancellationCharge(
                      p.cancellationCharge !== undefined ? String(p.cancellationCharge) : "0"
                    );
                    setCancellationReason(p.cancellationReason || "");
                  }
                }}
              >
                <SelectTrigger className="h-9 text-xs bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {relatedRentals.map((r, i) => {
                    const itm = getItem(r.itemId);
                    return (
                      <SelectItem key={r.id} value={r.id}>
                        Piece {i + 1}: ({r.itemNo || itm?.customId || "Item"}) {itm?.name || "Item"} - {formatCurrencyINR(r.total || (itm?.pricePerDay ?? 0))} {r.status === "cancelled" ? "(Cancelled)" : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

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
            {isPieceMode ? (
              <div className="flex justify-between items-center pt-1 border-t border-border/50">
                <span className="text-muted-foreground">Cancelling Item:</span>
                <span className="font-semibold text-rose-600 dark:text-rose-400">
                  ({activePiece.itemNo || activePieceItem?.customId || "Item"}) {activePieceItem?.name || "Item"}
                </span>
              </div>
            ) : (
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
            )}
          </div>

          {/* Financial Summary */}
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="p-3 rounded-lg border border-border bg-background">
              <div className="text-[11px] text-muted-foreground uppercase tracking-wider">
                {isPieceMode ? "Piece Rent Value" : "Total Order Value"}
              </div>
              <div className="text-base font-bold text-foreground mt-0.5">
                {formatCurrencyINR(isPieceMode ? activePieceRate : totalOrderValue)}
              </div>
            </div>
            <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                Advance Paid on Bill
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
              <div className="flex gap-1.5 flex-wrap">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={() => setCancellationCharge("0")}
                >
                  ₹0 (Full Refund)
                </Button>
                {isPieceMode && activePieceRate > 0 && (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                      onClick={() => setCancellationCharge(String(Math.round(activePieceRate * 0.5)))}
                    >
                      50% ({formatCurrencyINR(Math.round(activePieceRate * 0.5))})
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                      onClick={() => setCancellationCharge(String(activePieceRate))}
                    >
                      Keep Full ({formatCurrencyINR(activePieceRate)})
                    </Button>
                  </>
                )}
                {!isPieceMode && totalPaid > 0 && (
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
          {isPieceMode ? (
            <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1 flex-1">
                <div className="text-xs text-muted-foreground">
                  Piece Cancellation Fee Applied (आइटम कटौती शुल्क):
                </div>
                <div className="text-xl font-bold text-rose-600 dark:text-rose-400 font-sans">
                  {formatCurrencyINR(chargeNum)}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {chargeNum <= totalPaid ? (
                    <>
                      Deducted from bill advance. Remaining advance {formatCurrencyINR(totalPaid - chargeNum)} stays credited towards active items on the bill.
                    </>
                  ) : (
                    <>
                      Cancellation fee exceeds current bill advance by {formatCurrencyINR(chargeNum - totalPaid)}.
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : chargeNum <= totalPaid ? (
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

          {/* Refund Paid Checkbox (for entire bill cancel or if refund is handed back directly) */}
          {!isPieceMode && refundNum > 0 && (
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
            {isPieceMode ? (
              <>
                ℹ️ <strong>Note:</strong> Cancelling this piece will release it back into
                inventory as <strong>Available</strong> immediately. The remaining pieces on this
                bill will stay <strong>Active</strong>.
              </>
            ) : (
              <>
                ℹ️ <strong>Note:</strong> Cancelling this order will release all{" "}
                {relatedRentals.length} piece{relatedRentals.length > 1 ? "s" : ""} back into
                inventory as <strong>Available</strong> immediately.
              </>
            )}
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
                {isCurrentlyCancelled ? "Updating..." : "Cancelling..."}
              </>
            ) : (
              <>
                <Ban className="mr-1.5 h-4 w-4" />
                {isCurrentlyCancelled
                  ? "Update Cancellation Fee"
                  : isPieceMode
                  ? "Confirm Piece Cancellation"
                  : "Confirm Order Cancellation"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
