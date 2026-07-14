import { useMemo, useState, useEffect } from "react";
import { z } from "zod";
import { toast } from "sonner";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Plus, Calendar } from "lucide-react";
import { useStore } from "@/data/store";
import { formatCurrencyINR } from "@/lib/utils";

import type { Rental, RentalStatus } from "@/data/mock";

const schema = z
  .object({
    billNo: z.string().trim().max(40).optional().or(z.literal("")),
    address: z.string().trim().max(200).optional().or(z.literal("")),
    deliveryDate: z.string().min(1),
    deliveryTime: z.string().min(1, "Delivery time required"),
    deliveryTimePeriod: z.enum(["Morning", "Afternoon", "Evening", "Night", ""]).optional().or(z.literal("")),
    startDate: z.string().min(1),
    endDate: z.string().min(1),
    endTime: z.string().min(1, "Return time required"),
    endTimePeriod: z.enum(["Morning", "Afternoon", "Evening", "Night", ""]).optional().or(z.literal("")),
    rate: z.coerce.number().min(0),
    quantity: z.coerce.number().int().min(1),
    lostQuantity: z.coerce.number().int().min(0),
    additionalPayment: z.coerce.number().min(0),
    discount: z.coerce.number().min(0),
    advance: z.coerce.number().min(0),
    securityAmount: z.coerce.number().min(0),
    securityReturned: z.boolean().optional(),
    remarkCompleted: z.boolean().optional(),
    remarkConfirmedBy: z.string().optional(),
    drycleanCompleted: z.boolean().optional(),
    drycleanCompletedBy: z.string().optional(),
    drycleanAdminConfirmed: z.boolean().optional(),
    drycleanAdminConfirmedBy: z.string().optional(),
    remark: z.string().trim().max(300).optional(),
    signature: z.string().optional(),
    status: z.enum(["active", "upcoming", "returned", "overdue"]),
    ownerNumber: z.string().optional(),
    instaId: z.string().optional(),
    billMakingDate: z.string().optional(),
    confirmationChecked: z.boolean().optional(),
    securityRefundNote: z.string().optional(),
    securityRefundDeduction: z.coerce.number().min(0).optional(),
  })
  .refine((d) => new Date(d.endDate) >= new Date(d.startDate), {
    message: "End date must be after start date",
    path: ["endDate"],
  });

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const parts = dateStr.split("T")[0].split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function daysBetween(start: string, end: string) {
  if (!start || !end) return 0;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 0;
  return Math.max(1, Math.round((e - s) / 86400000));
}

function getRentalAmount(rental: Rental, itemPriceFallback = 0) {
  const savedRate = Number((rental as any).rate);
  if (Number.isFinite(savedRate) && savedRate > 0) return savedRate;

  const savedTotal = Number(rental.total);
  const savedDiscount = Number(rental.discount);
  if (Number.isFinite(savedTotal) && savedTotal > 0) {
    return savedTotal + (Number.isFinite(savedDiscount) ? savedDiscount : 0);
  }

  return itemPriceFallback;
}

function isSafaItem(item: any) {
  const text = [item?.name, item?.category, item?.subcategory].filter(Boolean).join(" ").toLowerCase();
  return text.includes("safa");
}

function getTimePeriod(timeStr: string) {
  if (!timeStr) return "";
  const hour = parseInt(timeStr.split(":")[0], 10);
  if (isNaN(hour)) return "";
  if (hour >= 6 && hour < 12) return "Morning";
  if (hour >= 12 && hour < 17) return "Afternoon";
  if (hour >= 17 && hour < 21) return "Evening";
  return "Night";
}

const DEFAULT_POLICIES = `1. Please return the rented piece on or before the due date to avoid penalty charges.\n2. Any damage, burns, or alterations to the piece will incur additional fees.\n3. Booking advance is strictly non-refundable.\n4. Original ID proof must be deposited at the time of pickup.\n\n1. कृपया पेनल्टी शुल्क से बचने के लिए किराए पर ली गई ड्रेस को नियत तारीख पर या उससे पहले वापस करें।\n2. ड्रेस में किसी भी प्रकार का नुकसान, जलने या बदलाव होने पर अतिरिक्त शुल्क लिया जाएगा।\n3. बुकिंग एडवांस वापस नहीं किया जाएगा।\n4. पिकअप के समय मूल आईडी प्रूफ जमा करना अनिवार्य है।`;
function getPoliciesHtml() {
  const policies = typeof window !== "undefined" ? localStorage.getItem("rental_policies") ?? DEFAULT_POLICIES : DEFAULT_POLICIES;
  return policies.replace(/\n/g, "<br/>");
}

export function EditRentalDialog({
  rental,
  onUpdated,
  trigger,
  disabled,
}: {
  rental: Rental;
  onUpdated?: (updated: Rental) => void;
  trigger: React.ReactNode;
  disabled?: boolean;
}) {
  const { items, getItem, getCustomer, updateRental, updateItem, rentals } = useStore();

  const rentalItem = useMemo(() => getItem(rental.itemId), [getItem, rental.itemId]);
  const customer = useMemo(() => getCustomer(rental.customerId), [getCustomer, rental.customerId]);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [itemEditors, setItemEditors] = useState<Record<string, any>>({});

  const [form, setForm] = useState({
    billNo: rental.billNo ?? "",
    address: rental.address ?? "",
    deliveryDate: rental.deliveryDate ? rental.deliveryDate.slice(0, 10) : today(),
    deliveryTime: (rental as any).deliveryTime || "10:00",
    deliveryTimePeriod: (rental as any).deliveryTimePeriod || "Morning",
    startDate: rental.startDate ? rental.startDate.slice(0, 10) : today(),
    endDate: rental.endDate ? rental.endDate.slice(0, 10) : today(),
    endTime: (rental as any).endTime || "10:00",
    endTimePeriod: (rental as any).endTimePeriod || "Morning",
    rate: getRentalAmount(
      rental,
      rentalItem ? rentalItem.pricePerDay * daysBetween(rental.startDate || today(), rental.endDate || today()) : 0,
    ),
    quantity: (rental as any).quantity ?? 1,
    lostQuantity: (rental as any).lostQuantity ?? 0,
    discount: rental.discount ?? 0,
    advance: rental.advance ?? 0,
    additionalPayment: 0,
    securityAmount: rental.securityAmount ?? 0,
    securityReturned: Boolean((rental as any).securityReturned),
    remarkCompleted: Boolean((rental as any).remarkCompleted),
    remarkConfirmedBy: (rental as any).remarkConfirmedBy ?? "",
    drycleanCompleted: Boolean((rental as any).drycleanCompleted),
    drycleanCompletedBy: (rental as any).drycleanCompletedBy ?? "",
    drycleanAdminConfirmed: Boolean((rental as any).drycleanAdminConfirmed),
    drycleanAdminConfirmedBy: (rental as any).drycleanAdminConfirmedBy ?? "",
    remark: rental.remark ?? "",
    signature: (rental.signature as string | undefined) ?? "",
    status: (rental.status ?? "upcoming") as RentalStatus,
    ownerNumber: (rental as any).ownerNumber ?? "",
    instaId: (rental as any).instaId ?? "",
    billMakingDate: (rental as any).billMakingDate ? String((rental as any).billMakingDate).slice(0, 10) : today(),
    confirmationChecked: Boolean((rental as any).confirmationChecked),
    securityRefundNote: (rental as any).securityRefundNote ?? "",
    securityRefundDeduction: 0,
  });

  const [billNoLoading, setBillNoLoading] = useState(false);

  const relatedRentals = useMemo(() => {
    if (rental.billNo) {
      return rentals.filter((r) => r.billNo === rental.billNo);
    }
    return [rental];
  }, [rentals, rental.billNo, rental.id]);

  async function ensureBillNo() {
    if (form.billNo?.trim()) return;
    setBillNoLoading(true);

    // Find gaps and reuse the lowest available deleted bill number
    const existingNos = rentals
      .map((r) => r.billNo)
      .filter(Boolean)
      .map((b) => {
        const match = String(b).match(/BILL-(\d+)/i);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => n > 0);

    const sorted = Array.from(new Set(existingNos)).sort((a, b) => a - b);
    let nextSeq = 1;
    for (const num of sorted) {
      if (num === nextSeq) {
        nextSeq++;
      } else if (num > nextSeq) {
        break;
      }
    }

    setForm((c) => ({ ...c, billNo: `BILL-${String(nextSeq).padStart(4, "0")}` }));
    setBillNoLoading(false);
  }

  useEffect(() => {
    if (open && !form.billNo) {
      ensureBillNo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const createItemEditorState = (entry: Rental) => {
    const entryItem = getItem(entry.itemId);
    const entryRate = getRentalAmount(
      entry,
      entryItem ? entryItem.pricePerDay * daysBetween(entry.startDate || today(), entry.endDate || today()) : 0,
    );
    return {
      billNo: entry.billNo ?? "",
      address: entry.address ?? "",
      deliveryDate: entry.deliveryDate ? entry.deliveryDate.slice(0, 10) : today(),
      deliveryTime: (entry as any).deliveryTime || "10:00",
      deliveryTimePeriod: (entry as any).deliveryTimePeriod || "Morning",
      startDate: entry.startDate ? entry.startDate.slice(0, 10) : today(),
      endDate: entry.endDate ? entry.endDate.slice(0, 10) : today(),
      endTime: (entry as any).endTime || "10:00",
      endTimePeriod: (entry as any).endTimePeriod || "Morning",
      rate: entryRate,
      quantity: (entry as any).quantity ?? 1,
      lostQuantity: (entry as any).lostQuantity ?? 0,
      discount: entry.discount ?? 0,
      advance: entry.advance ?? 0,
      securityAmount: entry.securityAmount ?? 0,
      securityReturned: Boolean((entry as any).securityReturned),
      remarkCompleted: Boolean((entry as any).remarkCompleted),
      remarkConfirmedBy: (entry as any).remarkConfirmedBy ?? "",
      drycleanCompleted: Boolean((entry as any).drycleanCompleted),
      drycleanCompletedBy: (entry as any).drycleanCompletedBy ?? "",
      drycleanAdminConfirmed: Boolean((entry as any).drycleanAdminConfirmed),
      drycleanAdminConfirmedBy: (entry as any).drycleanAdminConfirmedBy ?? "",
      remark: entry.remark ?? "",
      signature: (entry.signature as string | undefined) ?? "",
      status: (entry.status ?? "upcoming") as RentalStatus,
      ownerNumber: (entry as any).ownerNumber ?? "",
      instaId: (entry as any).instaId ?? "",
      billMakingDate: (entry as any).billMakingDate ? String((entry as any).billMakingDate).slice(0, 10) : today(),
      confirmationChecked: Boolean((entry as any).confirmationChecked),
    };
  };

  useEffect(() => {
    if (!open) return;
    const nextEditors = Object.fromEntries(
      relatedRentals.map((entry) => [entry.id, createItemEditorState(entry)]),
    );
    setItemEditors(nextEditors);
  }, [open, relatedRentals, getItem]);

  const isSafaRental = isSafaItem(rentalItem);
  const rentalQuantity = isSafaRental ? Math.max(1, Number(form.quantity) || 1) : 1;
  const subtotal = (form.rate || 0) * rentalQuantity;
  const totalBill = subtotal - form.discount + form.securityAmount;

  const updateItemEditor = (entryId: string, patch: Partial<any>) => {
    setItemEditors((current) => ({
      ...current,
      [entryId]: {
        ...(current[entryId] || {}),
        ...patch,
      },
    }));
  };

  const computedPieces = useMemo(() => {
    let aggSubtotalLocal = 0;
    let aggAdvanceLocal = 0;
    let aggSecurityLocal = 0;
    let aggDiscountLocal = 0;
    let aggSecurityRefundDueLocal = 0;

    const pieces = relatedRentals.map((r) => {
      const editor = itemEditors[r.id] || createItemEditorState(r);
      const rItem = getItem(r.itemId);
      const rStartDate = editor.startDate;
      const rEndDate = editor.endDate;
      const rDeliveryDate = editor.deliveryDate;
      const rDeliveryTime = editor.deliveryTime;
      const rDeliveryTimePeriod = editor.deliveryTimePeriod;
      const rEndTime = editor.endTime;
      const rEndTimePeriod = editor.endTimePeriod;
      const rQuantity = isSafaItem(rItem) ? Math.max(1, Number(editor.quantity) || 1) : 1;
      const rLostQuantity = Number(editor.lostQuantity) || 0;
      const d = daysBetween(rStartDate, rEndDate);
      const rRate = Number(editor.rate) || getRentalAmount(r, rItem ? rItem.pricePerDay * daysBetween(rStartDate, rEndDate) : 0);
      const rSubtotal = rRate * rQuantity;

      aggSubtotalLocal += rSubtotal;
      aggDiscountLocal += Number(editor.discount) || 0;
      aggAdvanceLocal += Number(editor.advance) || 0;
      const rSecurity = Number(editor.securityAmount) || 0;
      const rSecurityReturned = Boolean(editor.securityReturned);
      aggSecurityLocal += rSecurity;

      const rStatus = editor.status;
      aggSecurityRefundDueLocal += rStatus === "returned" && rSecurityReturned ? 0 : rSecurity;

      return {
        r,
        rItem,
        isCurrent: false,
        rStartDate,
        rEndDate,
        rDeliveryDate,
        rDeliveryTime,
        rDeliveryTimePeriod,
        rEndTime,
        rEndTimePeriod,
        d,
        rRate,
        rSubtotal,
        rQuantity,
        rLostQuantity,
      };
    });

    const aggTotalLocal = aggSubtotalLocal - aggDiscountLocal + aggSecurityLocal;
    const aggFinalDueLocal = Math.max(0, aggTotalLocal - aggAdvanceLocal);

    return {
      pieces,
      aggSubtotal: aggSubtotalLocal,
      aggAdvance: aggAdvanceLocal,
      aggSecurity: aggSecurityLocal,
      aggDiscount: aggDiscountLocal,
      aggSecurityRefundDue: aggSecurityRefundDueLocal,
      aggTotal: aggTotalLocal,
      aggFinalDue: aggFinalDueLocal,
    };
  }, [relatedRentals, getItem, itemEditors, form.additionalPayment]);

  const piecesData = computedPieces.pieces;
  const aggSubtotal = computedPieces.aggSubtotal;
  const aggAdvance = computedPieces.aggAdvance;
  const aggDiscount = computedPieces.aggDiscount;
  const aggSecurity = computedPieces.aggSecurity;
  const aggSecurityRefundDue = computedPieces.aggSecurityRefundDue;
  const aggTotal = computedPieces.aggTotal;
  const aggFinalDue = computedPieces.aggFinalDue;


  function renderThermalBody() {
    let invoiceTitle = "INVOICE";
    if (form.status === "upcoming") invoiceTitle = "BOOKING INVOICE";
    else if (form.status === "active") invoiceTitle = "DELIVERY INVOICE";
    else if (form.status === "returned") invoiceTitle = "FINAL INVOICE";
    else if (form.status === "overdue") invoiceTitle = "OVERDUE FINAL BILL";

    const thermalPiecesHtml = piecesData.map(({ r, rItem, rDeliveryDate, rEndDate, rDeliveryTime, rDeliveryTimePeriod, rEndTime, rEndTimePeriod, rRate, rQuantity, rLostQuantity }) => `
      ${rItem?.image ? `<div style="text-align: center; margin-bottom: 6px;"><img src="${rItem.image}" style="max-height: 80px; max-width: 100%; border-radius: 4px; object-fit: cover;" /></div>` : ""}
      <div class="thermal-item-name">${rItem?.name || "Unknown item"}</div>
      <div class="thermal-row"><span>Item No</span><span>${r.itemNo || r.itemId}</span></div>
      <div class="thermal-row"><span>Dates</span><span>Del: ${formatDate(rDeliveryDate.slice(0, 10))}${rDeliveryTime ? ` ${rDeliveryTime}` : ""}${rDeliveryTimePeriod ? ` (${rDeliveryTimePeriod})` : ""} | Return: ${formatDate(rEndDate.slice(0, 10))}${rEndTime ? ` ${rEndTime}` : ""}${rEndTimePeriod ? ` (${rEndTimePeriod})` : ""}</span></div>
      <div class="thermal-row"><span>Qty / Rate</span><span>${rQuantity} x ${formatCurrencyINR(rRate)}</span></div>
      ${rLostQuantity > 0 ? `<div class="thermal-row"><span>Lost Safa</span><span>${rLostQuantity}</span></div>` : ""}
      <div class="thermal-divider"></div>
    `).join("");

    return `
      <div class="thermal">
        <div style="text-align: center; font-size: 11px; font-weight: bold; margin-bottom: 6px;">
          <div style="margin-bottom: 2px;">॥ श्री शंखेश्वर पार्श्वनाथाय नमः ॥</div>
          <div>॥ श्री आदिनाथाय नमः ॥</div>
        </div>
        <div style="text-align: center; margin-bottom: 6px;">
          <h2 style="margin: 0; font-size: 14px;">ARIHANT COLLECTION </h2>
          <div style="font-size: 10px; margin-top: 2px;">Address: Maharana Pratap chowk near gas agency</div>
          <div style="font-size: 10px; margin-top: 2px;">Contact: 9907050222, 7509942222 | Insta: Sajansagar_</div>
        </div>
        <div class="thermal-title">${invoiceTitle}</div>
        <div class="thermal-row"><span>Invoice</span><span># ${rental.billNo || rental.id}</span></div>
        <div class="thermal-row"><span>Date</span><span>${form.billMakingDate ? new Date(form.billMakingDate).toLocaleDateString('en-IN') : "-"}</span></div>
        <div class="thermal-row"><span>Client</span><span>${customer?.name || rental.customerId}</span></div>
        ${form.instaId ? `<div class="thermal-row"><span>Insta ID</span><span>${form.instaId}</span></div>` : ""}
        <div class="thermal-divider"></div>

        ${thermalPiecesHtml}

        <div class="thermal-row"><span>Total Rent</span><span>${formatCurrencyINR(aggSubtotal)}</span></div>
        <div class="thermal-row"><span>Discount</span><span>-${formatCurrencyINR(aggDiscount)}</span></div>
        <div class="thermal-row"><span>Security Received</span><span>${formatCurrencyINR(aggSecurity)}</span></div>
        <div class="thermal-row"><span>Total Bill</span><span>${formatCurrencyINR(aggTotal)}</span></div>
        <div class="thermal-row"><span>Amount Paid</span><span>${formatCurrencyINR(aggAdvance)}</span></div>
        <div class="thermal-row"><span>Security Refund</span><span>${formatCurrencyINR(aggSecurityRefundDue)}</span></div>
        <div class="thermal-row thermal-total"><span>Balance</span><span>${formatCurrencyINR(aggFinalDue)}</span></div>

        <div class="thermal-divider"></div>
        <div style="font-size: 9px; margin-top: 10px; color: #444;">
          <strong style="font-size: 10px; color: #111;">Terms & Conditions:</strong><br/>
          ${getPoliciesHtml()}
        </div>

        <div class="thermal-signs">
          <div class="thermal-sign-box">
            ${form.signature ? `<img src="${form.signature}" class="thermal-sign-img" />` : ""}
            <div class="thermal-sign-line">Authorized Signature</div>
          </div>
          <div style="text-align: center; margin-top: 10px;">
            <span>${form.confirmationChecked ? "☑" : "☐"} Confirmed</span>
          </div>
        </div>

        <div class="thermal-footer">Thank you for choosing ARIHANT COLLECTION !</div>

      </div>
    `;
  }

  const invoiceNote = (form.status === "returned" || form.status === "overdue")
    ? "Final bill confirms rental dues and security refund clearance."
    : form.status === "active"
    ? "Delivery invoice reflects the current balance. Set status to Returned for the final bill."
    : "Booking invoice reflects the advance paid. Change status to Active for delivery or Returned for the final bill.";

  const handleStatusChange = (v: RentalStatus) => {
    if (v === "returned") {
      const confirmed = window.confirm("Are all dues clear? Please confirm that all balances are settled before marking as returned.");
      if (!confirmed) return;
    }

    let newAdvance = form.advance;
    let newSecurityReturned = form.securityReturned;
    let newLostQuantity = form.lostQuantity;


    if (v === "active" && form.status !== "active") {
      const confirmed = window.confirm("Is all amount paid?");
      if (!confirmed) return;
      newAdvance = form.advance + subtotal;
      toast.success(`Added ${formatCurrencyINR(subtotal)} to amount paid.`);
    }

    if (v === "returned") {
      if (form.securityAmount > 0 && !form.securityReturned) {
        const securityConfirmed = window.confirm(
          `Has the security amount ${formatCurrencyINR(form.securityAmount)} been returned to the customer and cleared?`,
        );
        if (!securityConfirmed) {
          toast.error("Security amount must be cleared before marking returned");
          return;
        }
        newSecurityReturned = true;
      }

      if (isSafaRental) {
        const returnedInput = window.prompt(
          `Safa rented: ${rentalQuantity}. How many Safa did customer return?`,
          String(Math.max(0, rentalQuantity - form.lostQuantity)),
        );
        if (returnedInput == null) return;
        const returnedQty = Math.max(0, Math.min(rentalQuantity, Number(returnedInput) || 0));
        const lostQty = Math.max(0, rentalQuantity - returnedQty);
        newLostQuantity = lostQty;
        if (lostQty > 0) {
          toast.info(`${lostQty} Safa marked lost. Inventory will reduce when saved.`);
        }
      }
    } else {
      newSecurityReturned = false;
      newLostQuantity = 0;
    }

    const nextFinalDue = (() => {
      return Math.max(0, totalBill - newAdvance);
    })();

    if (v === "returned" && nextFinalDue > 0) {
      toast.error("All dues must be cleared before marking as returned");
      return;
    }

    setForm((c) => ({ ...c, status: v, advance: newAdvance, securityReturned: newSecurityReturned, lostQuantity: newLostQuantity }));
  };

  const handleSignatureUpload = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file for the signature");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Signature file must be smaller than 2 MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setForm((c) => ({ ...c, signature: (reader.result as string) ?? "" }));
      }
    };
    reader.onerror = () => toast.error("Could not read signature file");
    reader.readAsDataURL(file);
  };

  function shareOnWhatsApp() {
    let invoiceTitle = "Invoice";
    if (form.status === "upcoming") invoiceTitle = "Booking Invoice";
    else if (form.status === "active") invoiceTitle = "Delivery Invoice";
    else if (form.status === "returned") invoiceTitle = "Final Invoice";
    else if (form.status === "overdue") invoiceTitle = "Overdue Final Bill";

    const message = `*ARIHANT COLLECTION  - ${invoiceTitle}*
      
*Invoice:* ${rental.billNo || rental.id}
*Date:* ${form.billMakingDate ? new Date(form.billMakingDate).toLocaleDateString('en-IN') : "-"}
*Client:* ${customer?.name || rental.customerId}
*Pieces:* 
${piecesData.map(p => `- ${p.rItem?.name || "Unknown"} (${p.r.itemNo || p.r.itemId}) [Qty: ${p.rQuantity}${p.rLostQuantity > 0 ? `, Lost: ${p.rLostQuantity}` : ""} | Del: ${formatDate(p.rDeliveryDate.slice(0, 10))}${p.rDeliveryTime ? ` ${p.rDeliveryTime}` : ""}${p.rDeliveryTimePeriod ? ` (${p.rDeliveryTimePeriod})` : ""} | Return: ${formatDate(p.rEndDate.slice(0, 10))}${p.rEndTime ? ` ${p.rEndTime}` : ""}${p.rEndTimePeriod ? ` (${p.rEndTimePeriod})` : ""}] - ${formatCurrencyINR(p.rSubtotal)}`).join("\n")}

*Total Rent:* ${formatCurrencyINR(aggSubtotal)}
*Discount:* -${formatCurrencyINR(aggDiscount)}
*Security Received:* ${formatCurrencyINR(aggSecurity)}
*Total Bill:* ${formatCurrencyINR(aggTotal)}
*Amount Paid:* ${formatCurrencyINR(aggAdvance)}
*Security Refund:* ${formatCurrencyINR(aggSecurityRefundDue)}
*Balance:* ${formatCurrencyINR(aggFinalDue)}

Thank you for choosing ARIHANT COLLECTION !`;


    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
  }

  type InvoiceMode = "A4" | "THERMAL";

  function getInvoiceContent() {
    let invoiceTitle = "Invoice";
    if (form.status === "upcoming") invoiceTitle = "Booking Invoice";
    else if (form.status === "active") invoiceTitle = "Delivery Invoice";
    else if (form.status === "returned") invoiceTitle = "Final Invoice";
    else if (form.status === "overdue") invoiceTitle = "Overdue Final Bill";

    const piecesHtml = piecesData.map(({ r, rItem, rStartDate, rEndDate, rDeliveryDate, rDeliveryTime, rDeliveryTimePeriod, rEndTime, rEndTimePeriod, rRate, rSubtotal, rQuantity, rLostQuantity }) => `
      <tr>
        <td>${rItem?.image ? `<img src="${rItem.image}" style="width: 35px; height: 45px; object-fit: cover; border-radius: 3px;" />` : ""}</td>
        <td><strong>${rItem?.name || "Unknown item"}</strong><br/><span style="font-size: 9px; color: #666;">Qty: ${rQuantity}${rLostQuantity > 0 ? ` | Lost: ${rLostQuantity}` : ""} | Del: ${formatDate(rDeliveryDate.slice(0, 10))}${rDeliveryTime ? ` ${rDeliveryTime}` : ""}${rDeliveryTimePeriod ? ` (${rDeliveryTimePeriod})` : ""} | Return: ${formatDate(rEndDate.slice(0, 10))}${rEndTime ? ` ${rEndTime}` : ""}${rEndTimePeriod ? ` (${rEndTimePeriod})` : ""}</span></td>
        <td>${r.itemNo || r.itemId}</td>
        <td class="text-right">${formatCurrencyINR(rRate)}</td>
        <td class="text-right">${formatCurrencyINR(rSubtotal)}</td>
      </tr>
    `).join("");

    return `
      <style>
        .header { display: flex; align-items: center; border-bottom: 2px solid #d4af37; padding-bottom: 6px; margin-bottom: 10px; }
        .logo { width: 45px; height: 45px; margin-right: 12px; }
        .company-info h1 { margin: 0; font-size: 18px; color: #111; letter-spacing: 1.2px; text-transform: uppercase; }
        .company-info p { margin: 2px 0 0 0; color: #666; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; }
        .invoice-title { margin-left: auto; text-align: right; }
        .invoice-title h2 { margin: 0; color: #d4af37; font-size: 22px; letter-spacing: 1.2px; text-transform: uppercase; }
        .invoice-title p { margin: 2px 0 0 0; font-size: 11px; color: #555; }
        .grid { display: flex; justify-content: space-between; margin-bottom: 10px; gap: 15px; }
        .col { flex: 1; }
        .label { font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
        .value { font-size: 11px; margin: 0 0 2px 0; line-height: 1.3; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        th, td { padding: 4px 6px; text-align: left; border-bottom: 1px solid #eaeaea; font-size: 11px; }
        th { font-size: 9px; text-transform: uppercase; color: #666; letter-spacing: 0.5px; border-bottom: 2px solid #222; }
        .text-right { text-align: right; }
        .summary-box { width: 50%; margin-left: auto; }
        .row { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid #eaeaea; font-size: 11px; }
        .row.total { font-weight: bold; font-size: 13px; border-top: 2px solid #222; border-bottom: none; padding-top: 6px; margin-top: 4px; color: #d4af37; }
        .signatures { display: flex; justify-content: space-between; margin-top: 20px; page-break-inside: avoid; }
        .sign-box { flex: 0 0 40%; text-align: center; min-height: 50px; border-bottom: 1px solid #222; display: flex; flex-direction: column; justify-content: flex-end; padding-bottom: 4px; }
        .sign-box p { margin: 0; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #666; }
        .sign-img { max-height: 45px; max-width: 100%; margin: 0 auto 4px auto; object-fit: contain; }
        .invoice-half { min-height: 100%; padding: 5mm 0; box-sizing: border-box; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #222; position: relative; z-index: 1; }
        .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 60px; color: rgba(212, 175, 55, 0.1); z-index: -1; white-space: nowrap; pointer-events: none; font-weight: bold; }
        tr { page-break-inside: avoid; }
      </style>
      <div class="invoice-half">
        <div class="watermark">ARIHANT COLLECTION </div>
        <div style="text-align: center; font-size: 14px; font-weight: bold; color: #d4af37; margin-bottom: 12px;">
          <div style="margin-bottom: 4px;">॥ श्री शंखेश्वर पार्श्वनाथाय नमः ॥</div>
          <div>॥ श्री आदिनाथाय नमः ॥</div>
        </div>
        <div class="header">
          <svg class="logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
            <rect width="100" height="100" fill="#111" rx="8" />
            <text x="50" y="62" text-anchor="middle" font-family="Georgia, serif" font-size="28" fill="#d4af37" font-style="italic">SS</text>
          </svg>
          <div class="company-info">
            <h1 style="margin-bottom: 4px;">ARIHANT COLLECTION </h1>
            <p style="text-transform: none; margin-bottom: 2px;">Address: Maharana Pratap chowk near gas agency</p>
            <p style="text-transform: none; margin-bottom: 2px; color: #111;">Contact: <strong>9907050222, 7509942222</strong> | Insta: <strong>Sajansagar_</strong></p>
          </div>
          <div class="invoice-title">
            <h2>${invoiceTitle}</h2>
            <p># ${rental.billNo || rental.id}</p>
            <p>Date: ${form.billMakingDate ? new Date(form.billMakingDate).toLocaleDateString('en-IN') : "-"}</p>
          </div>
        </div>
        
        <div class="grid">
          <div class="col">
            <div class="label">Billed To</div>
            <p class="value"><strong>${customer?.name || rental.customerId}</strong></p>
            <p class="value">${customer?.email || ""}</p>
            <p class="value">${customer?.phone || ""}</p>
            <p class="value">${form.address || rental.address || ""}</p>
            ${form.instaId ? `<p class="value"><strong>Insta ID:</strong> ${form.instaId}</p>` : ""}
          </div>
          <div class="col" style="text-align: right;">
            <div class="label">Rental Details</div>
            <p class="value"><strong>Status:</strong> ${form.status.toUpperCase()}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 60px;">Image</th>
              <th>Item Description & Dates</th>
              <th>Item No</th>
              <th class="text-right">Rate</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${piecesHtml}
          </tbody>
        </table>

        <div class="summary-box">
          <div class="row"><span>Total Rent</span><span>${formatCurrencyINR(aggSubtotal)}</span></div>
          <div class="row"><span>Discount</span><span>-${formatCurrencyINR(aggDiscount)}</span></div>
          <div class="row"><span>Security Deposit</span><span>${formatCurrencyINR(aggSecurity)}</span></div>
          <div class="row"><span>Total Bill</span><span>${formatCurrencyINR(aggTotal)}</span></div>
          <div class="row"><span>Amount Paid</span><span>${formatCurrencyINR(aggAdvance)}</span></div>
          <div class="row"><span>Security Refund</span><span>${formatCurrencyINR(aggSecurityRefundDue)}</span></div>
          <div class="row total"><span>Balance</span><span>${formatCurrencyINR(aggFinalDue)}</span></div>
        </div>

        <div style="margin-top: 20px; font-size: 10px; color: #555; border-top: 1px solid #eaeaea; padding-top: 10px; line-height: 1.5;">
          <strong style="color: #222; font-size: 11px;">Terms & Conditions:</strong><br/>
          ${getPoliciesHtml()}
        </div>

        <div class="signatures" style="margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div style="display: flex; align-items: flex-end; gap: 20px; flex: 1;">
            <div class="sign-box" style="flex: 1;">
              ${form.signature ? `<img src="${form.signature}" class="sign-img" />` : ""}
              <p>Authorized Signature</p>
            </div>
            <div style="padding-bottom: 5px;">
              <p class="value"><span style="font-size: 22px; vertical-align: middle;">${form.confirmationChecked ? "☑" : "☐"}</span> <strong style="vertical-align: middle;">Confirmed</strong></p>
            </div>
          </div>
          <div class="sign-box" style="flex: 1;">
            <p>Client Signature</p>
          </div>
        </div>
      </div>
    `;
  }

  function getInvoiceHtml(mode: InvoiceMode = "A4") {
    if (mode === "THERMAL") {
      return `
        <html>
          <head>
            <title>Invoice ${rental.id}</title>
            <style>
              @page { size: 80mm auto; margin: 0; }
              body { margin: 0; padding: 0; }
              .thermal { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 10px 6px; color: #111; font-size: 11px; }
              .thermal-title { text-align: center; font-weight: 800; letter-spacing: 1px; margin-bottom: 6px; }
              .thermal-row { display: flex; justify-content: space-between; gap: 10px; margin: 3px 0; }
              .thermal-divider { border-top: 1px dashed #bbb; margin: 10px 0; }
              .thermal-item-name { font-weight: 800; margin-top: 6px; }
              .thermal-item-sub { margin-top: 2px; color: #666; font-size: 10px; }
              .thermal-total { font-weight: 800; }
              .thermal-signs { margin-top: 14px; }
              .thermal-sign-box { border-top: 1px solid #222; padding-top: 12px; display: flex; flex-direction: column; align-items: center; }
              .thermal-sign-img { max-height: 50px; max-width: 100%; margin-bottom: 4px; }
              .thermal-sign-line { font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #666; margin-top: 2px; }
              .thermal-footer { text-align: center; margin-top: 12px; font-size: 10px; color: #555; }
            </style>
          </head>
          <body>
            ${renderThermalBody()}
          </body>
        </html>
      `;
    }

    return `
      <html>
        <head>
          <title>Invoice ${rental.id}</title>
          <style>
            @page { size: A4; margin: 10mm 15mm; }
            body { margin: 0; padding: 0; background: #fff; }
          </style>
        </head>
        <body>
          ${getInvoiceContent()}
        </body>
      </html>
    `;
  }

  async function downloadBill() {
    if (typeof window === "undefined") return;

    toast.info("Generating PDF...");

    // @ts-ignore
    const html2pdf = (await import("html2pdf.js")).default;

    const filenameSafe = `${rental.billNo || "Invoice"}-${rental.id}`.replace(
      /[^a-z0-9-_]/gi,
      "-",
    );
    const filename = `Invoice-${filenameSafe}.pdf`;

    try {
      const htmlString = `
        <div id="pdf-container" style="background-color: #ffffff; color: #000000; padding: 0; margin: 0; width: 100%;">
          <style>
            #pdf-container, #pdf-container * {
              border-color: #e5e7eb !important;
              outline-color: #e5e7eb !important;
            }
          </style>
          ${getInvoiceContent()}
        </div>
      `;

      await html2pdf()
        .set({
          margin: 10,
          filename,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff",
            ignoreElements: (element: Element) => {
              if (element.tagName === "STYLE" || element.tagName === "LINK") {
                const href = (element as HTMLLinkElement).href || "";
                if (href.includes("fonts.googleapis") || href.includes("fonts.gstatic")) return false;
                if (element.closest && element.closest("#pdf-container")) return false;
                return true;
              }
              return false;
            },
          },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(htmlString)
        .save();


      toast.success("Bill downloaded as PDF");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF bill");
    }
  }

  function printInvoice() {
    if (typeof window === "undefined") return;

    const invoiceHtml = getInvoiceHtml("A4");

    const printWindow = window.open("", "_blank", "width=800,height=900");
    if (!printWindow) {
      toast.error("Unable to open print window.");
      return;
    }
    printWindow.document.write(invoiceHtml);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await ensureBillNo();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    if (!rentalItem) {
      toast.error("Selected piece not found");
      return;
    }

    const newStart = new Date(parsed.data.startDate || parsed.data.deliveryDate);
    newStart.setHours(0, 0, 0, 0);
    const newEnd = new Date(parsed.data.endDate);
    newEnd.setHours(0, 0, 0, 0);

    const overlappingRental = rentals.find((r) => {
      if (r.id === rental.id) return false;
      if (r.itemId !== rental.itemId) return false;
      if (r.status === "returned") return false;

      const existingStart = new Date(r.startDate || r.deliveryDate || "");
      existingStart.setHours(0, 0, 0, 0);
      const existingEnd = new Date(r.endDate || "");
      existingEnd.setHours(0, 0, 0, 0);

      return newStart.getTime() <= existingEnd.getTime() && newEnd.getTime() >= existingStart.getTime();
    });

    if (overlappingRental) {
      toast.error(`This piece is already booked from ${formatDate(overlappingRental.startDate)} to ${formatDate(overlappingRental.endDate)}.`);
      return;
    }

    setLoading(true);
    try {
      const updates = await Promise.all(
        relatedRentals.map(async (entry) => {
          const entryEditor = itemEditors[entry.id] || createItemEditorState(entry);
          const entryItem = getItem(entry.itemId);
          const entrySubtotal = (Number(entryEditor.rate) || 0) * (isSafaItem(entryItem) ? Math.max(1, Number(entryEditor.quantity) || 1) : 1);
          const payload = {
            billNo: parsed.data.billNo ?? entryEditor.billNo ?? "",
            address: parsed.data.address ?? entryEditor.address ?? "",
            deliveryDate: entryEditor.deliveryDate,
            deliveryTime: entryEditor.deliveryTime,
            deliveryTimePeriod: entryEditor.deliveryTimePeriod,
            startDate: entryEditor.startDate,
            endDate: entryEditor.endDate,
            endTime: entryEditor.endTime,
            endTimePeriod: entryEditor.endTimePeriod,
            rate: entryEditor.rate,
            quantity: entryEditor.quantity,
            lostQuantity: entryEditor.lostQuantity,
            discount: entryEditor.discount,
            advance: entryEditor.advance,
            securityAmount: entryEditor.securityAmount,
            securityReturned: entryEditor.securityReturned ?? false,
            ...(entryEditor.securityReturned ? { securityReturnedAt: new Date().toISOString() } : {}),
            remarkCompleted: entryEditor.remarkCompleted ?? false,
            remarkConfirmedBy: entryEditor.remarkConfirmedBy ?? "",
            drycleanCompleted: entryEditor.drycleanCompleted ?? false,
            drycleanCompletedBy: entryEditor.drycleanCompletedBy ?? "",
            drycleanAdminConfirmed: entryEditor.drycleanAdminConfirmed ?? false,
            drycleanAdminConfirmedBy: entryEditor.drycleanAdminConfirmedBy ?? "",
            ...(entryEditor.drycleanAdminConfirmed && !(entry as any).drycleanAdminConfirmed ? { drycleanAdminConfirmedAt: new Date().toISOString() } : {}),
            remark: entryEditor.remark ?? "",
            signature: entryEditor.signature ?? "",
            status: entryEditor.status,
            total: entrySubtotal,
            ownerNumber: entryEditor.ownerNumber ?? "",
            instaId: entryEditor.instaId ?? "",
            billMakingDate: entryEditor.billMakingDate ?? "",
            confirmationChecked: entryEditor.confirmationChecked ?? false,
          };

          const updated = await updateRental(entry.id, payload);
          if (entryItem && isSafaItem(entryItem)) {
            const previousLost = Number((entry as any).lostQuantity) || 0;
            const nextLost = entryEditor.status === "returned" ? entryEditor.lostQuantity : 0;
            const lostDelta = nextLost - previousLost;
            if (lostDelta !== 0) {
              const currentStock = Number((entryItem as any).quantity) || 0;
              await updateItem(entryItem.id, {
                quantity: Math.max(0, currentStock - lostDelta),
              } as any);
            }
          }
          return updated;
        }),
      );

      const updated = updates[0];
      onUpdated?.(updated);
      toast.success(`${relatedRentals.length} rental item(s) updated`);
      setOpen(false);
    } catch (err) {
      console.error(err);
      toast.error(`Failed to update rental ${rental.id}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Edit Rental</DialogTitle>
          <DialogDescription>Update the rental details and ledger totals.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-2">
          {/* General Info Section */}
          <div className="space-y-4 rounded-lg border border-border bg-secondary/10 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">Bill Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="billNo">Bill No</Label>
                <Input
                  id="billNo"
                  value={form.billNo}
                  onChange={(e) => setForm((c) => ({ ...c, billNo: e.target.value }))}
                  placeholder={billNoLoading ? "Generating..." : "Enter bill number"}
                  maxLength={40}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => handleStatusChange(v as RentalStatus)}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["upcoming", "active", "returned", "overdue"] as const).map((s) => (
                      <SelectItem key={s} value={s}>
                        {s[0].toUpperCase() + s.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="address">Delivery Address</Label>
                <Input
                  id="address"
                  value={form.address}
                  onChange={(e) => setForm((c) => ({ ...c, address: e.target.value }))}
                  placeholder="Street, city, landmark"
                  maxLength={200}
                />
              </div>
            </div>
          </div>

          {/* Bill Items Section */}
          <div className="space-y-4 rounded-lg border border-border bg-secondary/10 p-4">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bill Items</h3>
              <span className="text-[11px] text-muted-foreground">{relatedRentals.length} item(s)</span>
            </div>
            <div className="space-y-3">
              {relatedRentals.map((entry) => {
                const entryItem = getItem(entry.itemId);
                const editor = itemEditors[entry.id];
                if (!editor) return null; // Guard against rendering before editor state is ready
                const entryIsSafa = isSafaItem(entryItem); 
                const entryQty = entryIsSafa ? Math.max(1, Number(editor.quantity) || 1) : 1;
                const entrySubtotal = (Number(editor.rate) || 0) * entryQty;
                return (
                  <div key={entry.id} className="rounded-md border border-border bg-background p-3 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {entryItem?.name || `Missing piece (${entry.itemId || "unknown"})`}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Item No: {entry.itemNo || entry.itemId}
                        </p>
                      </div>
                      <div className="text-right text-xs text-muted-foreground shrink-0">
                        <p className="font-semibold text-foreground">{formatCurrencyINR(entrySubtotal)}</p>
                        <p>Qty: {entryQty}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="grid gap-2">
                        <Label>Rate (INR)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={editor.rate ?? 0}
                          onChange={(e) => updateItemEditor(entry.id, { rate: Number(e.target.value) })}
                        />
                      </div>
                      {entryIsSafa ? (
                        <div className="grid gap-2">
                          <Label>Quantity</Label>
                          <Input
                            type="number"
                            min={1}
                            value={editor.quantity ?? 1}
                            onChange={(e) => updateItemEditor(entry.id, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                          />
                        </div>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="grid gap-2">
                        <Label>Delivery Date</Label>
                        <Input
                          type="date"
                          value={editor.deliveryDate ?? today()}
                          onChange={(e) => updateItemEditor(entry.id, { deliveryDate: e.target.value })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Return Date</Label>
                        <Input
                          type="date"
                          value={editor.endDate ?? today()}
                          onChange={(e) => updateItemEditor(entry.id, { endDate: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="grid gap-2">
                        <Label>Delivery Time</Label>
                        <Input
                          type="time"
                          value={editor.deliveryTime || "10:00"}
                          onChange={(e) => updateItemEditor(entry.id, { deliveryTime: e.target.value, deliveryTimePeriod: getTimePeriod(e.target.value) })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Return Time</Label>
                        <Input
                          type="time"
                          value={editor.endTime || "10:00"}
                          onChange={(e) => updateItemEditor(entry.id, { endTime: e.target.value, endTimePeriod: getTimePeriod(e.target.value) })}
                        />
                      </div>
                    </div>

                    {entryIsSafa ? (
                      <div className="grid gap-2">
                        <Label>Lost Safa</Label>
                        <Input
                          type="number"
                          min={0}
                          max={entryQty}
                          value={editor.lostQuantity ?? 0}
                          onChange={(e) => updateItemEditor(entry.id, { lostQuantity: Math.max(0, Math.min(entryQty, Number(e.target.value) || 0)) })}
                        />
                      </div>
                    ) : null}

                    <div className="grid gap-2">
                      <Label>Remark</Label>
                      <Textarea
                        rows={2}
                        value={editor.remark ?? ""}
                        onChange={(e) => updateItemEditor(entry.id, { remark: e.target.value })}
                      />
                    </div>

                    {/* Actions & Status Section for each item */}
                    <div className="space-y-3 pt-3 border-t border-border">
                       <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions & Status</h4>
                       <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                         <div className="grid gap-2">
                           <Label>Item Ready</Label>
                           <Button
                             type="button"
                             variant={editor.remarkCompleted ? "default" : "outline"}
                             onClick={async () => {
                               if (!editor.remarkCompleted) {
                                 const name = window.prompt("Enter employee name to mark item as ready:");
                                 if (name) {
                                   const trimmed = name.trim();
                                   updateItemEditor(entry.id, { remarkCompleted: true, remarkConfirmedBy: trimmed });
                                   try {
                                     await updateRental(entry.id, { remarkCompleted: true, remarkConfirmedBy: trimmed } as any);
                                     toast.success("Item marked as ready");
                                   } catch (err) {
                                     toast.error("Failed to update status");
                                   }
                                 }
                               } else {
                                 updateItemEditor(entry.id, { remarkCompleted: false, remarkConfirmedBy: "" });
                                 try {
                                   await updateRental(entry.id, { remarkCompleted: false, remarkConfirmedBy: "" } as any);
                                 } catch (err) {}
                               }
                             }}
                             className={editor.remarkCompleted ? "bg-green-600 hover:bg-green-700 text-white" : ""}
                           >
                             {editor.remarkCompleted ? `Ready (${editor.remarkConfirmedBy})` : "Mark as Ready"}
                           </Button>
                         </div>
                         <div className="grid gap-2">
                           <Label>Dryclean Done</Label>
                           <Button
                             type="button"
                             variant={editor.drycleanCompleted ? "default" : "outline"}
                             onClick={async () => {
                               if (!editor.drycleanCompleted) {
                                 const name = window.prompt("Enter employee name to confirm dryclean:");
                                 if (name) {
                                   const trimmed = name.trim();
                                   updateItemEditor(entry.id, { drycleanCompleted: true, drycleanCompletedBy: trimmed });
                                   try {
                                     await updateRental(entry.id, { drycleanCompleted: true, drycleanCompletedBy: trimmed } as any);
                                     toast.success("Dryclean marked as complete");
                                   } catch (err) {
                                     toast.error("Failed to update status");
                                   }
                                 }
                               } else {
                                 updateItemEditor(entry.id, { drycleanCompleted: false, drycleanCompletedBy: "" });
                                 try {
                                   await updateRental(entry.id, { drycleanCompleted: false, drycleanCompletedBy: "" } as any);
                                 } catch (err) {}
                               }
                             }}
                             className={editor.drycleanCompleted ? "bg-green-600 hover:bg-green-700 text-white" : ""}
                           >
                             {editor.drycleanCompleted ? `Cleaned (${editor.drycleanCompletedBy})` : "Mark Dryclean"}
                           </Button>
                         </div>
                         <div className="grid gap-2">
                           <Label>Admin Confirm</Label>
                           {/* This button is simplified as it was complex and tied to the main form state */}
                           <Button type="button" variant="outline" disabled>Admin Confirm</Button>
                         </div>
                       </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Security Refund Section - visible only when all items are returned */}
          {relatedRentals.every(r => (itemEditors[r.id] || createItemEditorState(r)).status === 'returned') && (
            <div className="space-y-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-600 border-b border-amber-500/20 pb-2">Security Refund</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="securityRefundDeduction">Deduction from Security (INR)</Label>
                  <Input
                    id="securityRefundDeduction"
                    type="number"
                    min={0}
                    max={aggSecurity}
                    value={form.securityRefundDeduction}
                    onChange={(e) => setForm(c => ({ ...c, securityRefundDeduction: Number(e.target.value) }))}
                    placeholder="e.g., for damages"
                  />
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <Label htmlFor="securityRefundNote">Refund Notes</Label>
                  <Textarea
                    id="securityRefundNote"
                    value={form.securityRefundNote}
                    onChange={(e) => setForm(c => ({ ...c, securityRefundNote: e.target.value }))}
                    placeholder="Reason for deduction..."
                    rows={2}
                  />
                </div>
              </div>
              <Button
                type="button"
                onClick={async () => {
                  const totalSecurity = aggSecurity;
                  const deduction = form.securityRefundDeduction || 0;
                  const finalRefund = totalSecurity - deduction;

                  const rentalBalance = aggFinalDue - (aggSecurity - deduction);
                  if (rentalBalance > 0) {
                    toast.error("Cannot refund security deposit.", {
                      description: `There is still a balance of ${formatCurrencyINR(rentalBalance)} due on the bill. Please clear the rental balance first.`,
                    });
                    return;
                  }

                  if (!window.confirm(`This will finalize the security refund.\n\nTotal Security: ${formatCurrencyINR(totalSecurity)}\nDeduction: ${formatCurrencyINR(deduction)}\nAmount to Refund: ${formatCurrencyINR(finalRefund)}\n\nThis action will mark security as returned for all items and add the deduction as a penalty. Continue?`)) {
                    return;
                  }

                  setLoading(true);
                  try {
                    const updates = relatedRentals.map((entry, index) => {
                      const patch: any = {
                        securityReturned: true,
                        securityReturnedAt: new Date().toISOString(),
                        // Treat the refunded amount as an advance to clear it from the balance
                        advance: (Number(itemEditors[entry.id]?.advance) || 0) + (Number(itemEditors[entry.id]?.securityAmount) || 0) - deduction,
                        // Add deduction to penalty
                        penalty: (Number(itemEditors[entry.id]?.penalty) || 0) + deduction,
                      };
                      if (index === 0) { // Add penalty and note to the first item
                        patch.penalty = (Number(itemEditors[entry.id]?.penalty) || 0) + deduction;
                        patch.securityRefundNote = form.securityRefundNote;
                      }
                      return updateRental(entry.id, patch);
                    });
                    await Promise.all(updates);
                    toast.success("Security deposit refund processed successfully.");
                    setOpen(false); // Close dialog on success
                  } catch (err) {
                    toast.error("Failed to process security refund.");
                  } finally {
                    setLoading(false);
                  }
                }}
              >Process Security Refund</Button>
            </div>
          )}

          {/* Actions & Status Section */}

          {/* Payment & Notes Section */}
          <div className="space-y-4 rounded-lg border border-border bg-secondary/10 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">Additional Payments & Notes</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="additionalPayment">Additional Payment</Label>
                <Input
                  id="additionalPayment"
                  type="number"
                  min={0}
                  value={form.additionalPayment || ""}
                  placeholder="Enter amount..."
                  onChange={(e) => setForm((c) => ({ ...c, additionalPayment: Number(e.target.value) || 0 }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="remark">Remark</Label>
                <Textarea
                  id="remark"
                  value={form.remark}
                  onChange={(e) => setForm((c) => ({ ...c, remark: e.target.value }))}
                  placeholder="Any special notes"
                  rows={3}
                />
              </div>
            </div>
            <div className="grid gap-4 mt-2">
              <div className="grid gap-2 sm:max-w-xs">
                <Label htmlFor="signature">Owner Signature</Label>
                <div className="grid gap-2 rounded-md border border-border bg-background p-3">
                  {form.signature ? (
                    <img
                      src={form.signature}
                      alt="Owner signature"
                      className="h-20 w-full object-contain border border-border rounded-sm"
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground mb-1">
                      Upload an image of the owner signature.
                    </p>
                  )}
                  <Input
                    id="signature"
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleSignatureUpload(e.target.files?.[0])}
                    className="text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Summary Footer */}
          <div className="space-y-4 rounded-lg border border-gold/20 bg-gold/5 p-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gold border-b border-gold/20 pb-2">Bill Summary</h3>
                <div className="mt-3 space-y-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total Rent:</span>
                    <span className="font-semibold">{formatCurrencyINR(aggSubtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Discount:</span>
                    <span className="font-semibold text-emerald-600">-{formatCurrencyINR(aggDiscount)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Security Deposit:</span>
                    <span className="font-semibold">{formatCurrencyINR(aggSecurity)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-border/50 pt-1 mt-1">
                    <span className="text-muted-foreground">Total Bill:</span>
                    <span className="font-semibold">{formatCurrencyINR(aggTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Amount Paid:</span>
                    <span className="font-semibold text-emerald-600">-{formatCurrencyINR(aggAdvance)}</span>
                  </div>
                  {form.additionalPayment > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Additional Payment:</span>
                      <span className="font-semibold text-emerald-600">-{formatCurrencyINR(form.additionalPayment)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between bg-red-500/10 px-2 py-1.5 rounded border border-red-500/20 mt-2">
                    <span className="text-red-600 font-semibold">Balance Due:</span>
                    <span className="font-bold text-red-600 text-lg">{formatCurrencyINR(aggFinalDue)}</span>
                  </div>
                  {aggSecurityRefundDue > 0 && (
                    <div className="flex items-center justify-between pt-1 border-t border-border/50 mt-2">
                      <span className="text-muted-foreground">Security Refund Due:</span>
                      <span className="font-semibold text-amber-600">{formatCurrencyINR(aggSecurityRefundDue)}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="sm:w-64 sm:text-right space-y-3">
                <p className="text-[11px] text-muted-foreground leading-tight">
                  {invoiceNote}
                </p>
                <div className="flex flex-wrap justify-end gap-1.5">
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs px-2" onClick={shareOnWhatsApp}>WA</Button>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs px-2" onClick={printInvoice}>Print</Button>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs px-2" onClick={downloadBill}>PDF</Button>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-md border border-border bg-secondary/40 px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                Computed total (Bill)
              </p>
              <div className="flex items-center gap-3 mt-0.5">
                <p className="font-display text-2xl text-gold">
                  {formatCurrencyINR(aggTotal)}
                </p>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-500/10 text-red-500 border border-red-500/20">
                  Balance: {formatCurrencyINR(aggFinalDue)}
                </span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-1 space-y-0.5">
                <p>{relatedRentals.length} piece(s)</p>
                <p>Security refund: {formatCurrencyINR(aggSecurityRefundDue)}</p>
                {form.securityReturned ? <p className="text-emerald-600">Security clear</p> : null}
              </div>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              Total Rent: {formatCurrencyINR(aggSubtotal)}
              <br />
              Total Bill: {formatCurrencyINR(aggTotal)}
            </div>
          </div>

          <div className="rounded-md border border-border bg-secondary/40 px-4 py-3 flex flex-col justify-between">
            <div className="space-y-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground leading-tight">
                  {invoiceNote}
                </p>
              </div>
              
              {/* Total Rental Balance Breakdown */}
              <div className="border-t border-border/50 pt-3 space-y-2">
                <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-semibold">
                  Total Rental Balance
                </p>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Total Rental:</span>
                    <span className="font-semibold text-gold">{formatCurrencyINR(aggSubtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Discount:</span>
                    <span className="font-semibold text-emerald-600">-{formatCurrencyINR(aggDiscount)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Security Deposit:</span>
                    <span className="font-semibold text-gold">{formatCurrencyINR(aggSecurity)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-border/50 pt-1">
                    <span className="text-muted-foreground">Total Bill:</span>
                    <span className="font-semibold text-gold">{formatCurrencyINR(aggTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Amount Paid:</span>
                    <span className="font-semibold text-emerald-600">-{formatCurrencyINR(aggAdvance)}</span>
                  </div>
                  {form.additionalPayment > 0 && (
                    <div className="flex items-center justify-between bg-red-500/10 px-2 py-1 rounded border border-red-500/20">
                      <span className="text-muted-foreground">Additional Payment:</span>
                      <span className="font-semibold text-emerald-600">-{formatCurrencyINR(form.additionalPayment)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between bg-red-500/10 px-2 py-1 rounded border border-red-500/20">
                    <span className="text-red-600 font-semibold">Balance Due:</span>
                    <span className="font-bold text-red-600">{formatCurrencyINR(aggFinalDue)}</span>
                  </div>
                  {aggSecurityRefundDue > 0 && (
                    <div className="flex items-center justify-between pt-1 border-t border-border/50">
                      <span className="text-muted-foreground">Security Refund Due:</span>
                      <span className="font-semibold text-amber-600">{formatCurrencyINR(aggSecurityRefundDue)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap justify-end gap-1.5 mt-3 pt-3 border-t border-border/50">
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs px-2" onClick={shareOnWhatsApp}>
                WA
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs px-2" onClick={printInvoice}>
                Print
              </Button>
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs px-2" onClick={downloadBill}>
                PDF
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-gold text-gold-foreground hover:bg-gold/90"
              disabled={loading || disabled}
            >
              {loading ? "Updating..." : "Update Rental"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
