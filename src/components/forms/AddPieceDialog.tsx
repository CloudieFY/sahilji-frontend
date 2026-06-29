import { useState, type ReactNode } from "react";
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
import type { ItemStatus } from "@/data/mock";

const CATEGORIES = {
  MENS: "Mens",
  WOMENS: "Women's",
};

const CUSTOM_CATEGORY = "__custom_category__";
const CUSTOM_SUBCATEGORY = "__custom_subcategory__";

const SUBCATEGORY_BY_CATEGORY = {
  "Mens": [
    "Suit",
    "Jodhpuri",
    "Sherwani",
    "Accessories",
  ],
  "Women's": [
    "Lehanga",
    "Sider jewellery",
    "Bridal jewellery",
    "Gown",
    "Rajputana Dress",
    "Accessories",
  ],
};

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

const FALLBACK_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 400'><rect width='300' height='400' fill='%23eee'/><text x='150' y='200' text-anchor='middle' font-family='serif' font-size='28' fill='%23999'>Velvet Vault</text></svg>`,
  );

export function AddPieceDialog({
  trigger,
  open,
  onOpenChange,
  categories,
  subcategoryByCategory,
}: {
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  categories?: string[];
  subcategoryByCategory?: Record<string, string[]>;
}) {
  const categoryOptions = categories && categories.length > 0 ? categories : Object.values(CATEGORIES);
  const categorySubcategoryMap = {
    ...SUBCATEGORY_BY_CATEGORY,
    ...(subcategoryByCategory || {}),
  };

  const defaultCategory = categoryOptions[0] ?? CATEGORIES.WOMENS;
  const defaultSubcategory = categorySubcategoryMap[defaultCategory]?.[0] ?? "";

  const { addItem } = useStore();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setOpen = isControlled ? onOpenChange! : setInternalOpen;

  const [form, setForm] = useState({
    customId: "",
    name: "",
    designer: "",
    category: defaultCategory,
    customCategory: "",
    subcategory: defaultSubcategory,
    customSubcategory: "",
    size: "M",
    color: "",
    pricePerDay: "",
    retailValue: "",
    quantity: 1,
    status: "available" as ItemStatus,
    images: [] as string[],
  });

  function reset() {
    setForm({
      customId: "",
      name: "",
      designer: "",
      category: defaultCategory,
      customCategory: "",
      subcategory: defaultSubcategory,
      customSubcategory: "",
      size: "M",
      color: "",
      pricePerDay: "",
      retailValue: "",
      quantity: 1,
      status: "available",
      images: [],
    });
  }

  const [loading, setLoading] = useState(false);

  async function compressImage(
    file: File,
    maxWidth = 800,
    maxHeight = 800,
    quality = 0.7
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      const reader = new FileReader();
      reader.onload = (e) => {
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          if (width > maxWidth || height > maxHeight) {
            if (width / height > maxWidth / maxHeight) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            } else {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject(new Error('Canvas context is null'));
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (!blob) return reject(new Error('Compression failed'));
              const reader2 = new FileReader();
              reader2.onloadend = () => {
                if (typeof reader2.result === 'string') {
                  resolve(reader2.result);
                } else {
                  reject(new Error('Result is not a string'));
                }
              };
              reader2.onerror = reject;
              reader2.readAsDataURL(blob);
            },
            'image/jpeg',
            quality
          );
        };
        img.onerror = reject;
        if (e && e.target && typeof e.target.result === 'string') {
          img.src = e.target.result;
        } else {
          reject(new Error('FileReader result is not a string'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleImagesUpload(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        toast.error(`File ${file.name} is not an image`);
        continue;
      }
      try {
        const compressed = await compressImage(file);
        if (typeof compressed === 'string') {
          setForm((current) => ({ ...current, images: [...current.images, compressed] }));
        }
      } catch (err) {
        toast.error(`Could not process image file ${file.name}`);
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    console.info("[AddPieceDialog] submit started", form);
    const categoryValue =
      form.category === CUSTOM_CATEGORY ? form.customCategory.trim() : form.category;
    const subcategoryValue =
      form.subcategory === CUSTOM_SUBCATEGORY ? form.customSubcategory.trim() : form.subcategory;

    const submitData = {
      ...form,
      category: categoryValue,
      subcategory: subcategoryValue,
    };

    const parsed = schema.safeParse(submitData);
    if (!parsed.success) {
      console.warn("[AddPieceDialog] validation failed", parsed.error.issues);
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setLoading(true);
    try {
      console.info("[AddPieceDialog] calling addItem");
      const item = await addItem({
        ...parsed.data,
        retailValue: parsed.data.retailValue ?? 0,
        image: parsed.data.images?.[0] || FALLBACK_IMG,
        images: parsed.data.images || [],
      } as any);
      console.info("[AddPieceDialog] addItem success", item);
      toast.success(`Added ${item.name} to the vault`);
      reset();
      setOpen(false);
    } catch (error) {
      console.error("[AddPieceDialog] addItem failed", error);
      toast.error("Failed to add item");
    } finally {
      setLoading(false);
      console.info("[AddPieceDialog] submit finished");
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="w-full max-w-full sm:max-w-lg max-h-[90vh] overflow-y-auto px-2 sm:px-0">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Add a Piece</DialogTitle>
          <DialogDescription>Catalog a new item in the vault.</DialogDescription>
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
                  onChange={(e) => setForm({ ...form, customId: e.target.value })}
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
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
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
                  onChange={(e) => setForm({ ...form, designer: e.target.value })}
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
                    if (v === CUSTOM_CATEGORY) {
                      setForm({
                        ...form,
                        category: v,
                        subcategory: CUSTOM_SUBCATEGORY,
                        customCategory: "",
                        customSubcategory: "",
                      });
                      return;
                    }

                    const firstSubcategory = categorySubcategoryMap[v as keyof typeof categorySubcategoryMap]?.[0] || "";
                    setForm({
                      ...form,
                      category: v,
                      subcategory: firstSubcategory,
                      customCategory: "",
                      customSubcategory: "",
                    });
                  }}
                >
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                    <SelectItem value={CUSTOM_CATEGORY}>Custom category</SelectItem>
                  </SelectContent>
                </Select>
                {form.category === CUSTOM_CATEGORY && (
                  <Input
                    id="customCategory"
                    value={form.customCategory}
                    onChange={(e) => setForm({ ...form, customCategory: e.target.value })}
                    placeholder="Enter new category"
                    maxLength={20}
                    required
                  />
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="subcategory">Subcategory</Label>
                {form.category === CUSTOM_CATEGORY ? (
                  <Input
                    id="customSubcategory"
                    value={form.customSubcategory}
                    onChange={(e) => setForm({ ...form, customSubcategory: e.target.value })}
                    placeholder="Enter new subcategory"
                    maxLength={40}
                    required
                  />
                ) : (
                  <>
                    <Select
                      value={form.subcategory}
                      onValueChange={(v) => setForm({ ...form, subcategory: v })}
                    >
                      <SelectTrigger id="subcategory">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categorySubcategoryMap[form.category as keyof typeof categorySubcategoryMap]?.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                        <SelectItem value={CUSTOM_SUBCATEGORY}>Custom subcategory</SelectItem>
                      </SelectContent>
                    </Select>
                    {form.subcategory === CUSTOM_SUBCATEGORY && (
                      <Input
                        id="customSubcategory"
                        value={form.customSubcategory}
                        onChange={(e) => setForm({ ...form, customSubcategory: e.target.value })}
                        placeholder="Enter new subcategory"
                        maxLength={40}
                        required
                      />
                    )}
                  </>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="size">Size</Label>
                <Select
                  value={form.size}
                  onValueChange={(v) => setForm({ ...form, size: v })}
                >
                  <SelectTrigger id="size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["XS", "S", "M", "L", "XL"].map((s) => (
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
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
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
                  onChange={(e) =>
                    setForm({ ...form, pricePerDay: e.target.value })
                  }
                  placeholder={formatCurrencyINR(95)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(v: ItemStatus) =>
                    setForm({ ...form, status: v })
                  }
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["available", "rented", "cleaning", "reserved"] as const).map(
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
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min={0}
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                  required
                />
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="image">Upload Image</Label>
            <div className="grid gap-3 rounded-md border border-border bg-secondary/30 p-4">
              {form.images && form.images.length > 0 ? (
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  {form.images.map((img, idx) => (
                    <div key={idx} className="relative group shrink-0">
                      <img
                        src={img}
                        alt={`Preview ${idx + 1}`}
                        className="h-20 w-16 sm:h-20 sm:w-16 rounded-sm border border-border object-cover shadow-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setForm(c => ({ ...c, images: c.images.filter((_, i) => i !== idx) }))}
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
              {loading ? "Adding..." : "Add Piece"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
