import { useMemo, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { useStore } from "@/data/store";
import { formatCurrencyINR } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  ArrowUpRight,
  TrendingUp,
  Package,
  Users,
  Banknote,
  CalendarCheck,
  Clock,
} from "lucide-react";
import heroImg from "@/assets/hero-velvet.jpg";

const PIE_COLORS = ["var(--gold)", "var(--gold-2)", "var(--gold-3)", "var(--gold-4)"];

function formatDayLabel(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: "short" });
}

function isSafaItem(item: any) {
  const text = [item?.name, item?.category, item?.subcategory].filter(Boolean).join(" ").toLowerCase();
  return text.includes("safa");
}

function getDueAmount(rental: any, allRentals: any[] = []) {
  if (rental.billNo && allRentals.length > 0) {
    const relatedRentals = allRentals.filter((r) => r.billNo === rental.billNo);
    let aggTotal = 0;
    let aggAdvance = 0;
    for (const r of relatedRentals) {
      aggTotal += (Number(r.total) || 0) + (Number(r.securityAmount) || 0) + (Number(r.penalty) || 0) - (Number(r.discount) || 0);
      aggAdvance += Number(r.advance) || 0;
    }
    return Math.max(0, aggTotal - aggAdvance);
  }
  return Math.max(
    0,
    (Number(rental.total) || 0) +
      (Number(rental.securityAmount) || 0) +
      (Number(rental.penalty) || 0) -
      (Number(rental.discount) || 0) -
      (Number(rental.advance) || 0),
  );
}

// Custom lightweight navigation hook
const useNavigate = () => {
  return (options: { to: string }) => {
    window.history.pushState({}, '', options.to);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };
};



export default function DashboardPage() {

  const navigate = useNavigate();
  const role = typeof window !== 'undefined' ? localStorage.getItem("user_role") : null;

  useEffect(() => {
    if (!role) navigate({ to: "/login" });
    else if (role !== "admin") navigate({ to: "/availability" });
  }, [role]);

  if (role !== "admin") {
    return null;
  }

  const { items, customers, rentals, loading, getItem, getCustomer, setSearchQuery } = useStore();

  const todayStr = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const dashboardStats = useMemo(() => {
    let todayIncome = 0;
    let todayDue = 0;
    let todayRentalsCount = 0;
    let monthIncome = 0;
    let monthDue = 0;
    let monthRentalsCount = 0;

    const billGroups = new Map<string, { isToday: boolean; isThisMonth: boolean }>();

    rentals.forEach((r) => {
      const rDateObj = new Date(r.startDate || (r as any).createdAt || "");
      if (Number.isNaN(rDateObj.getTime())) return;

      const rDateStr = rDateObj.toISOString().slice(0, 10);
      const isToday = rDateStr === todayStr;
      const isThisMonth =
        rDateObj.getMonth() === currentMonth && rDateObj.getFullYear() === currentYear;

      const income = (r.advance as number) || 0;

      if (isToday) {
        todayIncome += income;
        todayRentalsCount++;
      }
      if (isThisMonth) {
        monthIncome += income;
        monthRentalsCount++;
      }

      if (r.billNo) {
        const group = billGroups.get(r.billNo) || { isToday: false, isThisMonth: false };
        if (isToday) group.isToday = true;
        if (isThisMonth) group.isThisMonth = true;
        billGroups.set(r.billNo, group);
      } else {
        const due = getDueAmount(r, []);
        if (isToday) todayDue += due;
        if (isThisMonth) monthDue += due;
      }
    });

    const uniqueBills = new Set<string>();
    rentals.forEach((r) => {
      if (r.billNo && !uniqueBills.has(r.billNo)) {
        uniqueBills.add(r.billNo);
        const due = getDueAmount(r, rentals);
        const group = billGroups.get(r.billNo);
        if (group?.isToday) todayDue += due;
        if (group?.isThisMonth) monthDue += due;
      }
    });

    const activeRentals = rentals.filter((r) => r.status === "active").length;
    const availableItems = items.filter((i) => i.status === "available").length;

    const returnsDueToday = rentals.filter(
      (r) => r.status === "active" && (r.endDate || "").slice(0, 10) === todayStr,
    ).length;
    const upcomingRentals = rentals.filter((r) => r.status === "upcoming").length;
    const itemsInCleaning = items.filter((i) => i.status === "cleaning").length;
    const safaItems = items.filter(isSafaItem);
    const safaItemIds = new Set(safaItems.map((item) => item.id));
    const safaStock = safaItems.reduce((sum, item) => sum + (Number((item as any).quantity) || 0), 0);
    const safaBooked = rentals
      .filter((r) => safaItemIds.has(r.itemId) && (r.status === "active" || r.status === "upcoming" || r.status === "overdue"))
      .reduce((sum, rental) => sum + (Number((rental as any).quantity) || 1), 0);
    const safaLost = rentals
      .filter((r) => safaItemIds.has(r.itemId))
      .reduce((sum, rental) => sum + (Number((rental as any).lostQuantity) || 0), 0);
    const safaAvailable = Math.max(0, safaStock - safaBooked);

    const stats = [
      {
        label: "Today's Bookings",
        value: `${todayRentalsCount}`,
        helper: "Rentals starting today",
        icon: CalendarCheck,
        to: "/rentals",
        search: todayStr,
      },
      {
        label: "Today's Income",
        value: formatCurrencyINR(todayIncome),
        helper: "Collected today (excl. security)",
        icon: Banknote,
        to: "/reports",
        search: todayStr,
      },
      {
        label: "Today's Due",
        value: formatCurrencyINR(todayDue),
        helper: "Pending from today's bookings",
        icon: Clock,
        to: "/due-products",
        search: todayStr,
      },
      {
        label: "Monthly Bookings",
        value: `${monthRentalsCount}`,
        helper: "Rentals starting this month",
        icon: CalendarCheck,
        to: "/rentals",
        search: `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`,
      },
      {
        label: "Monthly Income",
        value: formatCurrencyINR(monthIncome),
        helper: "Collected this month",
        icon: Banknote,
        to: "/reports",
        search: `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`,
      },
      {
        label: "Monthly Due",
        value: formatCurrencyINR(monthDue),
        helper: "Pending this month",
        icon: Clock,
        to: "/due-products",
        search: `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`,
      },
      {
        label: "Live Rentals",
        value: `${activeRentals}`,
        helper: `${rentals.filter((r) => r.status === "upcoming").length} upcoming`,
        icon: Package,
        to: "/rentals",
        search: "active",
      },
      {
        label: "Overdue Items",
        value: `${rentals.filter((r) => r.status === "overdue").length}`,
        helper: "Needs immediate action",
        icon: CalendarCheck,
        to: "/return-items",
        search: "overdue",
      },
      {
        label: "Clientele",
        value: `${customers.length}`,
        helper: `${customers.filter((c) => c.tier === "Platinum").length} platinum members`,
        icon: Users,
        to: "/customers",
        search: "",
      },
      {
        label: "Available Pieces",
        value: `${availableItems}`,
        helper: `${items.length} total garments`,
        icon: TrendingUp,
        to: "/inventory",
        search: "available",
      },
      {
        label: "Safa Stock",
        value: `${safaAvailable}/${safaStock}`,
        helper: `${safaBooked} booked, ${safaLost} lost`,
        icon: Package,
        to: "/inventory",
        search: "safa",
      },
      {
        label: "Safa Booked",
        value: `${safaBooked}`,
        helper: "Active, upcoming, overdue",
        icon: CalendarCheck,
        to: "/rentals",
        search: "safa",
      },
    ];

    const revenueByDay = (() => {
      const grouped: Record<string, { date: Date; revenue: number }> = {};
      rentals.forEach((rental) => {
        const date = new Date(rental.startDate || rental.createdAt || "");
        if (Number.isNaN(date.getTime())) return;
        if (date.getMonth() !== currentMonth || date.getFullYear() !== currentYear) return;
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
          date.getDate(),
        ).padStart(2, "0")}`;
        grouped[key] = grouped[key] || { date, revenue: 0 };
        grouped[key].revenue += (rental.advance as number) ?? 0;
      });
      return Object.values(grouped)
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .map((entry) => ({
          day: formatDayLabel(entry.date),
          revenue: entry.revenue,
        }));
    })();

    const categoryMix = (() => {
      const counts = items.reduce<Record<string, number>>((acc, item) => {
        const key = item.category || "Uncategorized";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      return Object.entries(counts).map(([name, value]) => ({
        name,
        value: Math.round((value / Math.max(items.length, 1)) * 100),
      }));
    })();

    const recent = [...rentals]
      .sort((a, b) => {
        const aDate = new Date(a.startDate || (a as any).createdAt || "");
        const bDate = new Date(b.startDate || (b as any).createdAt || "");
        return bDate.getTime() - aDate.getTime();
      })
      .slice(0, 5);

    const heroPiece = [...items].sort((a, b) => b.timesRented - a.timesRented)[0];

    return {
      stats,
      revenueByDay,
      categoryMix,
      recent,
      heroPiece,
      returnsDueToday,
      upcomingRentals,
      itemsInCleaning,
      safaStock,
      safaBooked,
      safaLost,
      safaAvailable,
    };
  }, [customers, currentMonth, currentYear, items, rentals, todayStr]);

  function openDashboardData(to: string, search = "") {
    setSearchQuery(search);
    navigate({ to });
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-100 items-center justify-center text-muted-foreground">
          Loading dashboard data...
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="glass-panel mb-8 overflow-hidden rounded-xl sm:mb-10">
        <div className="grid min-h-120 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="relative z-10 flex flex-col justify-between px-5 py-7 sm:px-8 sm:py-10 lg:px-12">
            <div>
              <p className="eyebrow">Spring Atelier 2026</p>
              <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[0.95] text-foreground sm:text-6xl lg:text-7xl">
                Rental couture, handled with ceremony.
              </h1>
              <p className="mt-5 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                A polished view of your pieces, bookings, client tiers, returns, and revenue.
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Returns", `${dashboardStats.returnsDueToday} due today`, "/return-items", todayStr],
                ["Upcoming", `${dashboardStats.upcomingRentals} bookings`, "/rentals", "upcoming"],
                ["Garment Care", `${dashboardStats.itemsInCleaning} in cleaning`, "/inventory", "cleaning"],
                ["Safa", `${dashboardStats.safaAvailable}/${dashboardStats.safaStock} available`, "/inventory", "safa"],
              ].map(([label, value, to, search]) => (
                <button
                  type="button"
                  key={label}
                  onClick={() => openDashboardData(to, search)}
                  className="rounded-md border border-border bg-background/35 p-4 text-left transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                >
                  <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                    {label}
                  </p>
                  <p className="mt-2 font-display text-2xl">{value}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="relative min-h-80">
            <img
              src={heroImg}
              alt="Velvet evening gown in atelier"
              width={1280}
              height={800}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-linear-to-t from-background via-background/20 to-transparent lg:bg-linear-to-r lg:from-background/85 lg:via-background/20 lg:to-transparent" />
            {dashboardStats.heroPiece && (
              <button
                type="button"
                onClick={() => openDashboardData("/inventory", dashboardStats.heroPiece.id)}
                className="absolute bottom-5 left-5 right-5 rounded-md border border-border bg-background/65 p-4 text-left backdrop-blur-md transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold lg:left-auto lg:w-72"
              >
                <p className="eyebrow">Most Requested</p>
                <p className="mt-2 font-display text-2xl truncate">
                  {dashboardStats.heroPiece.id} - {dashboardStats.heroPiece.name}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {dashboardStats.heroPiece.designer} - {dashboardStats.heroPiece.timesRented} rentals
                </p>
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="mb-8 grid grid-cols-2 gap-3 sm:mb-10 sm:gap-5 lg:grid-cols-5">
        {dashboardStats.stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card
              key={s.label}
              role="button"
              tabIndex={0}
              onClick={() => openDashboardData(s.to, s.search)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openDashboardData(s.to, s.search);
                }
              }}
              className="glass-panel cursor-pointer transition-colors hover:bg-secondary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
            >
              <CardContent className="p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                    {s.label}
                  </span>
                  <Icon className="h-4 w-4 shrink-0 text-gold" />
                </div>
                <div className="font-display text-3xl leading-none">{s.value}</div>
                <div className="mt-3 flex items-center text-xs text-emerald">
                  <ArrowUpRight className="mr-1 h-3 w-3" /> {s.helper}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="mb-8 grid gap-4 sm:mb-10 sm:gap-6 lg:grid-cols-3">
        <Card
          role="button"
          tabIndex={0}
          onClick={() => openDashboardData("/reports", "")}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openDashboardData("/reports", "");
            }
          }}
          className="glass-panel min-w-0 cursor-pointer transition-colors hover:bg-secondary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold lg:col-span-2"
        >
          <CardHeader>
            <CardTitle className="font-display text-2xl">Income Trajectory</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={dashboardStats.revenueByDay}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="revenueGold" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--gold)" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="var(--gold)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  vertical={false}
                />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--gold)"
                  strokeWidth={2}
                  fill="url(#revenueGold)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card
          role="button"
          tabIndex={0}
          onClick={() => openDashboardData("/inventory", "")}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openDashboardData("/inventory", "");
            }
          }}
          className="glass-panel min-w-0 cursor-pointer transition-colors hover:bg-secondary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
        >
          <CardHeader>
            <CardTitle className="font-display text-2xl">Category Mix</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="72%">
              <PieChart>
                <Pie
                  data={dashboardStats.categoryMix}
                  dataKey="value"
                  innerRadius={55}
                  outerRadius={88}
                  paddingAngle={3}
                  stroke="var(--background)"
                  strokeWidth={2}
                >
                  {dashboardStats.categoryMix.map((c, i) => (
                    <Cell
                      key={c.name}
                      fill={PIE_COLORS[i % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {dashboardStats.categoryMix.map((c, i) => (
                <div key={c.name} className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  <span className="truncate text-muted-foreground">{c.name}</span>
                  <span className="ml-auto text-foreground">{c.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <Card className="glass-panel min-w-0 lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display text-2xl">Recent Rentals</CardTitle>
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
              <CalendarCheck className="h-3.5 w-3.5 text-gold" /> Live ledger
            </span>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {dashboardStats.recent.map((r) => {
                const item = getItem(r.itemId);
                const customer = getCustomer(r.customerId);
                if (!item || !customer) return null;
                return (
                  <div
                    key={r.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openDashboardData("/rentals", r.billNo || r.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openDashboardData("/rentals", r.billNo || r.id);
                      }
                    }}
                    className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold sm:gap-4 sm:px-6 sm:py-4"
                  >
                    <img
                      src={item.image}
                      alt={item.name}
                      width={56}
                      height={72}
                      loading="lazy"
                      className="h-16 w-12 rounded-sm border border-border object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-lg">
                        {item.id} - {item.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {customer.name} - {r.startDate} to {r.endDate}
                      </p>
                    </div>
                    <div className="hidden text-right sm:block">
                      <p className="text-sm">{formatCurrencyINR(r.total)}</p>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        {r.id}
                      </p>
                    </div>
                    <StatusBadge status={r.status} kind="rental" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="font-display text-2xl">Top Pieces</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[...items]
              .sort((a, b) => b.timesRented - a.timesRented)
              .slice(0, 4)
              .map((item, index) => (

                <button
                  key={item.id}
                  type="button"
                  onClick={() => openDashboardData("/inventory", item.id)}
                  className="flex w-full items-center gap-3 rounded-md text-left transition-colors hover:bg-secondary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                >
                  <span className="w-7 font-display text-3xl text-gold">{index + 1}</span>
                  <img
                    src={item.image}
                    alt={item.name}
                    width={44}
                    height={58}
                    loading="lazy"
                    className="h-14 w-11 rounded-sm border border-border object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      {item.id} - {item.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.timesRented} rentals - Size {item.size}
                    </p>
                  </div>
                </button>
              ))}
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
