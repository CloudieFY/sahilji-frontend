import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

const SIZES = ["34", "36", "38", "40", "42", "44", "46", "48"];

export function AddPieceDialog({
  trigger,
  categories,
  subcategoryByCategory,
}: {
  trigger: React.ReactNode;
  categories: string[];
  subcategoryByCategory: Record<string, string[]>;
}) {
  const { addItem } = useStore();
  const [open, setOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { isSubmitting, errors },
  } = useForm();

  const category = watch("category");

  const subcategories = category ? subcategoryByCategory[category] || [] : [];

  async function onSubmit(data: any) {
    try {
      await addItem({
        ...data,
        pricePerDay: Number(data.pricePerDay),
        retailValue: Number(data.retailValue),
        quantity: Number(data.quantity || 1),
        status: "available",
      });
      toast.success("New piece added to inventory!");
      reset();
      setOpen(false);
    } catch (error) {
      console.error("Failed to add piece:", error);
      toast.error("Failed to add piece. Please try again.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Add a Piece</DialogTitle>
          <DialogDescription>
            Add a new garment or accessory to the inventory.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">Name</Label>
            <Input id="name" {...register("name", { required: true })} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="designer" className="text-right">Designer</Label>
            <Input id="designer" {...register("designer")} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="category" className="text-right">Category</Label>
            <Select onValueChange={(value) => { setValue("category", value); setSelectedCategory(value); }} >
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {subcategories.length > 0 && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="subcategory" className="text-right">Subcategory</Label>
              <Select onValueChange={(value) => setValue("subcategory", value)}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a subcategory" />
                </SelectTrigger>
                <SelectContent>
                  {subcategories.map((sub) => (
                    <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="size" className="text-right">Size</Label>
            <Select onValueChange={(value) => setValue("size", value)}>
              <SelectTrigger className="col-span-3">
                <SelectValue placeholder="Select a size" />
              </SelectTrigger>
              <SelectContent>
                {SIZES.map((size) => (
                  <SelectItem key={size} value={size}>{size}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="color" className="text-right">Color</Label>
            <Input id="color" {...register("color")} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="pricePerDay" className="text-right">Rent Price</Label>
            <Input id="pricePerDay" type="number" {...register("pricePerDay", { valueAsNumber: true })} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="retailValue" className="text-right">Retail Value</Label>
            <Input id="retailValue" type="number" {...register("retailValue", { valueAsNumber: true })} className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="quantity" className="text-right">Quantity</Label>
            <Input id="quantity" type="number" defaultValue={1} {...register("quantity", { valueAsNumber: true })} className="col-span-3" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting} className="bg-gold text-gold-foreground hover:bg-gold/90">
              {isSubmitting ? "Adding..." : "Add Piece"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}