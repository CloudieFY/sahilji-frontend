import { useMemo, useState, type ReactNode } from "react";
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
import { useStore } from "@/data/store";
import { formatCurrencyINR } from "@/lib/utils";
import type { RentalStatus } from "@/data/mock";

import { AddCustomerDialog } from "./AddCustomerDialog";
import { AddPieceDialog } from "./AddPieceDialog";
import { Plus, Trash2, Calendar } from "lucide-react";
import { getInvoiceContent, formatDate, printInvoiceHtml } from "@/lib/invoiceTemplate";

const schema = z
  .object({
    billNo: z.string().trim().max(40).optional().or(z.literal("")),

    address: z.string().trim().min(1, "Address required").max(200),
    customerId: z.string().min(1, "Select a client"),
    payments: z.array(z.object({ amount: z.number(), date: z.string() })).optional(),
    discount: z.number().min(0, "Discount cannot be negative"),
    securityAmount: z.number().min(0, "Security amount cannot be negative"),
    signature: z.string().optional(),
    status: z.enum(["active", "upcoming", "returned", "overdue"]),
    pieces: z.array(
      z.object({
        id: z.string(),
        itemId: z.string().min(1, "Select a piece"),
        itemNo: z.string().trim().min(1, "Item number required").max(40),
        deliveryDate: z.string().min(1, "Delivery date required"),
        deliveryTime: z.string().min(1, "Delivery time required"),
        deliveryTimePeriod: z.enum(["Morning", "Afternoon", "Evening", "Night", ""]).optional().or(z.literal("")),
        startDate: z.string().min(1, "Start date required"),
        endDate: z.string().min(1, "End date required"),
        endTime: z.string().min(1, "Return time required"),
        endTimePeriod: z.enum(["Morning", "Afternoon", "Evening", "Night", ""]).optional().or(z.literal("")),
        quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
        rate: z.number().min(0, "Rate cannot be negative"),
        remark: z.string().trim().max(300).optional(),
      })
    ).min(1, "Add at least one piece"),
  })

type FormState = z.infer<typeof schema>;

function daysBetween(start: string, end: string) {
  if (!start || !end) return 0;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 0;
  return Math.max(1, Math.round((e - s) / 86400000));
}

const today = () => new Date().toISOString().slice(0, 10);

function isSafaItem(item: any) {
  const text = [item?.name, item?.category, item?.subcategory].filter(Boolean).join(" ").toLowerCase();
  return text.includes("safa");
}

function getTimePeriod(
  timeStr: string,
): "" | "Morning" | "Afternoon" | "Evening" | "Night" {
  if (!timeStr) return "";
  const hour = parseInt(timeStr.split(":")[0], 10);
  if (isNaN(hour)) return "";
  if (hour >= 6 && hour < 12) return "Morning";
  if (hour >= 12 && hour < 17) return "Afternoon";
  if (hour >= 17 && hour < 21) return "Evening";
  return "Night";
}

export function NewRentalDialog({
  trigger,
  open,
  onOpenChange,
}: {
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { items, customers, rentals, addRental } = useStore();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setOpen = isControlled ? onOpenChange! : setInternalOpen;
  
  const [form, setForm] = useState<FormState>({
    billNo: "",

    address: "",
    customerId: "",
    payments: [], // This will be sent as an empty array now
    discount: 0,
    securityAmount: 0,
    signature: "",
    status: "upcoming" as RentalStatus,
    pieces: [
      {
        id: Math.random().toString(),
        itemId: "",
        itemNo: "",
        deliveryDate: today(),
        deliveryTime: "10:00",
        deliveryTimePeriod: "Morning",
        startDate: today(),
        endDate: today(),
        endTime: "10:00",
        endTimePeriod: "Morning",
        quantity: 1,
        rate: 0,
        remark: "",
      }
    ]
  });

  const [addPieceOpen, setAddPieceOpen] = useState(false);
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === form.customerId),
    [customers, form.customerId],
  );
  const piecesTotal = form.pieces.reduce((acc, p) => {
    const item = items.find((i) => i.id === p.itemId);
    const quantity = isSafaItem(item) ? Math.max(1, Number((p as any).quantity) || 1) : 1;
    return acc + (p.rate || 0) * quantity;
  }, 0);
  const totalPaid = (form.payments || []).reduce((acc, p) => acc + p.amount, 0);
  const netTotal = piecesTotal - (form.discount || 0) + (form.securityAmount || 0);
  const balanceDue = Math.max(0, netTotal - totalPaid);

  const [loading, setLoading] = useState(false);
  const [billNoLoading, setBillNoLoading] = useState(false);


  function handleSignatureUpload(file: File | undefined) {
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
        setForm((current) => ({ ...current, signature: reader.result as string }));
      }
    };
    reader.onerror = () => {
      toast.error("Could not read signature file");
    };
    reader.readAsDataURL(file);
  }

  async function shareOnWhatsApp() {
    toast.info("Generating PDF for WhatsApp...");
    try {
      // @ts-ignore
      const html2pdf = (await import("html2pdf.js")).default;

      const htmlString = `
        <div id="pdf-container" style="background-color: #ffffff; color: #000000; padding: 0; margin: 0; width: 100%;">
          <style>
            #pdf-container, #pdf-container * {
              border-color: #e5e7eb !important;
              outline-color: #e5e7eb !important;
            }
          </style>
          ${getInvoiceContent({
            form: { ...form } as any, 
            selectedCustomer,
            items,
            piecesTotal,
            balanceDue
          })}
        </div>
      `;

      const filename = `Invoice-${form.billNo || "DRAFT"}.pdf`;
      const opt = {
        margin: 2,
        filename,
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          ignoreElements: (element: Element) => {
            if (element.tagName === "STYLE" || element.tagName === "LINK") {
              const href = (element as HTMLLinkElement).href || "";
              if (href.includes("fonts.googleapis") || href.includes("fonts.gstatic")) return false;
              if (element.closest && element.closest("#pdf-container")) return false;
              return true;
            }
            return false;
          }
        },
        jsPDF: { unit: "mm" as const, format: "a4", orientation: "portrait" as const },
      };

      const pdfBlob = await html2pdf().set(opt).from(htmlString).outputPdf("blob");

      const file = new File([pdfBlob], filename, { type: "application/pdf" });

      // Check if native mobile sharing API supports sharing PDF files directly
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: filename,
          text: "Here is your rental final invoice from ARIHANT COLLECTION .",
        });
        toast.success("Shared successfully!");
      } else {
        // Desktop fallback: Download the PDF, then open WhatsApp Web
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        toast.success("PDF downloaded! Please attach it in WhatsApp.");
        window.open(
          `https://wa.me/?text=${encodeURIComponent(
            "Here is your rental final invoice from ARIHANT COLLECTION . Please find the attached PDF."
          )}`,
          "_blank"
        );
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF. Is html2pdf.js installed?");
    }
  }

  function printInvoice() {
    if (typeof window === "undefined") return;

    const invoiceHtml = `
      <html>
        <head>
          <title>Invoice ${form.billNo || ""}</title>
          <style>
                    @page { size: A4; margin: 10mm 15mm; }
                    body { margin: 0; padding: 0; background: #fff; }
          </style>
        </head>
        <body>
          ${getInvoiceContent({
            form: { ...form } as any,
            selectedCustomer,
            items,
            piecesTotal,
            balanceDue
          })}
        </body>
      </html>
    `;

    if (!printInvoiceHtml(invoiceHtml)) {
      toast.error("Unable to open print window.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Bill number is now generated on the backend if left empty.
    const parsed = schema.safeParse(form);

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    if (parsed.data.pieces.some((p) => new Date(p.endDate) < new Date(p.deliveryDate))) {
      toast.error("End date must be after delivery date for all pieces");
      return;
    }

    const itemIds = new Set();
    for (const piece of parsed.data.pieces) {
      if (itemIds.has(piece.itemId)) {
        toast.error(`Duplicate item found: ${items.find(i => i.id === piece.itemId)?.name}. Each piece must be unique.`);
        return;
      }
      itemIds.add(piece.itemId);
    }

    const piecesData = parsed.data.pieces.map((p) => {
      const item = items.find((i) => i.id === p.itemId);
      const quantity = isSafaItem(item) ? p.quantity : 1;
      const lineTotal = p.rate * quantity;
      return { ...p, item, lineTotal };
    });

    if (piecesData.some((p) => !p.item)) {
      toast.error("Select a valid piece for all entries");
      return;
    }

    const confirmedPayment = window.confirm(
      `Confirm amount submitted by customer:\n\nTotal Rent: ${formatCurrencyINR(piecesTotal)}\nDiscount: ${formatCurrencyINR(parsed.data.discount)}\nSecurity deposit: ${formatCurrencyINR(parsed.data.securityAmount)}\nTotal bill: ${formatCurrencyINR(netTotal)}\nAmount paid: ${formatCurrencyINR(totalPaid)}\nBalance: ${formatCurrencyINR(balanceDue)}`,
    );
    if (!confirmedPayment) return;

    for (const p of parsed.data.pieces) {
      const newStart = new Date(p.deliveryDate);
      newStart.setHours(0, 0, 0, 0);
      const newEnd = new Date(p.endDate);
      newEnd.setHours(0, 0, 0, 0);

      const overlappingRentals = rentals.filter((r) => {
        if (r.itemId !== p.itemId) return false;
        if (r.status === "returned") return false;

        const existingStart = new Date(r.startDate || r.deliveryDate || "");
        existingStart.setHours(0, 0, 0, 0);
        const existingEnd = new Date(r.endDate || "");
        existingEnd.setHours(0, 0, 0, 0);

        return newStart.getTime() <= existingEnd.getTime() && newEnd.getTime() >= existingStart.getTime();
      });

      const item = items.find((i) => i.id === p.itemId);
      if (isSafaItem(item)) {
        const bookedQty = overlappingRentals.reduce((sum, r) => sum + (Number((r as any).quantity) || 1), 0);
        const stockQty = Number((item as any)?.quantity) || 1;
        if (bookedQty + p.quantity > stockQty) {
          toast.error(`Only ${Math.max(0, stockQty - bookedQty)} Safa available for selected dates.`);
          return;
        }
      } else if (overlappingRentals.length > 0) {
        const overlappingRental = overlappingRentals[0];
        toast.error(`"${item?.name || p.itemId}" is already booked from ${formatDate(overlappingRental.startDate)} to ${formatDate(overlappingRental.endDate)}.`);
        return;
      }
    }

    setLoading(true);
    try {
      // One API call per bill: backend expects { pieces: [...] }
      // We still prorate advance/discount/security across pieces via piece-level fields (backend distributes discount,
      // and we pass advance/security per piece proportionally).

      const ratioBase = piecesTotal > 0 ? piecesTotal : piecesData.reduce((s, p) => s + (p.lineTotal || 0), 0) || piecesData.length;
      const payload: any = {
        customerId: parsed.data.customerId,
        billNo: parsed.data.billNo,
        address: parsed.data.address,
        payments: parsed.data.payments,
        // 'advance' is deprecated in favor of the payments array, but we can send it for compatibility.
        advance: totalPaid,
        discount: parsed.data.discount,
        securityAmount: parsed.data.securityAmount,
        signature: parsed.data.signature || "",
        status: parsed.data.status,
        pieces: piecesData.map((p) => {
          const ratio = ratioBase > 0 ? (p.lineTotal || 0) / ratioBase : 1 / piecesData.length;
          return {
            itemId: p.itemId,
            itemNo: p.itemNo,
            deliveryDate: p.deliveryDate,
            deliveryTimePeriod: p.deliveryTimePeriod,
            penalty: 0,
            endDate: p.endDate,
            endTimePeriod: p.endTimePeriod,
            rate: p.rate,
            quantity: p.quantity,
            remark: p.remark || "",
            deliveryTime: p.deliveryTime,
            endTime: p.endTime,
          };
        }),
      };

      await addRental(payload);

      toast.success(`Rental bill created for ${piecesData.length} piece(s)`);

      setForm({
        billNo: "",
        address: "",
        customerId: "",
        payments: [],
        discount: 0,
        securityAmount: 0,
        signature: "",
        status: "upcoming",
        pieces: [
          {
            id: Math.random().toString(),
            itemId: "",
            itemNo: "",
            deliveryDate: today(),
            deliveryTime: "10:00",
            deliveryTimePeriod: "Morning",
            startDate: today(),
            endDate: today(),
            endTime: "10:00",
            endTimePeriod: "Morning",
            quantity: 1,
            rate: 0,
            remark: "",
          }
        ]
      });
      setOpen(false);
    } catch (error) {
      toast.error("Failed to create rental");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setOpen}>
        {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              New Rental
            </DialogTitle>
            <DialogDescription>
              Reserve a piece for a client.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6 mt-2">
            {/* General Info Section */}
            <div className="space-y-4 rounded-lg border border-border bg-secondary/10 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">General Info</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="billNo">Bill No</Label>
                  <Input
                    id="billNo"
                    value={form.billNo}
                    onChange={(e) => setForm((c) => ({ ...c, billNo: e.target.value }))}
                    placeholder={billNoLoading ? "Generating..." : "Auto-generated on submit"}
                    maxLength={40}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="rstatus">Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v: RentalStatus) => {
                      if (v === "returned") {
                        const confirmed = window.confirm("Are all dues clear? Please confirm that all balances are settled before marking as returned.");
                        if (!confirmed) return;
                      }
                      if (v === "active" && form.status !== "active") {
                        const confirmed = window.confirm("Is all amount paid?");
                        if (confirmed && netTotal > 0) {
                          setForm({ ...form, status: v, payments: [{
                            amount: netTotal,
                            date: today()
                          }] });
                          toast.success("Balance cleared for delivery");
                          return;
                        }
                      }
                      setForm({ ...form, status: v });
                    }}
                  >
                    <SelectTrigger id="rstatus">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["upcoming", "active", "returned", "overdue"] as const).map(
                        (s) => (
                          <SelectItem key={s} value={s}>
                            {s[0].toUpperCase() + s.slice(1)}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="client">Client</Label>
                    <button
                      type="button"
                      onClick={() => setAddClientOpen(true)}
                      className="text-[11px] text-gold hover:underline inline-flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" /> Add client
                    </button>
                  </div>
                  <Select
                    value={form.customerId}
                    onValueChange={(v) => setForm({ ...form, customerId: v })}
                  >
                    <SelectTrigger id="client" className="[&>span]:truncate">
                      <SelectValue placeholder="Choose a client..." />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} - {c.tier}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="address">Customer Address</Label>
                  <Input
                    id="address"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="Customer street, city, landmark"
                    maxLength={200}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Rental Pieces Section */}
            <div className="space-y-4 rounded-lg border border-border bg-secondary/10 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">Rental Pieces</h3>
              {form.pieces.map((piece, index) => (
                <div key={piece.id} className="relative rounded-md border border-border p-4 bg-background shadow-sm">
                  {form.pieces.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        setForm(f => ({ ...f, pieces: f.pieces.filter(p => p.id !== piece.id) }));
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 mb-3">
                    <div className="grid gap-2 min-w-0 sm:col-span-5">
                      <div className="flex items-center justify-between">
                        <Label>Piece {index + 1}</Label>
                        {index === 0 && (
                          <button
                            type="button"
                            onClick={() => setAddPieceOpen(true)}
                            className="text-[11px] text-gold hover:underline inline-flex items-center gap-1"
                          >
                            <Plus className="h-3 w-3" /> Add piece
                          </button>
                        )}
                      </div>
                      <Select
                        value={piece.itemId}
                        onValueChange={(v) => {
                          if (form.pieces.some(p => p.itemId === v && p.id !== piece.id)) {
                            toast.error("This item is already added to the bill.");
                            return;
                          }
                          const item = items.find((i) => i.id === v);
                          setForm(f => {
                            const newPieces = [...f.pieces];
                            newPieces[index] = { ...newPieces[index], itemId: v, itemNo: item?.id ?? "", rate: item?.pricePerDay ?? 0, quantity: isSafaItem(item) ? Math.max(1, newPieces[index].quantity || 1) : 1 };
                            return { ...f, pieces: newPieces };
                          });
                        }}
                      >
                        <SelectTrigger className="[&>span]:truncate">
                          <SelectValue placeholder="Choose a piece..." />
                        </SelectTrigger>
                        <SelectContent>
                          {items.map((i) => (
                            <SelectItem key={i.id} value={i.id}>
                              {i.name} - {formatCurrencyINR(i.pricePerDay)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2 min-w-0 sm:col-span-4">
                      <Label>Item No</Label>
                      <Input
                        value={piece.itemNo}
                        onChange={e => {
                          const itemNo = e.target.value;
                          setForm(f => {
                            const newPieces = [...f.pieces];
                            newPieces[index] = { ...newPieces[index], itemNo };
                            // Try to auto-fill if item exists
                            const found = items.find(i => i.customId === itemNo);
                            if (found) {
                              newPieces[index] = {
                                ...newPieces[index],
                                itemId: found.id,
                                rate: found.pricePerDay ?? 0,
                                quantity: isSafaItem(found) ? Math.max(1, newPieces[index].quantity || 1) : 1,
                              };
                            }
                            return { ...f, pieces: newPieces };
                          });
                        }}
                        placeholder="Enter Item No"
                      />
                    </div>
                    <div className="grid gap-2 min-w-0 sm:col-span-3">
                      <Label>Rate (INR)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={piece.rate}
                        onChange={(e) => setForm(f => {
                          const newPieces = [...f.pieces];
                          newPieces[index] = { ...newPieces[index], rate: Number(e.target.value) };
                          return { ...f, pieces: newPieces };
                        })}
                        required
                      />
                    </div>
                    {isSafaItem(items.find((i) => i.id === piece.itemId)) && (
                      <div className="grid gap-2 min-w-0 sm:col-span-3">
                        <Label>Safa Quantity</Label>
                        <Input
                          type="number"
                          min={1}
                          max={(items.find((i) => i.id === piece.itemId) as any)?.quantity || undefined}
                          value={piece.quantity}
                          onChange={(e) => setForm(f => {
                            const newPieces = [...f.pieces];
                            newPieces[index] = { ...newPieces[index], quantity: Math.max(1, Number(e.target.value) || 1) };
                            return { ...f, pieces: newPieces };
                          })}
                          required
                        />
                        <p className="text-[10px] text-muted-foreground">
                          Stock: {(items.find((i) => i.id === piece.itemId) as any)?.quantity ?? 1}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                     <div className="grid gap-2 p-3 border border-border rounded-md bg-secondary/20">
                        <Label className="font-semibold text-gold">Delivery</Label>
                        <div className="grid gap-2">
                          <Label className="text-xs text-muted-foreground">Date</Label>
                          <div className="relative">
                            <Input value={formatDate(piece.deliveryDate)} readOnly className="pr-8" />
                            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                            <Input
                              type="date"
                              value={piece.deliveryDate}
                              onChange={(e) => setForm(f => {
                                const newPieces = [...f.pieces];
newPieces[index] = { ...newPieces[index], deliveryDate: e.target.value };
                                return { ...f, pieces: newPieces };
                              })}
                              onClick={(e) => {
                                try {
                                  (e.target as HTMLInputElement).showPicker?.();
                                } catch (err) {}
                              }}
                              className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                              required
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="grid gap-2">
                            <Label className="text-xs text-muted-foreground">Time</Label>
                            <Input
                              type="time"
                              value={piece.deliveryTime || ""}
                              onChange={(e) => setForm(f => {
                                const time = e.target.value;
const newPieces = [...f.pieces];
                                newPieces[index] = {
                                  ...newPieces[index],
                                  deliveryTime: time,
                                  deliveryTimePeriod: getTimePeriod(time) as FormState['pieces'][0]['deliveryTimePeriod'],
                                };
                                return { ...f, pieces: newPieces };
                              })}
                              required
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label className="text-xs text-muted-foreground">Period</Label>
                            <Select
                              value={piece.deliveryTimePeriod}
                              onValueChange={(value) => {
                                const v = value as FormState['pieces'][0]['deliveryTimePeriod'];
                                setForm((f) => {
                                  const newPieces = [...f.pieces];
                                  newPieces[index] = { ...newPieces[index], deliveryTimePeriod: v };
                                  return { ...f, pieces: newPieces };
                                });
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Period" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Morning">Morning</SelectItem>
                                <SelectItem value="Afternoon">Afternoon</SelectItem>
                                <SelectItem value="Evening">Evening</SelectItem>
                                <SelectItem value="Night">Night</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                     </div>
                     
                     <div className="grid gap-2 p-3 border border-border rounded-md bg-secondary/20">
                        <Label className="font-semibold text-gold">Return</Label>
                        <div className="grid gap-2">
                          <Label className="text-xs text-muted-foreground">Date</Label>
                          <div className="relative">
                            <Input value={formatDate(piece.endDate)} readOnly className="pr-8" />
                            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                            <Input
                              type="date"
                              value={piece.endDate}
                              onChange={(e) => setForm(f => {
                                const newPieces = [...f.pieces];
                                newPieces[index] = { ...newPieces[index], endDate: e.target.value };
                                return { ...f, pieces: newPieces };
                              })}
                              onClick={(e) => {
                                try {
                                  (e.target as HTMLInputElement).showPicker?.();
                                } catch (err) {}
                              }}
                              className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                              required
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="grid gap-2">
                            <Label className="text-xs text-muted-foreground">Time</Label>
                            <Input
                              type="time"
                              value={piece.endTime || ""}
                              onChange={(e) => setForm(f => {
                                const time = e.target.value;
const newPieces = [...f.pieces];
                                newPieces[index] = {
                                  ...newPieces[index],
                                  endTime: time,
                                  endTimePeriod: getTimePeriod(time) as FormState['pieces'][0]['endTimePeriod'],
                                };
                                return { ...f, pieces: newPieces };
                              })}
                              required
                            />
                          </div>
                          <div className="grid gap-2">
                            <Label className="text-xs text-muted-foreground">Period</Label>
                            <Select
                              value={piece.endTimePeriod}
                              onValueChange={(value) => {
                                const v = value as FormState['pieces'][0]['endTimePeriod'];
                                setForm((f) => {
                                  const newPieces = [...f.pieces];
                                  newPieces[index] = { ...newPieces[index], endTimePeriod: v };
                                  return { ...f, pieces: newPieces };
                                });
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Period" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Morning">Morning</SelectItem>
                                <SelectItem value="Afternoon">Afternoon</SelectItem>
                                <SelectItem value="Evening">Evening</SelectItem>
                                <SelectItem value="Night">Night</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                     </div>
                  </div>
                  
                  <div className="grid gap-2 mt-3">
                    <Label>Remark</Label>
                    <Textarea
                      value={piece.remark}
                      onChange={(e) => setForm(f => {
                        const newPieces = [...f.pieces];
                        newPieces[index] = { ...newPieces[index], remark: e.target.value };
                        return { ...f, pieces: newPieces };
                      })}
                      placeholder="Any special notes for this piece"
                      rows={2}
                    />
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                className="w-full border-dashed"
                onClick={() => {
                  setForm(f => ({
                    ...f,
                    pieces: [
                      ...f.pieces,
                      {
                        id: Math.random().toString(),
                        itemId: "",
                        itemNo: "",
                        deliveryDate: f.pieces[f.pieces.length - 1].deliveryDate,
                        deliveryTime: f.pieces[f.pieces.length - 1].deliveryTime,
                        deliveryTimePeriod: f.pieces[f.pieces.length - 1].deliveryTimePeriod,
                        startDate: f.pieces[f.pieces.length - 1].startDate,
                        endDate: f.pieces[f.pieces.length - 1].endDate,
                        endTime: f.pieces[f.pieces.length - 1].endTime,
                        endTimePeriod: f.pieces[f.pieces.length - 1].endTimePeriod,
                        quantity: 1,
                        rate: 0,
                        remark: "",
                      }
                    ]
                  }));
                }}
              >
                <Plus className="h-4 w-4 mr-2" /> Add Another Piece
              </Button>
            </div>

            {/* Payment & Signature Section */}
            <div className="space-y-4 rounded-lg border border-border bg-secondary/10 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">Payment & Signature</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="amountPaid">Amount Paid</Label>
                  <Input
                    id="amountPaid"
                    type="number"
                    min={0}
                    value={(form.payments && form.payments[0]?.amount) || ""}
                    onChange={(e) => {
                      const amount = Number(e.target.value);
                      setForm({ ...form, payments: amount > 0 ? [{ amount, date: today() }] : [] });
                    }}
                    placeholder="0"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="securityAmount">Security Deposit</Label>
                  <Input
                    id="securityAmount"
                    type="number"
                    min={0}
                    value={form.securityAmount}
                    onChange={(e) => setForm({ ...form, securityAmount: Number(e.target.value) })}
                    placeholder="0"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="discount">Discount</Label>
                  <Input
                    id="discount"
                    type="number"
                    min={0}
                    value={form.discount}
                    onChange={(e) => setForm({ ...form, discount: Number(e.target.value) })}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid gap-2 pt-2">
                <Label htmlFor="signature">Owner Signature</Label>
                <div className="grid gap-2 rounded-md border border-border bg-background p-3">
                  {form.signature ? (
                    <img
                      src={form.signature}
                      alt="Owner signature"
                      className="h-24 w-full object-contain border border-border rounded-sm"
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Upload an image of the owner signature.
                    </p>
                  )}
                  <Input
                    id="signature"
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleSignatureUpload(e.target.files?.[0])}
                  />
                </div>
              </div>
            </div>

            <div className="grid gap-3">
              <button
                type="button"
                onClick={() => setShowInvoice((current) => !current)}
                className="rounded-full border border-border px-3 py-2 text-sm uppercase tracking-[0.18em] text-muted-foreground hover:bg-secondary/40"
              >
                {showInvoice ? "Hide Invoice" : "Preview Invoice"}
              </button>
              {showInvoice ? (
                <div className="rounded-md border border-border bg-secondary/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                        Rental Invoice
                      </p>
                      <p className="text-sm text-foreground">Bill No: {form.billNo || "—"}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" onClick={shareOnWhatsApp}>
                        WhatsApp
                      </Button>
                      <Button type="button" variant="outline" onClick={printInvoice}>
                        Print
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-1 text-sm text-muted-foreground">
                    <p>Client: {selectedCustomer?.name || "Not selected"}</p>
                    <div className="mt-2 border-t border-border pt-2 space-y-2">
                      {form.pieces.map((p, idx) => {
                        const item = items.find(i => i.id === p.itemId);
                        return (
                          <div key={p.id}>
                            <p><strong>Piece {idx + 1}:</strong> {item?.name || "Not selected"} (No: {p.itemNo || "—"})</p>
                            {isSafaItem(item) ? <p>Quantity: {p.quantity} x {formatCurrencyINR(p.rate)} = {formatCurrencyINR((p.quantity || 1) * p.rate)}</p> : null}
                            <p>Del: {formatDate(p.deliveryDate)}{p.deliveryTime ? ` ${p.deliveryTime}` : ""}{p.deliveryTimePeriod ? ` (${p.deliveryTimePeriod})` : ""} | Return: {formatDate(p.endDate)}{p.endTime ? ` ${p.endTime}` : ""}{p.endTimePeriod ? ` (${p.endTimePeriod})` : ""}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="grid gap-1 text-sm">
                    <div className="flex justify-between text-muted-foreground"><span>Total Rent</span><span>{formatCurrencyINR(piecesTotal)}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>Security Deposit</span><span>{formatCurrencyINR(form.securityAmount)}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>Discount</span><span>-{formatCurrencyINR(form.discount)}</span></div>
                    <div className="flex justify-between font-medium text-foreground"><span>Total Bill</span><span>{formatCurrencyINR(netTotal)}</span></div>
                    <div className="flex justify-between text-emerald-600"><span>Amount Paid</span><span>-{formatCurrencyINR(totalPaid)}</span></div>
                    <div className="flex justify-between text-gold font-semibold"><span>Balance</span><span>{formatCurrencyINR(balanceDue)}</span></div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-md border border-border bg-secondary/40 px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                  Computed Total ({form.pieces.length} piece{form.pieces.length === 1 ? "" : "s"})
                </p>
                <div className="flex items-center gap-3 mt-0.5">
                  <p className="font-display text-2xl text-gold">
                    {formatCurrencyINR(netTotal)}
                  </p>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-500/10 text-red-500 border border-red-500/20">
                    Balance: {formatCurrencyINR(balanceDue)}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-1 space-y-0.5">
                  <p>Total Rent: {formatCurrencyINR(piecesTotal)}</p>
                  {form.securityAmount > 0 ? <p>Security Deposit: {formatCurrencyINR(form.securityAmount)}</p> : null}
                  {form.discount > 0 ? <p>Discount: -{formatCurrencyINR(form.discount)}</p> : null}
                  {totalPaid > 0 ? <p>Amount Paid: -{formatCurrencyINR(totalPaid)}</p> : null}
                </div>
              </div>
              <div className="flex gap-2">
                {form.pieces.map(p => {
                   const item = items.find(i => i.id === p.itemId);
                   if (!item) return null;
                   return (
                     <img
                        key={p.id}
                        src={item.image}
                        alt={item.name}
                        className="h-14 w-11 object-cover rounded-sm border border-border shrink-0"
                      />
                   );
                })}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-gold text-gold-foreground hover:bg-gold/90"
                disabled={loading}
              >
                {loading ? "Creating..." : "Create Rental Bill"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AddPieceDialog open={addPieceOpen} onOpenChange={setAddPieceOpen} />
      <AddCustomerDialog
        open={addClientOpen}
        onOpenChange={setAddClientOpen}
        onCreated={(id) => setForm((f) => ({ ...f, customerId: id }))}
      />
    </>
  );
}
