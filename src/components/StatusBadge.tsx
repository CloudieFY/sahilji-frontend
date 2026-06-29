import type { ItemStatus, RentalStatus } from "@/data/mock";

const itemStyles: Record<ItemStatus, string> = {
  available: "bg-emerald/15 text-emerald border-emerald/30",
  rented: "bg-gold/15 text-gold border-gold/30",
  cleaning: "bg-muted text-muted-foreground border-border",
  reserved: "bg-accent text-accent-foreground border-burgundy/40",
};

const rentalStyles: Record<RentalStatus, string> = {
  active: "bg-gold/15 text-gold border-gold/30",
  upcoming: "bg-emerald/15 text-emerald border-emerald/30",
  returned: "bg-muted text-muted-foreground border-border",
  overdue: "bg-destructive/15 text-destructive border-destructive/40",
};

export function StatusBadge({
  status,
  kind = "item",
}: {
  status: string;
  kind?: "item" | "rental";
}) {
  const cls =
    kind === "item"
      ? itemStyles[status as ItemStatus]
      : rentalStyles[status as RentalStatus];
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-[0.18em] border ${cls}`}
    >
      {status}
    </span>
  );
}
