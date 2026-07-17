import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  itemsApi,
  customersApi,
  rentalsApi,
  type Item,
  type Customer,
  type Rental,
} from "@/lib/api";

// Fallback image for items without image
const FALLBACK_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 400'><rect width='300' height='400' fill='%23eee'/><text x='150' y='200' text-anchor='middle' font-family='serif' font-size='28' fill='%23999'>Velvet Vault</text></svg>`,
  );

interface StoreState {
  items: Item[];
  customers: Customer[];
  rentals: Rental[];
  loading: boolean;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  addItem: (item: Omit<Item, "_id" | "id" | "customId" | "timesRented" | "createdAt" | "updatedAt">) => Promise<Item>;
  uploadExcel: (file: File) => Promise<{ message: string; items: { id: string; name: string }[]; errors?: string[] }>;
  deleteItem: (id: string) => Promise<void>;
  addCustomer: (
    customer: Omit<Customer, "_id" | "id" | "customId" | "totalSpent" | "rentals" | "joined" | "createdAt" | "updatedAt">,
  ) => Promise<Customer>;
  addRental: (rental: Omit<Rental, "_id" | "id" | "customId" | "createdAt" | "updatedAt">) => Promise<Rental>;
  deleteCustomer: (id: string) => Promise<void>;
  deleteRental: (id: string, billNo?: string) => Promise<void>;
  updateRental: (id: string, data: Partial<Rental>) => Promise<Rental>;
  updateItem: (id: string, data: Partial<Item>) => Promise<Item>;
  getItem: (id: string) => Item | undefined;
  getCustomer: (id: string) => Customer | undefined;
  refreshData: () => Promise<void>;
}


const StoreContext = createContext<StoreState | null>(null);

// Transform backend data to match frontend interface
function transformItem(item: any): Item {
  return {
    ...item,
    id: item.customId,
    image: item.image || FALLBACK_IMG,
    quantity: Number(item.quantity) || 1,
  };
}

function transformCustomer(customer: any): Customer {
  return {
    ...customer,
    id: customer.customId,
  };
}

function formatDateTime(value: string | Date | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString();
}

function transformRental(rental: any): Rental {
  const itemId =
    rental.itemId ||
    rental.item?.customId ||
    (typeof rental.item === "string" ? rental.item : "");
  const customerId =
    rental.customerId ||
    rental.customer?.customId ||
    (typeof rental.customer === "string" ? rental.customer : "");

  return {
    ...rental,
    id: rental.customId,
    itemId,
    customerId,
    payments: Array.isArray(rental.payments)
      ? rental.payments.map((p: any) => ({
          amount: Number(p.amount) || 0,
          date: formatDateTime(p.date),
        }))
      : [],
    rate: Number(rental.rate) || Number(rental.total) + Number(rental.discount || 0) || 0,
    quantity: Number(rental.quantity) || 1,
    lostQuantity: Number(rental.lostQuantity) || 0,
    startDate: formatDateTime(rental.startDate),
    endDate: formatDateTime(rental.endDate),
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const refreshData = async () => {
    console.info("[store] refreshData started");
    try {
      console.info("[store] fetching items, customers, and rentals");
      const [itemsData, customersData, rentalsData] = await Promise.all([
        itemsApi.getAll(),
        customersApi.getAll(),
        rentalsApi.getAll(),
      ]);
      console.info("[store] fetch complete", {
        items: itemsData.length,
        customers: customersData.length,
        rentals: rentalsData.length,
      });
      setItems(itemsData.map(transformItem));
      setCustomers(customersData.map(transformCustomer));
      setRentals(rentalsData.map(transformRental));
      console.info("[store] state updated from backend data");
    } catch (error) {
      console.error('[store] Failed to fetch data:', error);
    } finally {
      setLoading(false);
      console.info("[store] loading=false");
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  const value = useMemo<StoreState>(
    () => ({

      items,
      customers,
      rentals,
      loading,
      searchQuery,
      setSearchQuery: (query) => {
        console.info("[store] searchQuery updated", { query });
        setSearchQuery(query);
      },
      addItem: async (data) => {
        console.info("[store] addItem started", {
          name: data.name,
          category: data.category,
          hasImage: Boolean(data.image),
          imageLength: data.image?.length ?? 0,
        });
        const newItem = await itemsApi.create(data);
        console.info("[store] addItem backend response", newItem);
        const transformed = transformItem(newItem);
        setItems((prev) => [transformed, ...prev]);
        console.info("[store] addItem state updated", transformed);
        return transformed;
      },
      uploadExcel: async (file) => {
        console.info("[store] uploadExcel started", { fileName: file.name, fileSize: file.size });
        const result = await itemsApi.uploadExcel(file);
        console.info("[store] uploadExcel backend response", result);
        // Refresh items after upload
        await refreshData();
        console.info("[store] uploadExcel data refreshed");
        return result;
      },
      deleteItem: async (id) => {
        console.info("[store] deleteItem started", { id });
        await itemsApi.delete(id);
        console.info("[store] deleteItem backend success", { id });
        setItems((prev) => prev.filter((item) => item.id !== id));
        setRentals((prev) => prev.filter((rental) => rental.itemId !== id));
        console.info("[store] deleteItem state updated", { id });
      },
      deleteCustomer: async (id) => {
        console.info("[store] deleteCustomer started", { id });
        await customersApi.delete(id);
        console.info("[store] deleteCustomer backend success", { id });
        setCustomers((prev) => prev.filter((customer) => customer.id !== id));
        // Local removal already reflects the delete; reconcile any secondary
        // effects (e.g. related aggregates) in the background instead of making
        // the caller wait on a full items+customers+rentals refetch.
        refreshData().catch((err) => console.error("[store] background refresh after deleteCustomer failed", err));
        console.info("[store] deleteCustomer local state updated; background refresh queued", { id });
      },
      addCustomer: async (data) => {
        console.info("[store] addCustomer started", data);
        const newCustomer = await customersApi.create(data);
        console.info("[store] addCustomer backend response", newCustomer);
        const transformed = transformCustomer(newCustomer);
        setCustomers((prev) => [transformed, ...prev]);
        console.info("[store] addCustomer state updated", transformed);
        return transformed;
      },
      addRental: async (data) => {
        console.info("[store] addRental started", data);
        const newRental = await rentalsApi.create(data);
        console.info("[store] addRental backend response", newRental);
        const transformed = transformRental(newRental);
        // The backend only returns the FIRST piece of a multi-item bill as a
        // representative - sibling pieces and updated item stock aren't in this
        // response, so a full refresh is still needed for correctness. Show the
        // representative immediately and reconcile the rest (siblings, item
        // status) in the background instead of making the caller wait on a full
        // items+customers+rentals refetch before the dialog can close.
        setRentals((prev) => [transformed, ...prev]);
        refreshData().catch((err) => console.error("[store] background refresh after addRental failed", err));
        console.info("[store] addRental optimistic state updated; background refresh queued", transformed);
        return transformed;
      },
      deleteRental: async (id, billNo) => {
        console.info("[store] deleteRental started", { id, billNo });
        await rentalsApi.delete(id, billNo);
        console.info("[store] deleteRental backend success", { id, billNo });
        // Best-effort local cleanup: remove matching bill if present, else remove single rental.
        if (billNo) {
          setRentals((prev) => prev.filter((rental) => rental.billNo !== billNo));
        } else {
          setRentals((prev) => prev.filter((rental) => rental.id !== id));
        }
        // Deleting a rental also frees up item stock and adjusts customer totals on
        // the backend; reconcile those in the background so the delete itself
        // resolves instantly instead of blocking on a full refetch.
        refreshData().catch((err) => console.error("[store] background refresh after deleteRental failed", err));
        console.info("[store] deleteRental local state updated; background refresh queued", { id, billNo });
      },
      updateItem: async (id, data) => {
        console.info("[store] updateItem started", { id, dataKeys: Object.keys(data || {}) });
        const updated = await itemsApi.update(id, data);
        console.info("[store] updateItem backend response", updated);
        const transformed = transformItem(updated);
        setItems((prev) => prev.map((i) => (i.id === transformed.id ? transformed : i)));
        return transformed;
      },
      updateRental: async (id, data) => {
        console.info("[store] updateRental started", { id, dataKeys: Object.keys(data || {}) });
        const updated = await rentalsApi.update(id, data);
        console.info("[store] updateRental backend response", updated);
        const transformed = transformRental(updated);
        setRentals((prev) => {
          const idx = prev.findIndex((r) => r.id === transformed.id);
          if (idx === -1) return [transformed, ...prev];
          const next = prev.slice();
          next[idx] = transformed;
          return next;
        });
        // The backend returns the rental with its item populated - use it to keep
        // item availability status in sync without a separate items refetch.
        const rawItem = (updated as any)?.item;
        if (rawItem && typeof rawItem === "object" && rawItem.customId) {
          const transformedItem = transformItem(rawItem);
          setItems((prev) => prev.map((i) => (i.id === transformedItem.id ? transformedItem : i)));
        }
        return transformed;
      },
      getItem: (id) => items.find((i) => i.id === id),
      getCustomer: (id) => customers.find((c) => c.id === id),
      refreshData,
    }),
    [items, customers, rentals, loading, searchQuery],
  );

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}
