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
