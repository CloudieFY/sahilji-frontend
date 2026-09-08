import { useEffect, useState, type ReactNode } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/data/store";
import type { Customer } from "@/lib/api";

const schema = z.object({
  name: z.string().trim().min(1, "Name required").max(100),
  email: z
    .string()
    .trim()
    .max(255)
    .optional()
    .refine((value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
      message: "Invalid email",
    }),
  phone: z.string().trim().min(4, "Customer number required").max(40),
  secondaryPhone: z.string().trim().max(40).optional(),
  tier: z.enum(["Standard", "Gold", "Platinum"]),
});

export function EditCustomerDialog({
  customer,
  trigger,
  open,
  onOpenChange,
  onUpdated,
}: {
  customer: Customer;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onUpdated?: (c: Customer) => void;
}) {
  const { updateCustomer } = useStore();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setOpen = isControlled ? onOpenChange! : setInternalOpen;

  const [form, setForm] = useState({
    name: customer.name ?? "",
    email: customer.email ?? "",
    phone: customer.phone ?? "",
    secondaryPhone: customer.secondaryPhone ?? "",
    tier: (customer.tier ?? "Standard") as "Standard" | "Gold" | "Platinum",
  });
  const [loading, setLoading] = useState(false);

  // Re-sync the form whenever the dialog opens or the source customer changes.
  useEffect(() => {
    if (isOpen) {
      setForm({
        name: customer.name ?? "",
        email: customer.email ?? "",
        phone: customer.phone ?? "",
        secondaryPhone: customer.secondaryPhone ?? "",
        tier: (customer.tier ?? "Standard") as "Standard" | "Gold" | "Platinum",
      });
    }
  }, [isOpen, customer]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        name: parsed.data.name,
        phone: parsed.data.phone,
        tier: parsed.data.tier,
        // Send empty string so the backend can clear an optional field.
        email: parsed.data.email ? parsed.data.email : "",
        secondaryPhone: parsed.data.secondaryPhone ? parsed.data.secondaryPhone : "",
      };
      const updated = await updateCustomer(customer.id, payload);
      toast.success(`${updated.name} updated`);
      setOpen(false);
      onUpdated?.(updated);
    } catch (error) {
      const message =
        error instanceof Error && error.message ? error.message : "Failed to update client";
      toast.error(message);
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Edit Client</DialogTitle>
          <DialogDescription>Update this client's details.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="ecname">Name</Label>
            <Input
              id="ecname"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              maxLength={100}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ecemail">Email (optional)</Label>
            <Input
              id="ecemail"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="eloise@example.com"
              maxLength={255}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ecphone">Customer number</Label>
            <Input
              id="ecphone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              maxLength={40}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ecsecondaryphone">Customer number 2 (optional)</Label>
            <Input
              id="ecsecondaryphone"
              value={form.secondaryPhone}
              onChange={(e) => setForm({ ...form, secondaryPhone: e.target.value })}
              maxLength={40}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ectier">Tier</Label>
            <Select
              value={form.tier}
              onValueChange={(v: "Standard" | "Gold" | "Platinum") =>
                setForm({ ...form, tier: v })
              }
            >
              <SelectTrigger id="ectier">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["Standard", "Gold", "Platinum"] as const).map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-gold text-gold-foreground hover:bg-gold/90"
              disabled={loading}
            >
              {loading ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
