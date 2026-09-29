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
import { formatCurrencyINR, SIZE_OPTIONS, DEFAULT_SIZE } from "@/lib/utils";
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
  size: z.string().trim().min(1, "Required").max(16),
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
  const defaultSubcategory = categorySubcategoryMap[defaultCategory as keyof typeof categorySubcategoryMap]?.[0] ?? "";

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
size: DEFAULT_SIZE,
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
size: DEFAULT_SIZE,
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
      <DialogContent className="w-full max-w-full sm:max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0">

        {/* ── Dialog Header ── */}
        <div className="bg-gradient-to-r from-[#E73F1E] via-[#FB6C00] to-[#F9B637] px-6 pt-6 pb-4 sticky top-0 z-10">
          <DialogHeader>
          <DialogTitle className="font-display text-2xl text-white tracking-wide">
            Add a Piece
          </DialogTitle>
          <DialogDescription className="text-white/80 text-sm">
            Catalog a new item in the vault.
          </DialogDescription>
          </DialogHeader>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6 bg-[#FFF8EE]">

          {/* ── Item Identity ── */}
          <div className="rounded-xl border border-[#F5C98A] bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 bg-gradient-to-r from-[#FFEDD4] to-[#FFF3E0] border-b border-[#F5C98A] flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#E73F1E]">
                📋 Item Identity
              </span>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="customId" className="text-xs font-semibold text-[#7A3010]">Item No</Label>
                <Input
                  id="customId"
                  value={form.customId}
                  onChange={(e) => setForm({ ...form, customId: e.target.value })}
                  placeholder="e.g. VV-1234"
                  maxLength={40}
                  required
                  className="border-[#F5C98A] bg-[#FFF8EE] focus:border-[#E73F1E] focus:ring-[#E73F1E]/20 placeholder:text-[#C09A6A]"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="name" className="text-xs font-semibold text-[#7A3010]">Name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Onyx Tuxedo Coat"
                  maxLength={80}
                  required
                  className="border-[#F5C98A] bg-[#FFF8EE] focus:border-[#E73F1E] focus:ring-[#E73F1E]/20 placeholder:text-[#C09A6A]"
                />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="designer" className="text-xs font-semibold text-[#7A3010]">Designer / Brand</Label>
                <Input
                  id="designer"
                  value={form.designer}
                  onChange={(e) => setForm({ ...form, designer: e.target.value })}
                  placeholder="Maison Noir"
                  maxLength={60}
                  required
                  className="border-[#F5C98A] bg-[#FFF8EE] focus:border-[#E73F1E] focus:ring-[#E73F1E]/20 placeholder:text-[#C09A6A]"
                />
              </div>
            </div>
          </div>

          {/* ── Classification ── */}
          <div className="rounded-xl border border-[#F5C98A] bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 bg-gradient-to-r from-[#FFEDD4] to-[#FFF3E0] border-b border-[#F5C98A]">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#E73F1E]">
                🏷️ Classification
              </span>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="category" className="text-xs font-semibold text-[#7A3010]">Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => {
                    if (v === CUSTOM_CATEGORY) {
                      setForm({ ...form, category: v, subcategory: CUSTOM_SUBCATEGORY, customCategory: "", customSubcategory: "" });
                      return;
                    }
                    const firstSubcategory = categorySubcategoryMap[v as keyof typeof categorySubcategoryMap]?.[0] || "";
                    setForm({ ...form, category: v, subcategory: firstSubcategory, customCategory: "", customSubcategory: "" });
                  }}
                >
                  <SelectTrigger id="category" className="border-[#F5C98A] bg-[#FFF8EE]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
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
                    className="border-[#F5C98A] bg-[#FFF8EE] focus:border-[#E73F1E]"
                  />
                )}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="subcategory" className="text-xs font-semibold text-[#7A3010]">Subcategory</Label>
                {form.category === CUSTOM_CATEGORY ? (
                  <Input
                    id="customSubcategory"
                    value={form.customSubcategory}
                    onChange={(e) => setForm({ ...form, customSubcategory: e.target.value })}
                    placeholder="Enter new subcategory"
                    maxLength={40}
                    required
                    className="border-[#F5C98A] bg-[#FFF8EE] focus:border-[#E73F1E]"
                  />
                ) : (
                  <>
                    <Select value={form.subcategory} onValueChange={(v) => setForm({ ...form, subcategory: v })}>
                      <SelectTrigger id="subcategory" className="border-[#F5C98A] bg-[#FFF8EE]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(categorySubcategoryMap[form.category as keyof typeof categorySubcategoryMap] || []).map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
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
                        className="border-[#F5C98A] bg-[#FFF8EE] focus:border-[#E73F1E]"
                      />
                    )}
                  </>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="size" className="text-xs font-semibold text-[#7A3010]">Size</Label>
                <Select value={form.size} onValueChange={(v) => setForm({ ...form, size: v })}>
                  <SelectTrigger id="size" className="border-[#F5C98A] bg-[#FFF8EE]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SIZE_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="color" className="text-xs font-semibold text-[#7A3010]">Color</Label>
                <Input
                  id="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  placeholder="Emerald"
                  maxLength={30}
                  required
                  className="border-[#F5C98A] bg-[#FFF8EE] focus:border-[#E73F1E] focus:ring-[#E73F1E]/20 placeholder:text-[#C09A6A]"
                />
              </div>
            </div>
          </div>

          {/* ── Pricing & Status ── */}
          <div className="rounded-xl border border-[#F5C98A] bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 bg-gradient-to-r from-[#FFEDD4] to-[#FFF3E0] border-b border-[#F5C98A]">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#E73F1E]">
                💰 Pricing &amp; Status
              </span>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="price" className="text-xs font-semibold text-[#7A3010]">Rental Value (INR)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#FB6C00] font-bold text-sm">₹</span>
                  <Input
                    id="price"
                    type="number"
                    min={0}
                    value={form.pricePerDay}
                    onChange={(e) => setForm({ ...form, pricePerDay: e.target.value })}
                    placeholder="0"
                    required
                    className="pl-7 border-[#F5C98A] bg-[#FFF8EE] focus:border-[#E73F1E] focus:ring-[#E73F1E]/20"
                  />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="status" className="text-xs font-semibold text-[#7A3010]">Status</Label>
                <Select value={form.status} onValueChange={(v: ItemStatus) => setForm({ ...form, status: v })}>
                  <SelectTrigger id="status" className="border-[#F5C98A] bg-[#FFF8EE]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["available", "rented", "cleaning", "reserved"] as const).map((s) => (
                      <SelectItem key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="quantity" className="text-xs font-semibold text-[#7A3010]">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min={0}
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                  required
                  className="border-[#F5C98A] bg-[#FFF8EE] focus:border-[#E73F1E] focus:ring-[#E73F1E]/20"
                />
              </div>
            </div>
          </div>

          {/* ── Image Upload ── */}
          <div className="rounded-xl border border-[#F5C98A] bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 bg-gradient-to-r from-[#FFEDD4] to-[#FFF3E0] border-b border-[#F5C98A]">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#E73F1E]">
                🖼️ Photos
              </span>
            </div>
            <div className="p-4 space-y-3">
              {form.images && form.images.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {form.images.map((img, idx) => (
                    <div key={idx} className="relative group shrink-0">
                      <img
                        src={img}
                        alt={`Preview ${idx + 1}`}
                        className="h-20 w-16 rounded-lg border-2 border-[#F5C98A] object-cover shadow-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setForm(c => ({ ...c, images: c.images.filter((_, i) => i !== idx) }))}
                        className="absolute -top-2 -right-2 bg-[#E73F1E] text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border-2 border-dashed border-[#F5C98A] rounded-lg p-4 text-center bg-[#FFF8EE]">
                  <p className="text-xs text-[#9C6A3A]">📸 Add a clear garment photo. JPG, PNG, or WEBP.</p>
                </div>
              )}
              <Input
                id="image"
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => handleImagesUpload(e.target.files)}
                className="border-[#F5C98A] bg-[#FFF8EE] text-sm cursor-pointer file:bg-[#FFEDD4] file:text-[#E73F1E] file:border-0 file:rounded-md file:px-3 file:py-1 file:text-xs file:font-semibold file:mr-3"
              />
            </div>
          </div>

          {/* ── Footer Buttons ── */}
          <DialogFooter className="pt-2 flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="border-[#F5C98A] text-[#7A3010] hover:bg-[#FFEDD4] flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-[#E73F1E] via-[#FB6C00] to-[#F9B637] hover:from-[#C9310F] hover:to-[#E09A00] text-white font-bold shadow-md border-0"
            >
              {loading ? "Adding..." : "✦ Add Piece"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
