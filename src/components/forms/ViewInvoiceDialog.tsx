import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { Eye, Printer, Download, Send, Receipt, IndianRupee, PlusCircle, Loader2, Ban } from "lucide-react";
import { useStore } from "@/data/store";
import { formatCurrencyINR, getBillRepresentative } from "@/lib/utils";
import { printInvoiceHtml, getPoliciesHtml, getPoliciesColumnsHtml } from "@/lib/invoiceTemplate";
import { CancelOrderDialog } from "./CancelOrderDialog";
import type { Rental } from "@/data/mock";

function formatDate(dateStr: string) {
  if (!dateStr) return "-";
  const parts = dateStr.split("T")[0].split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function ViewInvoiceDialog({
  rental,
  trigger,
  disabled,
}: {
  rental: Rental;
  trigger?: React.ReactNode;
  disabled?: boolean;
}) {
  const { rentals, getItem, getCustomer, updateRental } = useStore();
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [collectingPayment, setCollectingPayment] = useState(false);
  const paymentInputRef = useRef<HTMLInputElement>(null);

  const relatedRentals = useMemo(() => {
    if (rental.billNo) {
      return rentals.filter((r) => r.billNo === rental.billNo);
    }
    return [rental];
  }, [rentals, rental.billNo, rental.id]);

  const mainBillRental = useMemo(() => {
    return (getBillRepresentative(relatedRentals as any) ?? rental) as typeof rental;
  }, [relatedRentals, rental]);

  const customer = useMemo(() => {
    return getCustomer(mainBillRental.customerId || rental.customerId);
  }, [getCustomer, mainBillRental, rental]);

  const piecesData = useMemo(() => {
    return relatedRentals.map((r) => {
      const rItem = getItem(r.itemId);
      const rQuantity = Math.max(1, (r as any).quantity ?? 1);
      const rLostQuantity = (r as any).lostQuantity ?? 0;
      const rRate = (r as any).rate ?? (rItem ? rItem.pricePerDay : 0);
      const rSubtotal = Number(r.total) || rRate * rQuantity;
      const rDeliveryDate = r.deliveryDate || r.startDate || "";
      const rEndDate = r.endDate || "";
      const rDeliveryTime = (r as any).deliveryTime || "";
      const rDeliveryTimePeriod = (r as any).deliveryTimePeriod || "";
      const rEndTime = (r as any).endTime || "";
      const rEndTimePeriod = (r as any).endTimePeriod || "";

      return {
        r,
        rItem,
        rQuantity,
        rLostQuantity,
        rRate,
        rSubtotal,
        rDeliveryDate,
        rEndDate,
        rDeliveryTime,
        rDeliveryTimePeriod,
        rEndTime,
        rEndTimePeriod,
      };
    });
  }, [relatedRentals, getItem]);

  const aggSubtotal = piecesData.reduce((sum, p) => sum + p.rSubtotal, 0);
  const aggSecurity = Number(mainBillRental.securityAmount) || 0;
  const aggDiscount = Number(mainBillRental.discount) || 0;
  const aggTotal = aggSubtotal + aggSecurity - aggDiscount;

  const billPayments = useMemo(() => {
    return relatedRentals.flatMap((r) => r.payments || []);
  }, [relatedRentals]);

  const aggPaid = billPayments.reduce(
    (sum, p) => sum + (Number(p.amount) || 0),
    0,
  );
  const aggFinalDue = Math.max(0, aggTotal - aggPaid);
  const isSecurityReturned = Boolean((mainBillRental as any).securityReturned);
  const aggSecurityRefundDue = isSecurityReturned ? 0 : aggSecurity;

  const status = (mainBillRental.status || rental.status || "upcoming").toLowerCase();
  let invoiceTitle = "Invoice";
  if (status === "upcoming") invoiceTitle = "Booking Invoice";
  else if (status === "active") invoiceTitle = "Delivery Invoice";
  else if (status === "returned") invoiceTitle = "Final Invoice";
  else if (status === "overdue") invoiceTitle = "Overdue Final Bill";
  else if (status === "cancelled") invoiceTitle = "Cancellation Receipt / Invoice";

  // Determine user role for payment permission
  const userRole =
    typeof window !== "undefined"
      ? (localStorage.getItem("user_role") || "").trim().toLowerCase()
      : "";
  const canCollectPayment = ["admin", "reception"].includes(userRole);

  async function handleCollectPayment() {
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      toast.error("Sahi amount darj karein (0 se zyada hona chahiye).");
      paymentInputRef.current?.focus();
      return;
    }
    setCollectingPayment(true);
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      // Collect all existing payments from all pieces of this bill
      const existingPayments = relatedRentals.flatMap((r) => r.payments || []);
      const newPayment = { amount, date: todayStr };
      const combinedPayments = [...existingPayments, newPayment];

      // Always save payments on the bill representative
      await updateRental(mainBillRental.id, {
        payments: combinedPayments,
        advance: combinedPayments.reduce((s, p) => s + Number(p.amount || 0), 0),
      } as any);

      toast.success(`${formatCurrencyINR(amount)} jama ho gaya!`);
      setPaymentAmount("");
    } catch (err) {
      console.error(err);
      toast.error("Payment save nahi ho saki. Dobara try karein.");
    } finally {
      setCollectingPayment(false);
    }
  }

  const billMakingDate = (mainBillRental as any).billMakingDate
    ? new Date((mainBillRental as any).billMakingDate).toLocaleDateString("en-IN")
    : "-";

  const logoUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/logo-sm.png`
      : "/logo-sm.png";

  function getA4InvoiceInnerHtml() {
    const piecesRows = piecesData
      .map(
        ({
          r,
          rItem,
          rEndDate,
          rDeliveryDate,
          rDeliveryTime,
          rDeliveryTimePeriod,
          rEndTime,
          rEndTimePeriod,
          rRate,
          rSubtotal,
          rQuantity,
          rLostQuantity,
        }) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 6px 6px; text-align: center; vertical-align: middle;">
          <div style="width: 12px; height: 12px; border: 1px solid #94a3b8; border-radius: 2px; margin: 0 auto;"></div>
        </td>
        <td style="padding: 6px 6px; vertical-align: middle; text-align: center;">
          ${
            rItem?.image
              ? `<img src="${rItem.image}" alt="${rItem.name || "Item"}" width="34" height="44" style="width: 34px !important; height: 44px !important; min-width: 34px; min-height: 44px; max-width: 34px; max-height: 44px; object-fit: cover; border-radius: 3px; border: 1px solid #e2e8f0; display: block; margin: 0 auto;" />`
              : `<div style="width: 34px; height: 44px; background: #f1f5f9; border-radius: 3px; border: 1px solid #e2e8f0; margin: 0 auto;"></div>`
          }
        </td>
        <td style="padding: 6px 8px; vertical-align: middle; text-align: left;">
          <div style="color: #0f172a; font-size: 11px; font-weight: 700; line-height: 1.3;">${rItem?.name || "Unknown item"}</div>
          <div style="font-size: 9px; color: #64748b; line-height: 1.35; margin-top: 2px;">Qty: ${rQuantity}${rLostQuantity > 0 ? ` | Lost: ${rLostQuantity}` : ""} | Del: ${formatDate(rDeliveryDate)}${rDeliveryTime ? ` ${rDeliveryTime}` : ""}${rDeliveryTimePeriod ? ` (${rDeliveryTimePeriod})` : ""} | Return: ${formatDate(rEndDate)}${rEndTime ? ` ${rEndTime}` : ""}${rEndTimePeriod ? ` (${rEndTimePeriod})` : ""}</div>
        </td>
        <td style="padding: 6px 8px; vertical-align: middle; text-align: center; color: #334155; font-weight: 600; font-size: 10px;">${r.itemNo || r.itemId}</td>
        <td style="padding: 6px 8px; vertical-align: middle; text-align: right; color: #334155; font-size: 10px;">${formatCurrencyINR(rRate)}</td>
        <td style="padding: 6px 8px; vertical-align: middle; text-align: right; font-weight: 700; color: #0f172a; font-size: 10px;">${formatCurrencyINR(rSubtotal)}</td>
      </tr>
    `,
      )
      .join("");

    return `
      <div id="invoice-doc-body" style="width: 100%; max-width: 740px; margin: 0 auto; background: #ffffff; color: #0f172a; font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; line-height: 1.35; padding: 14px 18px; box-sizing: border-box; position: relative;">
        <!-- Watermark (very faint so it does not disturb any text or numbers) -->
        <div style="position: absolute; top: 48%; left: 50%; transform: translate(-50%, -50%) rotate(-35deg); font-size: 44px; font-weight: 800; color: rgba(217, 119, 6, 0.035); z-index: 0; white-space: nowrap; pointer-events: none; letter-spacing: 2px; user-select: none;">
          ARIHANT COLLECTION
        </div>

        <!-- Religious slogans -->
        <div style="text-align: center; font-size: 12px; font-weight: bold; color: #b45309; margin-bottom: 6px; line-height: 1.35; position: relative; z-index: 1;">
          <div style="margin-bottom: 2px;">॥ श्री आशापुरा माताय नमः ॥</div>
          <div>॥ श्री नाकोड़ा पार्श्वनाथाय नमः ॥</div>
        </div>

        <!-- Header -->
        <table style="width: 100%; border-collapse: collapse; border-bottom: 2px solid #d97706; margin-bottom: 8px; position: relative; z-index: 1; border-top: none; border-left: none; border-right: none;">
          <tr>
            <td style="vertical-align: middle; border: none; padding: 0 0 6px 0;">
              <table style="border-collapse: collapse; border: none;">
                <tr>
                  <td style="vertical-align: middle; border: none; padding: 0 10px 0 0;">
                    <img
                      src="${logoUrl}"
                      alt="ARIHANT COLLECTION logo"
                      width="48"
                      height="48"
                      style="width: 48px !important; height: 48px !important; min-width: 48px; min-height: 48px; max-width: 48px; max-height: 48px; border-radius: 50%; border: 1.5px solid #fde68a; object-fit: cover; display: block;"
                    />
                  </td>
                  <td style="vertical-align: middle; border: none; padding: 0;">
                    <div style="font-size: 16px; font-weight: 900; color: #0f172a; letter-spacing: 0.8px; text-transform: uppercase;">ARIHANT COLLECTION</div>
                    <div style="color: #475569; font-size: 9.5px; line-height: 1.3; margin-top: 1px;">Address: Maheshwar Road, Near Daluka Market, Barwaha 451115 (Dist. Khargone)</div>
                    <div style="color: #1e293b; font-size: 9.5px; font-weight: 500; margin-top: 1px;">Contact: <strong>9039489995</strong> | Insta: <strong>Arihant_rental_point</strong></div>
                  </td>
                </tr>
              </table>
            </td>
            <td style="vertical-align: middle; text-align: right; border: none; padding: 0 0 6px 0; min-width: 140px;">
              <div style="color: #d97706; font-size: 17px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">${invoiceTitle}</div>
              <div style="font-size: 11.5px; font-weight: bold; color: #334155; margin-top: 1px;"># ${rental.billNo || rental.id}</div>
              <div style="font-size: 10px; color: #64748b; margin-top: 1px;">Date: ${billMakingDate}</div>
            </td>
          </tr>
        </table>

        <!-- Billed To & Rental Overview -->
        <table style="width: 100%; border-collapse: separate; border-spacing: 10px 0; margin-bottom: 8px; position: relative; z-index: 1; border: none;">
          <tr>
            <td style="width: 58%; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 5px; padding: 6px 10px; vertical-align: top;">
              <div style="font-size: 8.5px; font-weight: bold; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.5px; margin-bottom: 2px;">Billed To</div>
              <div style="font-size: 12px; font-weight: bold; color: #0f172a; margin-bottom: 2px;">${customer?.name || mainBillRental.customerId || "Client"}</div>
              ${customer?.phone ? `<div style="color: #475569; font-size: 10px; line-height: 1.35;">Phone: ${customer.phone}</div>` : ""}
              ${customer?.email ? `<div style="color: #475569; font-size: 10px; line-height: 1.35;">Email: ${customer.email}</div>` : ""}
              ${mainBillRental.address || rental.address ? `<div style="color: #475569; font-size: 10px; line-height: 1.35;">Address: ${mainBillRental.address || rental.address}</div>` : ""}
              ${(mainBillRental as any).instaId ? `<div style="color: #334155; font-size: 10px; font-weight: 500; line-height: 1.35;">Insta ID: ${(mainBillRental as any).instaId}</div>` : ""}
            </td>
            <td style="width: 42%; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 5px; padding: 6px 10px; vertical-align: top; text-align: right;">
              <div style="font-size: 8.5px; font-weight: bold; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.5px; margin-bottom: 2px;">Rental Details</div>
              <div style="font-size: 10.5px; color: #334155; margin-bottom: 2px;">Status: <strong style="color: #b45309; text-transform: uppercase;">${status}</strong></div>
              <div style="font-size: 10px; color: #64748b;">Total Items: <strong>${piecesData.length} piece(s)</strong></div>
            </td>
          </tr>
        </table>

        <!-- Items Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 10px; position: relative; z-index: 1;">
          <thead>
            <tr style="background: #f1f5f9;">
              <th style="padding: 7px 6px; text-align: center; width: 28px; font-size: 9.5px; font-weight: 700; color: #334155; border-top: 1px solid #cbd5e1; border-bottom: 2px solid #94a3b8; text-transform: uppercase;">&#10003;</th>
              <th style="padding: 7px 6px; text-align: center; width: 44px; font-size: 9.5px; font-weight: 700; color: #334155; border-top: 1px solid #cbd5e1; border-bottom: 2px solid #94a3b8; text-transform: uppercase;">Image</th>
              <th style="padding: 7px 8px; text-align: left; font-size: 9.5px; font-weight: 700; color: #334155; border-top: 1px solid #cbd5e1; border-bottom: 2px solid #94a3b8; text-transform: uppercase;">Item Description & Dates</th>
              <th style="padding: 7px 8px; text-align: center; width: 75px; font-size: 9.5px; font-weight: 700; color: #334155; border-top: 1px solid #cbd5e1; border-bottom: 2px solid #94a3b8; text-transform: uppercase;">Item No</th>
              <th style="padding: 7px 8px; text-align: right; width: 75px; font-size: 9.5px; font-weight: 700; color: #334155; border-top: 1px solid #cbd5e1; border-bottom: 2px solid #94a3b8; text-transform: uppercase;">Rate</th>
              <th style="padding: 7px 8px; text-align: right; width: 80px; font-size: 9.5px; font-weight: 700; color: #334155; border-top: 1px solid #cbd5e1; border-bottom: 2px solid #94a3b8; text-transform: uppercase;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${piecesRows}
          </tbody>
        </table>

        <!-- Financial Summary -->
        <div style="display: flex; justify-content: flex-end; margin-bottom: 8px; position: relative; z-index: 1;">
          <div style="width: 270px; font-size: 10px; border-top: 1px solid #e2e8f0; padding-top: 4px;">
            ${status === "cancelled" ? `
              <div style="display: flex; justify-content: space-between; padding: 2px 0; color: #e11d48; font-weight: bold;">
                <span>Status:</span>
                <span>CANCELLED</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 2px 0; color: #334155;">
                <span>Total Advance Paid:</span>
                <span style="font-weight: 600;">${formatCurrencyINR(aggPaid)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 2px 0; color: #e11d48;">
                <span>Cancellation Charges:</span>
                <span style="font-weight: 600;">-${formatCurrencyINR((mainBillRental as any).cancellationCharge || 0)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 4px 0; border-top: 2px solid #059669; font-size: 11.5px; font-weight: bold; color: #059669; margin-top: 2px;">
                <span>Refund ${(mainBillRental as any).refundPaid ? "Returned" : "Due"}:</span>
                <span>${formatCurrencyINR((mainBillRental as any).refundAmount ?? Math.max(0, aggPaid - ((mainBillRental as any).cancellationCharge || 0)))}</span>
              </div>
            ` : `
              <div style="display: flex; justify-content: space-between; padding: 2px 0; color: #334155;">
                <span>Total Rent:</span>
                <span style="font-weight: 600;">${formatCurrencyINR(aggSubtotal)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 2px 0; color: #334155;">
                <span>Security Deposit:</span>
                <span style="font-weight: 600;">${formatCurrencyINR(aggSecurity)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 2px 0; color: #047857;">
                <span>Discount:</span>
                <span style="font-weight: 600;">-${formatCurrencyINR(aggDiscount)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 3px 0; border-top: 1px solid #cbd5e1; font-weight: bold; color: #0f172a; margin-top: 2px;">
                <span>Total Bill:</span>
                <span>${formatCurrencyINR(aggTotal)}</span>
              </div>
              ${
                billPayments.length > 0
                  ? `
                <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 3px; padding: 3px 5px; margin: 3px 0;">
                  <div style="font-size: 8.5px; font-weight: bold; text-transform: uppercase; color: #166534; margin-bottom: 1px;">Payments Received</div>
                  ${billPayments.map((p: { date: string; amount: number }) => `<div style="display: flex; justify-content: space-between; font-size: 9px; color: #14532d;"><span>Paid on ${formatDate(p.date)}</span><span style="font-weight: bold;">-${formatCurrencyINR(p.amount)}</span></div>`).join("")}
                </div>
              `
                  : ""
              }
              <div style="display: flex; justify-content: space-between; padding: 2px 0; color: #b45309;">
                <span>Security Refund:</span>
                <span style="font-weight: 600;">${formatCurrencyINR(aggSecurityRefundDue)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 4px 0; border-top: 2px solid #0f172a; font-size: 12px; font-weight: bold; color: #d97706; margin-top: 2px;">
                <span>Balance Due:</span>
                <span>${formatCurrencyINR(aggFinalDue)}</span>
              </div>
            `}
          </div>
        </div>

        <!-- Terms & Conditions in 2 columns -->
        <div style="border-top: 1px solid #e2e8f0; padding-top: 5px; margin-top: 4px; position: relative; z-index: 1;">
          <div style="font-size: 9px; font-weight: bold; color: #0f172a; margin-bottom: 2px;">Terms & Conditions:</div>
          ${getPoliciesColumnsHtml()}
        </div>

        <!-- Signatures (3-column table so line NEVER stretches across full page) -->
        <table style="width: 100%; border-collapse: collapse; margin-top: 18px; border: none; position: relative; z-index: 1; page-break-inside: avoid;">
          <tr>
            <td style="width: 180px; text-align: center; vertical-align: bottom; border: none; padding: 0;">
              ${mainBillRental.signature ? `<img src="${mainBillRental.signature}" style="max-height: 36px; max-width: 140px; margin: 0 auto 3px auto; display: block; object-fit: contain;" />` : `<div style="height: 30px;"></div>`}
              <div style="border-top: 1.5px solid #334155; width: 150px; margin: 0 auto; padding-top: 4px; font-size: 8.5px; font-weight: 700; text-transform: uppercase; color: #475569; letter-spacing: 0.5px;">
                Authorized Signature
              </div>
            </td>
            <td style="text-align: center; vertical-align: bottom; border: none; padding: 0 0 4px 0;">
              <span style="font-size: 14px; vertical-align: middle;">${(mainBillRental as any).confirmationChecked ? "☑" : "☐"}</span>
              <strong style="font-size: 10.5px; vertical-align: middle; color: #1e293b; margin-left: 3px;">Confirmed</strong>
            </td>
            <td style="width: 180px; text-align: center; vertical-align: bottom; border: none; padding: 0;">
              <div style="height: 30px;"></div>
              <div style="border-top: 1.5px solid #334155; width: 150px; margin: 0 auto; padding-top: 4px; font-size: 8.5px; font-weight: 700; text-transform: uppercase; color: #475569; letter-spacing: 0.5px;">
                Client Signature
              </div>
            </td>
          </tr>
        </table>
      </div>
    `;
  }

  function getA4InvoiceHtml() {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice ${rental.billNo || rental.id}</title>
          <style>
            @page { size: A4 portrait; margin: 6mm 8mm; }
            * { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; box-sizing: border-box; }
            body { margin: 0; padding: 0; background: #fff; font-family: 'Segoe UI', Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          ${getA4InvoiceInnerHtml()}
        </body>
      </html>
    `;
  }

  function getThermalInvoiceHtml() {
    const itemsListHtml = piecesData
      .map(
        ({ rItem, rQuantity, rSubtotal, rDeliveryDate, rEndDate }) => `
      <div class="thermal-item-name">${rItem?.name || "Item"} (Qty: ${rQuantity})</div>
      <div class="thermal-item-sub">Del: ${formatDate(rDeliveryDate)} | Return: ${formatDate(rEndDate)}</div>
      <div class="thermal-row">
        <span>Amount:</span>
        <span class="thermal-total">${formatCurrencyINR(rSubtotal)}</span>
      </div>
      <div class="thermal-divider"></div>
    `,
      )
      .join("");

    return `
      <html>
        <head>
          <title>Receipt ${rental.billNo || rental.id}</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body { margin: 0; padding: 0; }
            .thermal { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 10px 6px; color: #111; font-size: 11px; }
            .thermal-title { text-align: center; font-weight: 800; letter-spacing: 1px; margin-bottom: 6px; }
            .thermal-row { display: flex; justify-content: space-between; gap: 10px; margin: 3px 0; }
            .thermal-divider { border-top: 1px dashed #bbb; margin: 8px 0; }
            .thermal-item-name { font-weight: 800; margin-top: 4px; }
            .thermal-item-sub { margin-top: 2px; color: #666; font-size: 10px; }
            .thermal-total { font-weight: 800; }
            .thermal-footer { text-align: center; margin-top: 12px; font-size: 10px; color: #555; }
          </style>
        </head>
        <body>
          <div class="thermal">
            <div style="text-align: center; font-size: 11px; font-weight: bold; margin-bottom: 4px;">॥ श्री आशापुरा माताय नमः ॥</div>
            <div class="thermal-title">ARIHANT COLLECTION</div>
            <div style="text-align: center; font-size: 9px; color: #666; margin-bottom: 6px;">Barwaha 451115 | 9039489995</div>
            <div class="thermal-divider"></div>
            <div class="thermal-row"><span>Bill No:</span><strong>#${rental.billNo || rental.id}</strong></div>
            <div class="thermal-row"><span>Date:</span><span>${billMakingDate}</span></div>
            <div class="thermal-row"><span>Client:</span><strong>${customer?.name || "Client"}</strong></div>
            <div class="thermal-row"><span>Phone:</span><span>${customer?.phone || "-"}</span></div>
            <div class="thermal-divider"></div>
            ${itemsListHtml}
            <div class="thermal-row"><span>Total Rent:</span><span>${formatCurrencyINR(aggSubtotal)}</span></div>
            <div class="thermal-row"><span>Security Deposit:</span><span>${formatCurrencyINR(aggSecurity)}</span></div>
            <div class="thermal-row"><span>Discount:</span><span>-${formatCurrencyINR(aggDiscount)}</span></div>
            <div class="thermal-row thermal-total"><span>Total Bill:</span><span>${formatCurrencyINR(aggTotal)}</span></div>
            <div class="thermal-row"><span>Amount Paid:</span><span>${formatCurrencyINR(aggPaid)}</span></div>
            <div class="thermal-divider"></div>
            <div class="thermal-row thermal-total" style="font-size: 12px;"><span>Balance Due:</span><span>${formatCurrencyINR(aggFinalDue)}</span></div>
            <div class="thermal-footer">Thank you for choosing ARIHANT COLLECTION!</div>
          </div>
        </body>
      </html>
    `;
  }

  function handlePrintA4() {
    const html = getA4InvoiceHtml();
    if (!printInvoiceHtml(html)) {
      toast.error("Unable to open print window. Please allow popups.");
    }
  }

  function handlePrintThermal() {
    const html = getThermalInvoiceHtml();
    if (!printInvoiceHtml(html)) {
      toast.error("Unable to open print window. Please allow popups.");
    }
  }

  async function handleDownloadPdf() {
    if (typeof window === "undefined") return;
    setDownloading(true);
    toast.info("Generating PDF bill...");

    try {
      // @ts-ignore
      const html2pdf = (await import("html2pdf.js")).default;
      const filenameSafe = `${rental.billNo || "Bill"}-${rental.id}`.replace(
        /[^a-z0-9-_]/gi,
        "-",
      );
      const filename = `Invoice-${filenameSafe}.pdf`;

      const htmlString = `
        <div style="background-color: #ffffff; color: #0f172a; padding: 0; margin: 0; width: 100%;">
          ${getA4InvoiceInnerHtml()}
        </div>
      `;

      await html2pdf()
        .set({
          margin: [6, 6, 6, 6],
          filename,
          // JPEG compression keeps PDF under ~250 KB (vs 57 MB uncompressed PNG)
          image: { type: "jpeg", quality: 0.95 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff",
            logging: false,
          },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(htmlString)
        .save();

      toast.success("Bill downloaded as PDF");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF bill");
    } finally {
      setDownloading(false);
    }
  }

  function shareOnWhatsApp() {
    const message = `*ARIHANT COLLECTION - ${invoiceTitle}*
      
*Invoice:* #${rental.billNo || rental.id}
*Date:* ${billMakingDate}
*Client:* ${customer?.name || "Client"}
*Pieces:* 
${piecesData.map((p) => `- ${p.rItem?.name || "Item"} (${p.r.itemNo || p.r.itemId}) [Qty: ${p.rQuantity} | Del: ${formatDate(p.rDeliveryDate)} | Return: ${formatDate(p.rEndDate)}] - ${formatCurrencyINR(p.rSubtotal)}`).join("\n")}

*Total Rent:* ${formatCurrencyINR(aggSubtotal)}
*Security Deposit:* ${formatCurrencyINR(aggSecurity)}
*Discount:* -${formatCurrencyINR(aggDiscount)}
*Total Bill:* ${formatCurrencyINR(aggTotal)}
*Amount Paid:* ${formatCurrencyINR(aggPaid)}
*Balance Due:* ${formatCurrencyINR(aggFinalDue)}

Thank you for choosing ARIHANT COLLECTION!`;

    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
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
            className="h-8 w-8 border-border bg-transparent hover:bg-secondary/30 text-gold hover:text-gold"
            aria-label={`View bill ${rental.billNo || rental.id}`}
            disabled={disabled}
            onClick={(e) => e.stopPropagation()}
          >
            <Eye className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden bg-background">
        {/* Header bar */}
        <DialogHeader className="p-4 sm:p-5 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <DialogTitle className="font-display text-xl sm:text-2xl">
                Invoice #{rental.billNo || rental.id}
              </DialogTitle>
              <StatusBadge status={status} kind="rental" />
            </div>
            <DialogDescription className="text-xs mt-1">
              Billed to <strong className="text-foreground">{customer?.name || "Client"}</strong> {customer?.phone ? `(${customer.phone})` : ""} · Created: {billMakingDate}
            </DialogDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5 border-gold/30 text-gold hover:bg-gold/10"
              onClick={handlePrintA4}
            >
              <Printer className="h-3.5 w-3.5" />
              Print A4
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5 border-border"
              onClick={handlePrintThermal}
            >
              <Receipt className="h-3.5 w-3.5" />
              Thermal
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5 border-border"
              onClick={handleDownloadPdf}
              disabled={downloading}
            >
              <Download className="h-3.5 w-3.5" />
              {downloading ? "PDF..." : "Download"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
              onClick={shareOnWhatsApp}
            >
              <Send className="h-3.5 w-3.5" />
              WhatsApp
            </Button>
            {status !== "cancelled" && status !== "returned" && (
              <CancelOrderDialog
                rental={mainBillRental}
                trigger={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5 border-rose-500/30 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
                  >
                    <Ban className="h-3.5 w-3.5" />
                    Cancel Order
                  </Button>
                }
              />
            )}
          </div>
        </DialogHeader>

        {/* Scrollable invoice visual preview */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-secondary/10">
          <div className="mx-auto max-w-3xl bg-white text-slate-900 rounded-lg shadow-lg border border-slate-200 p-6 sm:p-8 space-y-6 font-sans">
            {/* Header top slogans & logo */}
            <div className="text-center font-bold text-amber-700 text-sm space-y-0.5">
              <div>॥ श्री आशापुरा माताय नमः ॥</div>
              <div>॥ श्री नाकोड़ा पार्श्वनाथाय नमः ॥</div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between border-b-2 border-amber-600 pb-4 gap-4">
              <div className="flex items-center gap-3">
                <img
                  src={logoUrl}
                  alt="ARIHANT COLLECTION Logo"
                  className="w-14 h-14 rounded-full object-cover border border-amber-200"
                />
                <div>
                  <h1 className="text-xl font-black tracking-wider text-slate-900 uppercase">
                    ARIHANT COLLECTION
                  </h1>
                  <p className="text-[11px] text-slate-600">
                    Maheshwar Road, Near Daluka Market, Barwaha 451115 (Dist. Khargone)
                  </p>
                  <p className="text-[11px] text-slate-800 font-medium mt-0.5">
                    Contact: <strong>9039489995</strong> | Insta: <strong>Arihant_rental_point</strong>
                  </p>
                </div>
              </div>

              <div className="text-right sm:text-right shrink-0">
                <h2 className="text-xl font-bold uppercase tracking-wider text-amber-600">
                  {invoiceTitle}
                </h2>
                <p className="text-xs font-semibold text-slate-700 mt-1">
                  #{rental.billNo || rental.id}
                </p>
                <p className="text-[11px] text-slate-500">Date: {billMakingDate}</p>
              </div>
            </div>

            {/* Billed To & Rental Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-50 p-3 rounded border border-slate-100 space-y-1">
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Billed To
                </p>
                <p className="text-sm font-bold text-slate-900">
                  {customer?.name || mainBillRental.customerId || "Client"}
                </p>
                {customer?.phone && (
                  <p className="text-slate-600">Phone: {customer.phone}</p>
                )}
                {customer?.email && (
                  <p className="text-slate-600">Email: {customer.email}</p>
                )}
                {(mainBillRental.address || rental.address) && (
                  <p className="text-slate-600">
                    Address: {mainBillRental.address || rental.address}
                  </p>
                )}
                {(mainBillRental as any).instaId && (
                  <p className="text-slate-700 font-medium">
                    Insta ID: {(mainBillRental as any).instaId}
                  </p>
                )}
              </div>

              <div className="bg-slate-50 p-3 rounded border border-slate-100 flex flex-col justify-between text-right">
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Rental Overview
                  </p>
                  <p className="text-xs font-semibold uppercase text-slate-800 mt-1">
                    Status: <span className="text-amber-700 font-bold">{status}</span>
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Total Items: <strong>{piecesData.length} piece(s)</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-900 text-[10px] uppercase text-slate-500 tracking-wider">
                    <th className="py-2 px-1 w-6 text-center">&#10003;</th>
                    <th className="py-2 px-2 w-14">Image</th>
                    <th className="py-2 px-2">Item & Dates</th>
                    <th className="py-2 px-2">Item No</th>
                    <th className="py-2 px-2 text-right">Rate</th>
                    <th className="py-2 px-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {piecesData.map(
                    ({
                      r,
                      rItem,
                      rQuantity,
                      rLostQuantity,
                      rRate,
                      rSubtotal,
                      rDeliveryDate,
                      rEndDate,
                      rDeliveryTime,
                      rDeliveryTimePeriod,
                      rEndTime,
                      rEndTimePeriod,
                    }) => (
                      <tr key={r.id} className="hover:bg-slate-50/80">
                        <td className="py-2 px-1 text-center align-middle">
                          <div className="w-3.5 h-3.5 border border-slate-400 rounded-sm mx-auto" />
                        </td>
                        <td className="py-2 px-2 align-middle">
                          {rItem?.image ? (
                            <img
                              src={rItem.image}
                              alt={rItem.name}
                              className="w-9 h-12 object-cover rounded border border-slate-200"
                            />
                          ) : (
                            <div className="w-9 h-12 bg-slate-100 rounded border border-slate-200" />
                          )}
                        </td>
                        <td className="py-2 px-2 align-middle">
                          <p className="font-bold text-slate-900">
                            {rItem?.name || "Unknown item"}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Qty: {rQuantity}
                            {rLostQuantity > 0 ? ` | Lost: ${rLostQuantity}` : ""}{" "}
                            | Del: {formatDate(rDeliveryDate)}
                            {rDeliveryTime ? ` ${rDeliveryTime}` : ""}
                            {rDeliveryTimePeriod ? ` (${rDeliveryTimePeriod})` : ""}{" "}
                            | Return: {formatDate(rEndDate)}
                            {rEndTime ? ` ${rEndTime}` : ""}
                            {rEndTimePeriod ? ` (${rEndTimePeriod})` : ""}
                          </p>
                        </td>
                        <td className="py-2 px-2 align-middle font-medium text-slate-700">
                          {r.itemNo || r.itemId}
                        </td>
                        <td className="py-2 px-2 align-middle text-right font-medium text-slate-700">
                          {formatCurrencyINR(rRate)}
                        </td>
                        <td className="py-2 px-2 align-middle text-right font-bold text-slate-900">
                          {formatCurrencyINR(rSubtotal)}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>

            {/* Financial Summary */}
            <div className="flex justify-end">
              <div className="w-full sm:w-1/2 space-y-1.5 text-xs text-slate-700 border-t border-slate-200 pt-3">
                {status === "cancelled" ? (
                  <>
                    <div className="flex justify-between font-bold text-rose-600">
                      <span>Status:</span>
                      <span>CANCELLED</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Advance Received:</span>
                      <span className="font-semibold">{formatCurrencyINR(aggPaid)}</span>
                    </div>
                    <div className="flex justify-between text-rose-600">
                      <span>Cancellation Charges Deducted:</span>
                      <span className="font-semibold">
                        -{formatCurrencyINR((mainBillRental as any).cancellationCharge || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm font-bold border-t-2 border-emerald-600 pt-2 text-emerald-600">
                      <span>
                        Refund {(mainBillRental as any).refundPaid ? "Returned" : "Due"}:
                      </span>
                      <span>
                        {formatCurrencyINR(
                          (mainBillRental as any).refundAmount ??
                            Math.max(
                              0,
                              aggPaid - ((mainBillRental as any).cancellationCharge || 0),
                            ),
                        )}
                      </span>
                    </div>
                    {(mainBillRental as any).cancellationReason && (
                      <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded mt-2 border border-slate-100">
                        <strong>Reason:</strong> {(mainBillRental as any).cancellationReason}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex justify-between">
                      <span>Total Rent:</span>
                      <span className="font-semibold">{formatCurrencyINR(aggSubtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Security Deposit:</span>
                      <span className="font-semibold">{formatCurrencyINR(aggSecurity)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-700">
                      <span>Discount:</span>
                      <span className="font-semibold">-{formatCurrencyINR(aggDiscount)}</span>
                    </div>

                    <div className="flex justify-between font-bold border-t border-slate-300 pt-1 text-slate-900">
                      <span>Total Bill:</span>
                      <span>{formatCurrencyINR(aggTotal)}</span>
                    </div>

                    {billPayments.length > 0 && (
                      <div className="bg-emerald-50 p-2 rounded border border-emerald-100 space-y-1 my-1">
                        <p className="text-[10px] font-bold uppercase text-emerald-800">
                          Payments Received
                        </p>
                        {billPayments.map((p, idx) => (
                          <div key={idx} className="flex justify-between text-[11px] text-emerald-900">
                            <span>Paid on {formatDate(p.date)}:</span>
                            <span className="font-bold">-{formatCurrencyINR(p.amount)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {aggSecurityRefundDue > 0 && (
                      <div className="flex justify-between text-amber-700">
                        <span>Security Refund Due:</span>
                        <span className="font-semibold">{formatCurrencyINR(aggSecurityRefundDue)}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-sm font-bold border-t-2 border-slate-900 pt-2 text-amber-600">
                      <span>Rental Balance Due:</span>
                      <span>{formatCurrencyINR(aggFinalDue)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ── Payment Collection Section ── */}
            {canCollectPayment && aggFinalDue > 0 && status !== "cancelled" && (
              <div className="mt-4 border border-emerald-200 rounded-lg bg-emerald-50/60 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <IndianRupee className="w-4 h-4 text-emerald-700" />
                  <p className="text-sm font-bold text-emerald-800 uppercase tracking-wide">
                    Payment Jama Karein
                  </p>
                  <span className="ml-auto text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded px-2 py-0.5">
                    Baaki: {formatCurrencyINR(aggFinalDue)}
                  </span>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <Input
                      ref={paymentInputRef}
                      id={`payment-input-${rental.billNo || rental.id}`}
                      type="number"
                      min="1"
                      step="1"
                      placeholder={`Amount darjj karein (max ${aggFinalDue})`}
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleCollectPayment(); }}
                      className="pl-8 bg-white border-emerald-300 focus:border-emerald-500 text-slate-900"
                      disabled={collectingPayment}
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handleCollectPayment}
                    disabled={collectingPayment || !paymentAmount}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 shrink-0"
                  >
                    {collectingPayment ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <PlusCircle className="w-4 h-4" />
                    )}
                    {collectingPayment ? "Jama ho raha..." : "Jama Karo"}
                  </Button>
                </div>
                <p className="text-[10px] text-emerald-700">
                  ✓ Yeh payment turant bill mein jud jayegi aur balance deduct ho jayega.
                </p>
              </div>
            )}
            {canCollectPayment && aggFinalDue <= 0 && billPayments.length > 0 && (
              <div className="mt-4 flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                <IndianRupee className="w-4 h-4" />
                <p className="text-sm font-semibold">Bill puri tarah clear ho chuka hai! ✓</p>
              </div>
            )}

            {/* Terms & Conditions */}
            <div className="border-t border-slate-200 pt-4 text-[10px] text-slate-600 space-y-1 leading-relaxed">
              <p className="font-bold text-slate-800 text-xs">Terms & Conditions:</p>
              <div dangerouslySetInnerHTML={{ __html: getPoliciesHtml() }} />
            </div>

            {/* Signatures */}
            <div className="flex justify-between items-end pt-6">
              <div className="w-2/5 text-center border-t border-slate-400 pt-1">
                {mainBillRental.signature ? (
                  <img
                    src={mainBillRental.signature}
                    alt="Authorized signature"
                    className="max-h-12 mx-auto mb-1 object-contain"
                  />
                ) : null}
                <p className="text-[10px] font-bold uppercase text-slate-500">
                  Authorized Signature
                </p>
              </div>

              <div className="text-center">
                <p className="text-xs font-semibold text-slate-800">
                  {(mainBillRental as any).confirmationChecked ? "☑ Confirmed" : "☐ Unconfirmed"}
                </p>
              </div>

              <div className="w-2/5 text-center border-t border-slate-400 pt-1">
                <p className="text-[10px] font-bold uppercase text-slate-500">
                  Client Signature
                </p>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
