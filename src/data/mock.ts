import item1 from "@/assets/item-1.jpg";
import item2 from "@/assets/item-2.jpg";
import item3 from "@/assets/item-3.jpg";
import item4 from "@/assets/item-4.jpg";
import item5 from "@/assets/item-5.jpg";
import item6 from "@/assets/item-6.jpg";

export type ItemStatus = "available" | "rented" | "cleaning" | "reserved";
export type RentalStatus = "active" | "upcoming" | "returned" | "overdue";

export interface Item {
  id: string;
  customId?: string;
  name: string;
  designer: string;
  category: string;
  subcategory: string;
  size: string;
  color: string;
  pricePerDay: number;
  retailValue: number;
  quantity?: number;
  status: ItemStatus;
  image: string;
  timesRented: number;
}

export interface Customer {
  id: string;
  name: string;
  email?: string;
  phone: string;
  secondaryPhone?: string;
  tier: "Standard" | "Gold" | "Platinum";
  totalSpent: number;
  rentals: number;
  joined: string;
}

export interface Rental {
  id: string;
  itemId: string;
  itemNo: string;
  billNo: string;
  address: string;
  customerId: string;
  deliveryDate: string;
  startDate: string;
  endDate: string;
  rate?: number;
  quantity?: number;
  lostQuantity?: number;

  // Additional payments for edits/final bills (used by EditRentalDialog)
  additionalPayment?: number;

  discount: number;
  remark: string;
  remarkCompleted?: boolean;
  remarkConfirmedBy?: string;
  adminReconfirmed?: boolean;
  adminReconfirmedBy?: string;
  adminReconfirmedAt?: string;
  advance: number;
  securityAmount: number;
  securityReturned?: boolean;
  signature?: string;
  returnedAt?: string;
  penalty?: number;
  total: number;
  status: RentalStatus;
}


export const items: Item[] = [
  {
    id: "VV-001",
    name: "Onyx Tuxedo Coat",
    designer: "Maison Noir",
    category: "Men",
    subcategory: "Blazers",
    size: "M",
    color: "Black",
    pricePerDay: 95,
    retailValue: 2400,
    status: "rented",
    image: item1,
    timesRented: 23,
  },
  {
    id: "VV-002",
    name: "Verdant Satin Coat",
    designer: "Atelier Lune",
    category: "Women",
    subcategory: "Gowns",
    size: "S",
    color: "Emerald",
    pricePerDay: 78,
    retailValue: 1800,
    status: "available",
    image: item2,
    timesRented: 14,
  },
  {
    id: "VV-003",
    name: "Ivoire Lace Gown",
    designer: "Céleste Couture",
    category: "Women",
    subcategory: "Gowns",
    size: "M",
    color: "Ivory",
    pricePerDay: 220,
    retailValue: 6200,
    status: "reserved",
    image: item3,
    timesRented: 8,
  },
  {
    id: "VV-004",
    name: "Bordeaux Velvet Blazer",
    designer: "Maison Noir",
    category: "Men",
    subcategory: "Blazers",
    size: "L",
    color: "Burgundy",
    pricePerDay: 65,
    retailValue: 1450,
    status: "available",
    image: item4,
    timesRented: 31,
  },
  {
    id: "VV-005",
    name: "Minuit Sequin Slip",
    designer: "Atelier Lune",
    category: "Women",
    subcategory: "Dresses",
    size: "S",
    color: "Midnight",
    pricePerDay: 110,
    retailValue: 2900,
    status: "cleaning",
    image: item5,
    timesRented: 19,
  },
  {
    id: "VV-006",
    name: "Champagne Sequin Gown",
    designer: "Céleste Couture",
    category: "Women",
    subcategory: "Gowns",
    size: "M",
    color: "Champagne",
    pricePerDay: 135,
    retailValue: 3400,
    status: "rented",
    image: item6,
    timesRented: 27,
  },
];

export const customers: Customer[] = [
  {
    id: "C-1041",
    name: "Eloise Marchand",
    email: "eloise.m@example.com",
    phone: "+33 6 21 44 80 12",
    tier: "Platinum",
    totalSpent: 8420,
    rentals: 14,
    joined: "2023-04-12",
  },
  {
    id: "C-1042",
    name: "Amara Okafor",
    email: "amara.o@example.com",
    phone: "+44 7700 900 213",
    tier: "Gold",
    totalSpent: 4310,
    rentals: 9,
    joined: "2023-09-03",
  },
  {
    id: "C-1043",
    name: "Sofia Ricci",
    email: "sofia.r@example.com",
    phone: "+39 333 4567 821",
    tier: "Gold",
    totalSpent: 3980,
    rentals: 7,
    joined: "2024-01-20",
  },
  {
    id: "C-1044",
    name: "Hana Watanabe",
    email: "hana.w@example.com",
    phone: "+81 90 1234 5678",
    tier: "Standard",
    totalSpent: 1240,
    rentals: 3,
    joined: "2024-06-05",
  },
  {
    id: "C-1045",
    name: "Isabella Cruz",
    email: "isabella.c@example.com",
    phone: "+34 612 345 678",
    tier: "Platinum",
    totalSpent: 11200,
    rentals: 18,
    joined: "2022-11-30",
  },
];

export const rentals: Rental[] = [
  {
    id: "R-2208",
    itemId: "VV-001",
    itemNo: "VV-001",
    billNo: "B-001",
    address: "12 Rue de la Mode, Paris",
    customerId: "C-1041",
    deliveryDate: "2026-04-14",
    startDate: "2026-04-14",
    endDate: "2026-04-19",
    discount: 0,
    remark: "Rush delivery",
    advance: 150,
    securityAmount: 500,
    total: 475,
    status: "active",
  },
  {
    id: "R-2209",
    itemId: "VV-006",
    itemNo: "VV-006",
    billNo: "B-002",
    address: "7 High Street, London",
    customerId: "C-1045",
    deliveryDate: "2026-04-12",
    startDate: "2026-04-12",
    endDate: "2026-04-17",
    discount: 50,
    remark: "Include garment bag",
    advance: 200,
    securityAmount: 700,
    total: 675,
    status: "active",
  },
  {
    id: "R-2210",
    itemId: "VV-003",
    itemNo: "VV-003",
    billNo: "B-003",
    address: "19 Via Roma, Milan",
    customerId: "C-1042",
    deliveryDate: "2026-04-22",
    startDate: "2026-04-22",
    endDate: "2026-04-26",
    discount: 0,
    remark: "Try-on appointment",
    advance: 180,
    securityAmount: 600,
    total: 880,
    status: "upcoming",
  },
  {
    id: "R-2211",
    itemId: "VV-005",
    itemNo: "VV-005",
    billNo: "B-004",
    address: "32 Galleria del Corso, Milan",
    customerId: "C-1043",
    deliveryDate: "2026-04-06",
    startDate: "2026-04-06",
    endDate: "2026-04-11",
    discount: 20,
    remark: "Dry clean before return",
    advance: 100,
    securityAmount: 400,
    total: 550,
    status: "returned",
  },
  {
    id: "R-2212",
    itemId: "VV-002",
    itemNo: "VV-002",
    billNo: "B-005",
    address: "48 Calle Real, Madrid",
    customerId: "C-1044",
    deliveryDate: "2026-04-08",
    startDate: "2026-04-08",
    endDate: "2026-04-13",
    discount: 0,
    remark: "Return in original packaging",
    advance: 120,
    securityAmount: 350,
    total: 390,
    status: "overdue",
  },
  {
    id: "R-2213",
    itemId: "VV-004",
    itemNo: "VV-004",
    billNo: "B-006",
    address: "14 Orchard Road, Singapore",
    customerId: "C-1041",
    deliveryDate: "2026-04-25",
    startDate: "2026-04-25",
    endDate: "2026-04-28",
    discount: 0,
    remark: "Call before delivery",
    advance: 90,
    securityAmount: 300,
    total: 195,
    status: "upcoming",
  },
];

export const revenueByMonth = [
  { month: "Nov", revenue: 18200 },
  { month: "Dec", revenue: 26400 },
  { month: "Jan", revenue: 21800 },
  { month: "Feb", revenue: 24100 },
  { month: "Mar", revenue: 29700 },
  { month: "Apr", revenue: 33450 },
];

export const categoryMix = [
  { name: "Eveningwear", value: 42 },
  { name: "Bridal", value: 18 },
  { name: "Tailoring", value: 22 },
  { name: "Outerwear", value: 18 },
];

export const getItem = (id: string) => items.find((i) => i.id === id);
export const getCustomer = (id: string) => customers.find((c) => c.id === id);
