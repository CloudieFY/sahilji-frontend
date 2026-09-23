import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const FREE_SIZE = "Free Size";

export const SIZE_OPTIONS = [
  "34",
  "36",
  "38",
  "40",
  "42",
  "44",
  "46",
  "48",
  FREE_SIZE,
] as const;

export const DEFAULT_SIZE = FREE_SIZE;

export function formatCurrencyINR(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * A multi-item bill stores bill-level money (payments, advance, security, discount)
 * on a single representative piece. Every place that reads or writes that money
 * must agree on the same piece, or payments recorded against one piece become
 * invisible to code reading a different one. This mirrors the backend's
 * `billRep` selection in rentalController.updateRental (securityAmount > 0, else
 * earliest created) so frontend and backend never disagree about who holds it.
 */
export function getBillRepresentative<T extends { securityAmount?: number; discount?: number; payments?: unknown[]; createdAt?: string; _id?: string }>(
  relatedRentals: T[],
): T | undefined {
  if (relatedRentals.length === 0) return undefined;
  const withSecurity = relatedRentals.filter((r) => Number(r.securityAmount) > 0);
  const candidates = withSecurity.length > 0 ? withSecurity : relatedRentals;
  return [...candidates].sort((a, b) => {
    const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (at !== bt) return at - bt;
    // Tie-break on _id (Mongo ObjectIds are monotonic and always unique) so this
    // never disagrees with the backend's own representative selection.
    return String(a._id ?? "").localeCompare(String(b._id ?? ""));
  })[0];
}
