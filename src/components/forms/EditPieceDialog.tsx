import { useMemo, useState } from "react";
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
import { formatCurrencyINR } from "@/lib/utils";
import { X } from "lucide-react";

import type { Item, ItemStatus } from "@/data/mock";

const CATEGORIES = {
  MENS: "Mens",
  WOMENS: "Women's",
};

const SUBCATEGORY_BY_CATEGORY = {
  "Mens": [
    "Suit", 
    "Jodhpuri", 
    "Sherwani",
    "Accessories"
  ],
  "Women's": [
    "Lehanga", 
    "Sider jewellery", 
    "Bridal jewellery",
    "Accessories",
    "Gown",
    "Rajputana Dress"
  ]
};

const SIZES = ["34", "36", "38", "40", "42", "44", "46", "48"];

const schema = z.object({
  customId: z.string().trim().min(1, "Required").max(40),
  name: z.string().trim().min(1, "Required").max(80),
  designer: z.string().trim().min(1, "Required").max(60),
  category: z.string().trim().min(1, "Required").max(20),
  subcategory: z.string().trim().min(1, "Required").max(40),
  size: z.string().trim().min(1, "Required").max(8),
  color: z.string().trim().min(1, "Required").max(30),
  pricePerDay: z.coerce.number().min(0),
  retailValue: z.coerce.number().min(0).optional(),
  quantity: z.coerce.number().int().min(0),
  status: z.enum(["available", "rented", "cleaning", "reserved"]),
  images: z.array(z.string()).optional(),
});

export function EditPieceDialog({
  item,
  trigger,
  onUpdated,
  disabled,
}: {
  item: Item;
  trigger: React.ReactNode;
  onUpdated?: (updated: Item) => void;
  disabled?: boolean;
}) {
  const { updateItem } = useStore();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    customId: item.customId ?? "",
    name: item.name ?? "",
    designer: item.designer ?? "",
    category: item.category ?? CATEGORIES.WOMENS,
    subcategory:
      item.subcategory ??
      SUBCATEGORY_BY_CATEGORY[
        item.category as keyof typeof SUBCATEGORY_BY_CATEGORY
      ]?.[0] ??
      "",
    size: item.size ?? "M",
    color: item.color ?? "",
    pricePerDay: item.pricePerDay ?? 0,
    retailValue: item.retailValue ?? 0,
    quantity: (item as any).quantity ?? 1,
    status: (item.status ?? "available") as ItemStatus,
    images: ((item as any).images ?? (item.image ? [item.image] : [])) as string[],
  });

  const defaultForm = useMemo(() => {
    return {
      customId: item.customId ?? "",
      name: item.name ?? "",
      designer: item.designer ?? "",
      category: item.category ?? CATEGORIES.WOMENS,
      subcategory:
        item.subcategory ??
        SUBCATEGORY_BY_CATEGORY[
          item.category as keyof typeof SUBCATEGORY_BY_CATEGORY
        ]?.[0] ??
        "",
      size: item.size ?? "M",
      color: item.color ?? "",
      pricePerDay: item.pricePerDay ?? 0,
      retailValue: item.retailValue ?? 0,
      quantity: (item as any).quantity ?? 1,
      status: (item.status ?? "available") as ItemStatus,
      images: ((item as any).images ?? (item.image ? [item.image] : [])) as string[],
    };
  }, [item]);

  // keep form in sync when item changes (e.g. rerender)
  // (avoid setState during render to prevent infinite re-renders)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => {
    if (!open) setForm(defaultForm);
    return null;
  }, [open, defaultForm]);

  function handleImagesUpload(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) {
        toast.error(`File ${file.name} is not an image`);
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        toast.error(`Image ${file.name} must be smaller than 2 MB`);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setForm((c) => ({ ...c, images: [...c.images, reader.result as string] }));
        }
      };
      reader.onerror = () => {
        toast.error(`Could not read image file ${file.name}`);
      };
      reader.readAsDataURL(file);
    });
  }

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
        ...parsed.data,
        image: parsed.data.images?.[0] || "",
        images: parsed.data.images || [],
      };

      const updated = await updateItem(item.id, payload as any);
      onUpdated?.(updated);
      toast.success(`${updated.name} updated`);
      setOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update item");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Edit Piece</DialogTitle>
          <DialogDescription>Update inventory details.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-2">
          {/* Identity Section */}
          <div className="space-y-4 rounded-lg border border-border bg-secondary/10 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">Item Identity</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="customId">Item No</Label>
                <Input
                  id="customId"
                  value={form.customId}
                  onChange={(e) => setForm((c) => ({ ...c, customId: e.target.value }))}
                  placeholder="e.g. VV-1234"
                  maxLength={40}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
                  placeholder="Onyx Tuxedo Coat"
                  maxLength={80}
                  required
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="designer">Designer</Label>
                <Input
                  id="designer"
                  value={form.designer}
                  onChange={(e) => setForm((c) => ({ ...c, designer: e.target.value }))}
                  placeholder="Maison Noir"
                  maxLength={60}
                  required
                />
              </div>
            </div>
          </div>

          {/* Classification Section */}
          <div className="space-y-4 rounded-lg border border-border bg-secondary/10 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">Classification</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => {
                    const firstSub =
                      SUBCATEGORY_BY_CATEGORY[v as keyof typeof SUBCATEGORY_BY_CATEGORY]?.[0] ?? "";
                    setForm((c) => ({ ...c, category: v, subcategory: firstSub }));
                  }}
                >
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(CATEGORIES).map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="subcategory">Subcategory</Label>
                <Select
                  value={form.subcategory}
                  onValueChange={(v) => setForm((c) => ({ ...c, subcategory: v }))}
                >
                  <SelectTrigger id="subcategory">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBCATEGORY_BY_CATEGORY[form.category as keyof typeof SUBCATEGORY_BY_CATEGORY]?.map(
                      (s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="size">Size</Label>
                <Select
                  value={form.size}
                  onValueChange={(v) => setForm((c) => ({ ...c, size: v }))}
                >
                  <SelectTrigger id="size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SIZES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="color">Color</Label>
                <Input
                  id="color"
                  value={form.color}
                  onChange={(e) => setForm((c) => ({ ...c, color: e.target.value }))}
                  placeholder="Emerald"
                  maxLength={30}
                  required
                />
              </div>
            </div>
          </div>

          {/* Pricing & Status Section */}
          <div className="space-y-4 rounded-lg border border-border bg-secondary/10 p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">Pricing & Status</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="price">Rental value (INR)</Label>
                <Input
                  id="price"
                  type="number"
                  min={0}
                  value={form.pricePerDay}
                  onChange={(e) => setForm((c) => ({ ...c, pricePerDay: Number(e.target.value) }))}
                  placeholder={formatCurrencyINR(95)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v: ItemStatus) => setForm((c) => ({ ...c, status: v }))}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["available", "rented", "cleaning", "reserved"] as const).map((s) => (
                      <SelectItem key={s} value={s}>
                        {s[0].toUpperCase() + s.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min={0}
                  value={form.quantity}
                  onChange={(e) => setForm((c) => ({ ...c, quantity: Number(e.target.value) }))}
                  required
                />
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="image">Upload Image</Label>
            <div className="grid gap-3 rounded-md border border-border bg-secondary/30 p-4">
              {form.images && form.images.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {form.images.map((img: string, idx: number) => (
                    <div key={idx} className="relative group shrink-0">
                      <img
                        src={img}
                        alt={`Preview ${idx + 1}`}
                        className="h-20 w-16 rounded-sm border border-border object-cover shadow-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setForm(c => ({ ...c, images: c.images.filter((_: string, i: number) => i !== idx) }))}
                        className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Add a clear garment photo. JPG, PNG, or WEBP up to 2 MB.
                </p>
              )}
              <Input
                id="image"
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => handleImagesUpload(e.target.files)}
              />
            </div>
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
              {loading ? "Updating..." : "Update Piece"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
