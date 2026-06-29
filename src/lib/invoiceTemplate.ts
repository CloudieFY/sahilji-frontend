import { formatCurrencyINR } from "@/lib/utils";

export const DEFAULT_POLICIES = `1. Please return the rented piece on or before the due date to avoid penalty charges.\n2. Any damage, burns, or alterations to the piece will incur additional fees.\n3. Booking advance is strictly non-refundable.\n4. Original ID proof must be deposited at the time of pickup.\n\n1. कृपया पेनल्टी शुल्क से बचने के लिए किराए पर ली गई ड्रेस को नियत तारीख पर या उससे पहले वापस करें।\n2. ड्रेस में किसी भी प्रकार का नुकसान, जलने या बदलाव होने पर अतिरिक्त शुल्क लिया जाएगा।\n3. बुकिंग एडवांस वापस नहीं किया जाएगा।\n4. पिकअप के समय मूल आईडी प्रूफ जमा करना अनिवार्य है।`;

export function getPoliciesHtml() {
  const policies = typeof window !== "undefined" ? localStorage.getItem("rental_policies") ?? DEFAULT_POLICIES : DEFAULT_POLICIES;
  return policies.replace(/\n/g, "<br/>");
}

export function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const parts = dateStr.split("T")[0].split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export interface InvoiceFormState {
  billNo: string;
  address: string;
  status: string;
  discount: number;
  advance: number;
  securityAmount: number;
  securityReturned?: boolean;
  signature?: string;
  ownerNumber: string;
  instaId: string;
  billMakingDate: string;
  confirmationChecked: boolean;
  pieces: Array<{
    itemId: string;
    itemNo: string;
    deliveryDate: string;
    endDate: string;
    rate?: number;
    quantity?: number;
  }>;
}


export function getInvoiceContent({
  form,
  selectedCustomer,
  items,
  piecesTotal,
  balanceDue,
}: {
  form: InvoiceFormState;
  selectedCustomer?: { name?: string; email?: string; phone?: string; secondaryPhone?: string; };
  items: Array<{ id: string; name: string; image?: string; }>;
  piecesTotal: number;
  balanceDue: number;
}) {
  const totalCollected = (form.advance || 0) + (form.securityAmount || 0);
  const securityRefundDue = form.status === "returned" && form.securityReturned
    ? 0
    : form.securityAmount || 0;

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
        .invoice-half { height: 49vh; padding: 5mm 0; box-sizing: border-box; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #222; overflow: hidden; page-break-inside: avoid; position: relative; z-index: 1; }
        .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 60px; color: rgba(212, 175, 55, 0.1); z-index: -1; white-space: nowrap; pointer-events: none; font-weight: bold; }
        tr { page-break-inside: avoid; }
        @media print {
          @page { size: A4; margin: 0; }
          body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .invoice-half { padding: 10mm; height: 50vh; }
          .header { border-bottom: 2px solid #d4af37 !important; }
          th { border-bottom: 2px solid #222 !important; }
          .row.total { border-top: 2px solid #222 !important; color: #d4af37 !important; }
        }
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
            <text x="50" y="62" text-anchor="middle" font-family="Georgia, serif" font-size="38" fill="#d4af37" font-style="italic">SS</text>
          </svg>
          <div class="company-info">
            <h1 style="margin-bottom: 4px;">ARIHANT COLLECTION </h1>
            <p style="text-transform: none; margin-bottom: 2px;">Address: Maharana Pratap chowk near gas agency</p>
            <p style="text-transform: none; margin-bottom: 2px; color: #111;">Contact: <strong>9907050222, 7509942222</strong> | Insta: <strong>Sajansagar_</strong></p>
          </div>

          <div class="invoice-title">
            <h2>
              ${(() => {
                const status = (form?.status || "upcoming").toLowerCase();
                if (status === "upcoming") return "Booking Invoice";
                if (status === "active") return "Delivery Invoice";
                if (status === "returned") return "Final Invoice";
                if (status === "overdue") return "Overdue Final Bill";
                return "Invoice";
              })()}
            </h2>
            <p># ${form.billNo || "DRAFT"}</p>
            <p>Date: ${form.billMakingDate ? new Date(form.billMakingDate).toLocaleDateString('en-IN') : "-"}</p>

          </div>
        </div>
        
        <div class="grid">
          <div class="col">
            <div class="label">Billed To</div>
            <p class="value"><strong>${selectedCustomer?.name || "-"}</strong></p>
            <p class="value">${selectedCustomer?.email || ""}</p>
            <p class="value">${selectedCustomer?.phone || ""}${selectedCustomer?.secondaryPhone ? `, ${selectedCustomer.secondaryPhone}` : ""}</p>
            <p class="value">${form.address || ""}</p>
            ${form.instaId ? `<p class="value"><strong>Insta ID:</strong> ${form.instaId}</p>` : ""}
          </div>
          <div class="col" style="text-align: right;">
            <div class="label">Rental Details</div>
            <p class="value"><strong>Status:</strong> ${String(form?.status || "upcoming").toUpperCase()}</p>
          </div>
        </div>


        <table>
          <thead>
            <tr>
              <th style="width: 20px; text-align: center;">&#10003;</th>
              <th style="width: 60px;">Image</th>
              <th>Item Description & Dates</th>
              <th>Item No</th>
              <th class="text-right">Rate</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${form.pieces.map(p => {
              const item = items.find(i => i.id === p.itemId);
              const quantity = Math.max(1, Number(p.quantity) || 1);
              const lineTot = (p.rate || 0) * quantity;
              return `<tr>
                <td style="vertical-align: middle;"><div style="width: 12px; height: 12px; border: 1px solid #666; border-radius: 2px; margin: 0 auto;"></div></td>
                <td>${item?.image ? `<img src="${item.image}" style="width: 35px; height: 45px; object-fit: cover; border-radius: 3px;" />` : ""}</td>
                <td><strong>${item?.name || "-"}</strong><br/><span style="font-size: 9px; color: #666;">Qty: ${quantity} | Del: ${formatDate(p.deliveryDate)} | Return: ${formatDate(p.endDate)}</span></td>
                <td>${p.itemNo || "-"}</td>
                <td class="text-right">${formatCurrencyINR(p.rate ?? 0)}</td>
                <td class="text-right">${formatCurrencyINR(lineTot)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>

        <div class="summary-box">
          <div class="row"><span>Subtotal</span><span>${formatCurrencyINR(piecesTotal)}</span></div>
          <div class="row"><span>Discount</span><span>${formatCurrencyINR(form.discount)}</span></div>
          <div class="row"><span>Rental Paid</span><span>${formatCurrencyINR(form.advance)}</span></div>
          <div class="row"><span>Security Deposit Received</span><span>${formatCurrencyINR(form.securityAmount)}</span></div>
          <div class="row"><span>Total Amount Collected</span><span>${formatCurrencyINR(totalCollected)}</span></div>
          <div class="row"><span>Security Refund Due</span><span>${formatCurrencyINR(securityRefundDue)}</span></div>
          <div class="row total"><span>Rental Balance Due</span><span>${formatCurrencyINR(balanceDue)}</span></div>
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
