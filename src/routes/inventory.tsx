import { useState, useRef, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { useStore } from "@/data/store";
import { formatCurrencyINR } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Edit2, Plus, Trash2, Upload } from "lucide-react";
import { AddPieceDialog } from "@/components/forms/AddPieceDialog";
import { EditPieceDialog } from "@/components/forms/EditPieceDialog";
import { toast } from "sonner";
import * as XLSX from "xlsx";

const DEFAULT_CATEGORIES = {
  MENS: "Mens",
  WOMENS: "Women's",
};

const DEFAULT_SUBCATEGORY_BY_CATEGORY = {
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


function InventoryItemCard({ item, role, deletingId, handleDelete }: { item: any; role: string; deletingId: string | null; handleDelete: (id: string, name: string) => void; }) {
  const [imgIndex, setImgIndex] = useState(0);
  const images = item.images && item.images.length > 0 ? item.images : (item.image ? [item.image] : []);

  return (
    <Card className="glass-panel overflow-hidden group transition-shadow p-0 gap-0">
      <div className="relative aspect-3/4 overflow-hidden bg-secondary">
        {images.length > 0 ? (
          <img
            src={images[imgIndex]}
            alt={item.name}
            width={640}
            height={800}
            loading="lazy"
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center bg-secondary text-muted-foreground text-xs">No Image</div>
        )}
        
        {images.length > 1 && (
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">
            {images.map((_: any, i: number) => (
              <button
                key={i}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setImgIndex(i);
                }}
                className={`w-1.5 h-1.5 rounded-full transition-all shadow-sm ${i === imgIndex ? "bg-gold scale-125" : "bg-white/60 hover:bg-white"}`}
                aria-label={`View image ${i + 1}`}
              />
            ))}
          </div>
        )}

        <div className="absolute top-3 left-3 z-10">
          <StatusBadge status={item.status} />
        </div>
        {(role === "admin" || role === "reception") && (
          <div className="absolute top-3 right-3 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 z-20">
            <div className="flex items-center gap-2">
              <EditPieceDialog
                item={item}
                trigger={
                  <Button type="button" size="icon" variant="outline" className="h-8 w-8 border-gold/40 bg-secondary/10 hover:bg-secondary/30" aria-label={`Edit ${item.name}`}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                }
                onUpdated={() => toast.success(`Updated ${item.name}`)}
              />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" size="icon" variant="destructive" className="h-8 w-8 bg-destructive/90 text-destructive-foreground hover:bg-destructive" aria-label={`Delete ${item.name}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="font-display text-2xl">Delete {item.name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove the piece from inventory. Any rentals linked to this item will also disappear from this screen.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deletingId === item.id} onClick={() => handleDelete(item.id, item.name)}>
                      {deletingId === item.id ? "Deleting..." : "Delete"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-linear-to-t from-background/80 to-transparent opacity-80 pointer-events-none" />
      </div>
      <CardContent className="p-3 sm:p-5">
        <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.25em] text-muted-foreground truncate">{item.designer}</p>
        <h3 className="font-display text-base sm:text-lg mt-1 leading-tight truncate">
          {item.id} - {item.name}
        </h3>
        <div className="flex items-baseline justify-between mt-2 sm:mt-3 gap-2">
          <span className="text-gold font-display text-lg sm:text-xl">{formatCurrencyINR(item.pricePerDay)}</span>
          <span className="text-[10px] sm:text-[11px] text-muted-foreground shrink-0">Size {item.size}</span>
        </div>
        <div className="hairline mt-4" />
        <div className="flex items-center justify-between mt-3 text-[11px] text-muted-foreground">
          <span>{item.id}</span>
          <span>{item.timesRented} rentals</span>
        </div>
        <div className="mt-2 rounded-sm border border-border bg-secondary/30 px-2 py-1 text-[11px] text-muted-foreground">
          Quantity: <span className="font-semibold text-foreground">{item.quantity ?? 1}</span>
        </div>
      </CardContent>
    </Card>
  );
}

// Custom lightweight navigation hook
const useNavigate = () => {
  return (options: { to: string }) => {
    window.history.pushState({}, '', options.to);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };
};

export default function InventoryPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const role = localStorage.getItem("user_role");
    if (!role) {
      navigate({ to: "/login" });
    }
  }, []);

  const { items, loading, deleteItem, searchQuery, addItem } = useStore();
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeSubcategory, setActiveSubcategory] = useState("All");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const query = searchQuery.trim().toLowerCase();
  const role = typeof window !== "undefined"
    ? localStorage.getItem("user_role") || "employee"
    : "employee";

  const itemCategories = Array.from(
    new Set([
      ...Object.values(DEFAULT_CATEGORIES),
      ...items.map((i: any) => i.category).filter(Boolean),
    ]),
  );

  const dynamicSubcategoryByCategory = items.reduce(
    (acc: Record<string, string[]>, item: any) => {
      if (!item.category || !item.subcategory) return acc;
      const current = acc[item.category] || [
        ...(DEFAULT_SUBCATEGORY_BY_CATEGORY[item.category as keyof typeof DEFAULT_SUBCATEGORY_BY_CATEGORY] || []),
      ];
      if (!current.includes(item.subcategory)) {
        current.push(item.subcategory);
      }
      acc[item.category] = current;
      return acc;
    },
    {
      ...DEFAULT_SUBCATEGORY_BY_CATEGORY,
    } as Record<string, string[]>,
  );

  const categoryOptions = itemCategories;

  const filteredItems = items.filter((i) => {
    const matchesCategory = activeCategory === "All" || i.category === activeCategory;
    const matchesSubcategory = activeSubcategory === "All" || i.subcategory === activeSubcategory;
    const searchable = [
      i.customId,
      i.name,
      i.designer,
      i.category,
      i.subcategory,
      i.size,
      i.color,
      i.status,
    ]
      .join(" ")
      .toLowerCase();
    return matchesCategory && matchesSubcategory && (!query || searchable.includes(query));
  });
  
  // Sort by item number (customId) alphanumerically
  filteredItems.sort((a, b) => {
    return a.id.localeCompare(b.id, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });
  
  const subcategories =
    activeCategory !== "All"
      ? dynamicSubcategoryByCategory[activeCategory] || []
      : [];

  // Counts for UI chips (respects current search query)
  const normalizedQuery = query;
  const searchableFor = (i: any) =>
    [
      i.customId,
      i.name,
      i.designer,
      i.category,
      i.subcategory,
      i.size,
      i.color,
      i.status,
    ]
      .join(" ")
      .toLowerCase();

  const matchesSearch = (i: any) =>
    !normalizedQuery || searchableFor(i).includes(normalizedQuery);

  const availableItems = items.filter(matchesSearch);

  const categoryCounts: Record<string, number> = availableItems.reduce(
    (acc: Record<string, number>, i: any) => {
      if (!i.category) return acc;
      acc[i.category] = (acc[i.category] || 0) + 1;
      return acc;
    },
    {},
  );

  const typeCounts: Record<string, number> = availableItems.reduce(
    (acc: Record<string, number>, i: any) => {
      acc[i.subcategory] = (acc[i.subcategory] || 0) + 1;
      return acc;
    },
    {}
  );


  async function handleDelete(id: string, name: string) {
    console.info("[InventoryPage] delete requested", { id, name });
    setDeletingId(id);
    try {
      await deleteItem(id);
      toast.success(`${name} deleted`);
      console.info("[InventoryPage] delete success", { id, name });
    } catch (error) {
      console.error("[InventoryPage] delete failed", { id, name, error });
      toast.error(`Failed to delete ${name}`);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['.xlsx', '.xls', '.csv'];
    const isValidType = validTypes.some(type => file.name.toLowerCase().endsWith(type));
    if (!isValidType) {
      toast.error('Please select a valid Excel (.xlsx, .xls) or CSV file');
      return;
    }

    setUploading(true);
    try {
      // Read file on frontend to bypass strict backend validation
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(worksheet);

      if (rows.length === 0) {
        toast.error("The uploaded file appears to be empty.");
        return;
      }

      toast.info(`Found ${rows.length} rows. Importing...`);
      let successCount = 0;

      for (const rawRow of rows) {
        try {
          // Normalize row keys to lowercase and trim spaces
          const row: Record<string, any> = {};
          for (const key in rawRow) {
            row[key.toLowerCase().trim()] = rawRow[key];
          }

          // Forgiving mapping with smart defaults so data is accepted easily
          await addItem({
            name: String(row.name || row.item || row.title || row.piece || "Unnamed Piece"),
            designer: String(row.designer || row.brand || row.maker || "Unknown"),
            category: String(row.category || row.department || "Women's"),
            subcategory: String(row.subcategory || row.type || row.style || "Lehanga"),
            size: String(row.size || row.fit || "M"),
            color: String(row.color || row.shade || row.hue || "Unknown"),
            pricePerDay: (() => {
              const raw = row.price ?? row.rent ?? row.rate ?? row.cost ?? row["price/day"] ?? row["price per day"] ?? row["rent/day"] ?? row["price / day (inr)"] ?? row["price/day (inr)"] ?? 0;
              const cleaned = String(raw).replace(/[^0-9.-]/g, "").trim();
              const n = Number(cleaned);
              return Number.isNaN(n) ? 0 : n;
            })(),
            retailValue: (() => {
              const raw = row.retail ?? row.value ?? row.mrp ?? row["retail value"] ?? row["retail value (inr)"] ?? row.original ?? 0;
              const cleaned = String(raw).replace(/[^0-9.-]/g, "").trim();
              const n = Number(cleaned);
              return Number.isNaN(n) ? 0 : n;
            })(),
            quantity: (() => {
              const raw = row.quantity ?? row.qty ?? row.stock ?? row["stock quantity"] ?? 1;
              const n = Number(String(raw).replace(/[^0-9.-]/g, "").trim());
              return Number.isNaN(n) ? 1 : Math.max(0, Math.floor(n));
            })(),
            status: "available",
            image: String(row.image || row.photo || row.picture || row.img || "")
          });
          successCount++;
        } catch (err) {
          console.error("Skipped a row due to error:", err);
        }
      }

      if (successCount > 0) {
        toast.success(`Successfully imported ${successCount} pieces!`);
      } else {
        toast.error("Could not import any items. Check file format.");
      }
    } catch (error) {
      toast.error('Failed to upload file');
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading inventory...</div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-gold">
            The Vault
          </p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl">Inventory</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {items.length} pieces curated - {items.filter((i) => i.status === "available").length} available
          </p>
        </div>
      {["admin", "employee", "reception"].includes(role) && (
        <div className="flex gap-2">
          {['admin', 'employee', 'reception'].includes(role) && (
            <Button
              variant="outline"
              className="border-gold text-gold hover:bg-gold hover:text-gold-foreground"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-1.5" />
              {uploading ? "Uploading..." : "Upload Excel"}
            </Button>
          )}
          <AddPieceDialog
            categories={categoryOptions}
            subcategoryByCategory={dynamicSubcategoryByCategory}
            trigger={
              <Button className="bg-gold text-gold-foreground hover:bg-gold/90 self-start sm:self-auto">
                <Plus className="h-4 w-4 mr-1.5" /> Add Piece
              </Button>
            }
          />
        </div>
      )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx, .xls, .csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel, text/csv"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>

      <div className="mb-6 sm:mb-8">
        <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">Category</h3>
        <div className="flex flex-wrap gap-2 -mx-1 px-1 overflow-x-auto sm:overflow-visible">
          {['All', ...categoryOptions].map((c) => {
            const count = c === "All" ? availableItems.length : categoryCounts[c] ?? 0;
            return (
              <button
                key={c}
                onClick={() => {
                  setActiveCategory(c);
                  setActiveSubcategory("All");
                }}
                className={`shrink-0 px-3 sm:px-4 py-1.5 rounded-full text-[11px] sm:text-xs uppercase tracking-[0.18em] sm:tracking-[0.2em] border transition-colors ${
                  activeCategory === c
                    ? "bg-gold text-gold-foreground border-gold"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-gold/40"
                }`}
              >
                <span className="mr-1">{c}</span>
                <span className={`text-[10px] ${
                  activeCategory === c ? "text-gold-foreground/90" : "text-muted-foreground"
                }`}>({count})</span>
              </button>
            );
          })}

        </div>
      </div>

      {activeCategory !== "All" && subcategories.length > 0 && (
        <div className="mb-6 sm:mb-8">
          <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">Type</h3>
          <div className="flex flex-wrap gap-2 -mx-1 px-1 overflow-x-auto sm:overflow-visible">
            {["All", ...subcategories].map((s) => (
              <button
                key={s}
                onClick={() => setActiveSubcategory(s)}
                className={`shrink-0 px-3 sm:px-4 py-1.5 rounded-full text-[11px] sm:text-xs uppercase tracking-[0.18em] sm:tracking-[0.2em] border transition-colors ${
                  activeSubcategory === s
                    ? "bg-accent text-accent-foreground border-accent"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-accent/40"
                }`}
              >
                <span className="mr-1">{s}</span>
                <span className={`text-[10px] ${
                  activeSubcategory === s ? "text-accent-foreground/90" : "text-muted-foreground"
                }`}>({s === "All" ? availableItems.filter((i:any)=> i.category === activeCategory).length : typeCounts[s] ?? 0})</span>
              </button>
            ))}

          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
        {filteredItems.length === 0 && (
          <Card className="glass-panel col-span-full p-6 text-sm text-muted-foreground">
            No inventory pieces match your search.
          </Card>
        )}
        {filteredItems.map((item) => (
          <InventoryItemCard key={item.id} item={item} role={role} deletingId={deletingId} handleDelete={handleDelete} />
        ))}
      </div>
    </AppShell>
  );
}
