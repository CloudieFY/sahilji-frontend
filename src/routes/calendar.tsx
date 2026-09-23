import { useEffect, useState, useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { useStore } from "@/data/store";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatCurrencyINR } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Download, Eye, FileSpreadsheet } from "lucide-react";
import { ViewInvoiceDialog } from "@/components/forms/ViewInvoiceDialog";
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const parts = dateStr.split("T")[0].split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function today() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

// Custom lightweight navigation hook
const useNavigate = () => {
  return (options: { to: string }) => {
    window.history.pushState({}, '', options.to);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };
};

export default function CalendarPage() {
  const navigate = useNavigate();
  const { rentals, getItem, getCustomer, searchQuery, updateRental, updateItem } = useStore();
  const [role, setRole] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [viewBookingsOpen, setViewBookingsOpen] = useState(false);
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    now.setDate(1);
    now.setHours(0, 0, 0, 0);
    return now;
  });

  const handleStartDateChange = (val: string) => {
    setStartDateFilter(val);
    if (val) {
      const [y, m] = val.split("-").map(Number);
      if (y && m) {
        setCurrentDate(new Date(y, m - 1, 1));
      }
    }
  };

  const handleEndDateChange = (val: string) => {
    setEndDateFilter(val);
  };

  const todayStr = today();
  const YEAR = currentDate.getFullYear();
  const MONTH = currentDate.getMonth();
  const MONTH_NAME = currentDate.toLocaleString("default", { month: "long", year: "numeric" });

  const query = searchQuery.trim().toLowerCase();
  const filteredRentals = rentals.filter((r) => {
    const item = getItem(r.itemId);
    const customer = getCustomer(r.customerId);
    const targetDateStr = (r.deliveryDate || r.startDate || "").slice(0, 10);

    if (startDateFilter && targetDateStr < startDateFilter) return false;
    if (endDateFilter && targetDateStr > endDateFilter) return false;

    const searchable = [
      r.id,
      r.billNo,
      r.itemNo,
      r.status,
      r.startDate,
      r.endDate,
      item?.name,
      item?.designer,
      item?.category,
      customer?.name,
      customer?.email,
      customer?.phone,
      customer?.tier,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return !query || searchable.includes(query);
  });
  // build a 5-week grid for April 2026
  const firstDay = new Date(YEAR, MONTH, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // Mon-start
  const daysInMonth = new Date(YEAR, MONTH + 1, 0).getDate();
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

  const cells: ({ day: number; date: string } | null)[] = [];
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startOffset + 1;
    if (dayNum < 1 || dayNum > daysInMonth) {
      cells.push(null);
    } else {
      const date = `${YEAR}-${String(MONTH + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      cells.push({ day: dayNum, date });
    }
  }

  const eventsByDate: Record<string, typeof rentals> = {};
  filteredRentals.forEach((r) => {
    const targetDateStr = (r.deliveryDate || r.startDate || "").slice(0, 10);
    if (!targetDateStr) return;

    const [y, m, d] = targetDateStr.split("-").map(Number);
    if (!y || !m || !d) return;

    const key = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    eventsByDate[key] ??= [];
    eventsByDate[key].push(r);
  });



  const displayMonths = useMemo(() => {
    if (startDateFilter && endDateFilter) {
      const s = new Date(startDateFilter);
      const e = new Date(endDateFilter);
      if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && s <= e) {
        const list = [];
        const cur = new Date(s.getFullYear(), s.getMonth(), 1);
        const endLimit = new Date(e.getFullYear(), e.getMonth(), 1);
        let count = 0;
        while (cur <= endLimit && count < 12) {
          const y = cur.getFullYear();
          const m = cur.getMonth();
          const label = cur.toLocaleString("default", { month: "long", year: "numeric" });
          list.push({ year: y, month: m, label });
          cur.setMonth(cur.getMonth() + 1);
          count++;
        }
        if (list.length > 0) return list;
      }
    }
    const y = currentDate.getFullYear();
    const m = currentDate.getMonth();
    const label = currentDate.toLocaleString("default", { month: "long", year: "numeric" });
    return [{ year: y, month: m, label }];
  }, [startDateFilter, endDateFilter, currentDate]);

  const getMonthCells = (year: number, month: number) => {
    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7; // Mon-start
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

    const cells: ({ day: number; date: string } | null)[] = [];
    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - startOffset + 1;
      if (dayNum < 1 || dayNum > daysInMonth) {
        cells.push(null);
      } else {
        const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
        cells.push({ day: dayNum, date });
      }
    }
    return cells;
  };

  const getMonthEventsCount = (year: number, month: number) => {
    return filteredRentals.filter((r) => {
      const targetDateStr = (r.deliveryDate || r.startDate || "").slice(0, 10);
      if (!targetDateStr) return false;
      const [y, m] = targetDateStr.split("-").map(Number);
      return y === year && m - 1 === month;
    }).length;
  };

  const handlePrevMonth = () => setCurrentDate(new Date(YEAR, MONTH - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(YEAR, MONTH + 1, 1));
  const handleToday = () => {
    const now = new Date();
    setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const upcoming = filteredRentals
    .filter((r) => r.status === "upcoming" || r.status === "active")
    .slice(0, 4);

  // For mobile list view: dates with events, sorted ascending
  const datesWithEvents = Object.entries(eventsByDate)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, evs]) => ({ date, events: evs }));

  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] || []) : [];

  useEffect(() => {
    const savedRole = localStorage.getItem("user_role")?.trim().toLowerCase();
    if (!savedRole) {
      navigate({ to: "/login" });
    }
    setRole(savedRole || "");
  }, []);

  useEffect(() => {
    console.info("[calendar] data loaded", {
      rentals: rentals.length,
      filteredRentals: filteredRentals.length,
      month: MONTH_NAME,
      searchQuery,
      readyRentals: rentals.filter((r) => (r as any).remarkCompleted).length,
    });
  }, [rentals, filteredRentals.length, MONTH_NAME, searchQuery]);

  useEffect(() => {
    if (!selectedDate) return;
    console.info("[calendar] selected date events", {
      selectedDate,
      events: selectedEvents.map((event) => ({
        id: event.id,
        billNo: event.billNo,
        itemId: event.itemId,
        customerId: event.customerId,
        status: event.status,
        remarkCompleted: (event as any).remarkCompleted,
        remarkConfirmedBy: (event as any).remarkConfirmedBy,
      })),
    });
  }, [selectedDate, rentals]);

  const handleSelectDate = (date: string, eventsCount: number) => {
    console.info("[calendar] date selected", { date, eventsCount });
    setSelectedDate(date);
  };

  const handleMarkReady = (rentalId: string, currentName: string) => {
    console.info("[calendar] mark ready prompt opened", { rentalId, currentName });
    const name = window.prompt("Enter your name to confirm product is ready for delivery:", currentName);
    const trimmedName = name?.trim();

    if (!trimmedName) {
      console.info("[calendar] mark ready cancelled", { rentalId });
      return;
    }

    console.info("[calendar] mark ready request started", {
      rentalId,
      remarkConfirmedBy: trimmedName,
    });

    updateRental(rentalId, { remarkCompleted: true, remarkConfirmedBy: trimmedName } as any)
      .then((updatedRental) => {
        console.info("[calendar] mark ready request succeeded", {
          rentalId,
          updatedRental,
        });
        toast.success("Marked as ready!");
      })
      .catch((error) => {
        console.error("[calendar] mark ready request failed", {
          rentalId,
          error,
        });
        toast.error("Failed to update");
      });
  };

  const handleMarkDryclean = (rentalId: string, currentName: string) => {
    console.info("[calendar] mark dryclean prompt opened", { rentalId, currentName });
    const name = window.prompt("Enter your name to confirm dryclean is complete:", currentName);
    const trimmedName = name?.trim();

    if (!trimmedName) {
      console.info("[calendar] mark dryclean cancelled", { rentalId });
      return;
    }

    console.info("[calendar] mark dryclean request started", {
      rentalId,
      drycleanCompletedBy: trimmedName,
    });

    updateRental(rentalId, { drycleanCompleted: true, drycleanCompletedBy: trimmedName } as any)
      .then((updatedRental) => {
        console.info("[calendar] mark dryclean request succeeded", { rentalId, updatedRental });
        toast.success("Marked dryclean complete");
      })
      .catch((error) => {
        console.error("[calendar] mark dryclean failed", { rentalId, error });
        toast.error("Failed to update");
      });
  };

  const handleAdminConfirmDryclean = (rentalId: string, currentName: string) => {
    console.info("[calendar] admin confirm dryclean prompt opened", { rentalId, currentName });
    const name = window.prompt("Enter your name to confirm dryclean and make item available:", currentName);
    const trimmedName = name?.trim();

    if (!trimmedName) {
      console.info("[calendar] admin confirm dryclean cancelled", { rentalId });
      return;
    }

    updateRental(rentalId, {
      drycleanAdminConfirmed: true,
      drycleanAdminConfirmedBy: trimmedName,
      drycleanAdminConfirmedAt: new Date().toISOString(),
    } as any)
      .then(async (updatedRental) => {
        console.info("[calendar] admin confirm dryclean succeeded", { rentalId, updatedRental });
        try {
          const itemObj = (updatedRental as any).item;
          const itemId = itemObj?.customId || itemObj?.id || (updatedRental as any).itemId;
          if (itemId) {
            await updateItem(itemId, { status: 'available' });
            toast.success('Dryclean confirmed and item marked ready for rent!');
          } else {
            toast.success('Dryclean confirmed!');
          }
        } catch (err) {
          console.error('[calendar] failed to mark item available after dryclean confirm', err);
          toast.success('Dryclean confirmed (failed to update item status)');
        }
      })
      .catch((error) => {
        console.error('[calendar] admin confirm dryclean failed', { rentalId, error });
        toast.error('Failed to confirm dryclean');
      });
  };

  const handleAdminReconfirm = (rentalId: string, currentName: string) => {
    console.info("[calendar] admin reconfirm prompt opened", { rentalId, currentName });
    const name = window.prompt("Enter your name to reconfirm this product is ready:", currentName);
    const trimmedName = name?.trim();

    if (!trimmedName) {
      console.info("[calendar] admin reconfirm cancelled", { rentalId });
      return;
    }

    updateRental(rentalId, {
      adminReconfirmed: true,
      adminReconfirmedBy: trimmedName,
      adminReconfirmedAt: new Date().toISOString(),
    } as any)
      .then(async (updatedRental) => {
        console.info("[calendar] admin reconfirm succeeded", {
          rentalId,
          updatedRental,
        });

        // After admin reconfirmation, mark the underlying item as available (ready for rent).
        try {
          const itemObj = (updatedRental as any).item;
          const itemId = itemObj?.customId || itemObj?.id || (updatedRental as any).itemId;
          if (itemId) {
            await updateItem(itemId, { status: 'available' });
            toast.success("Admin reconfirmed and item marked ready for rent!");
          } else {
            toast.success("Admin reconfirmed product is ready!");
          }
        } catch (err) {
          console.error('[calendar] failed to mark item available after admin reconfirm', err);
          toast.success("Admin reconfirmed product is ready! (failed to update item status)");
        }
      })
      .catch((error) => {
        console.error("[calendar] admin reconfirm failed", {
          rentalId,
          error,
        });
        toast.error("Failed to reconfirm");
      });
  };

  const handleExportExcel = (
    rentalsToExport = selectedDate ? selectedEvents : filteredRentals,
    fileName = "Bookings"
  ) => {
    if (!rentalsToExport || rentalsToExport.length === 0) {
      toast.error("No bookings to export");
      return;
    }
    const exportData = rentalsToExport.map((e) => {
      const item = getItem(e.itemId);
      const customer = getCustomer(e.customerId);
      return {
        "Bill No": e.billNo || e.id,
        Client: customer?.name || "Unknown",
        Phone: customer?.phone || "-",
        "Item No": e.itemNo || e.itemId,
        "Piece / Item": item?.name || "Unknown",
        Size: item?.size || "-",
        Color: item?.color || "-",
        "Start Date": formatDate(e.startDate),
        "End Date": formatDate(e.endDate),
        "Delivery Date": formatDate(e.deliveryDate || e.startDate),
        Delivery: (e as any).deliveryTimePeriod || "Afternoon",
        Status: e.status,
        Remark: e.remark || "-",
        "Dryclean Done": (e as any).drycleanCompleted ? "Yes" : "No",
        "Fitting Ready": (e as any).remarkCompleted ? "Yes" : "No",
        "Ready Confirmed": (e as any).adminReconfirmed ? "Yes" : "No",
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Bookings");
    const safeName = fileName.replace(/[^a-zA-Z0-9_-]/g, "_");
    XLSX.writeFile(workbook, `${safeName}.xlsx`);
    toast.success("Excel file downloaded!");
  };

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-gold">Diary</p>
          <h1 className="mt-1 font-display text-3xl sm:text-4xl">{MONTH_NAME}</h1>
        </div>

        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="icon" className="h-9 w-9 bg-card" onClick={handlePrevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-9 px-3 text-xs bg-card" onClick={handleToday}>
            Today
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9 bg-card" onClick={handleNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filter Toolbar matching Screenshot 1 & 2 */}
      <div className="bg-card/95 border border-border/80 rounded-2xl p-3 sm:px-4 sm:py-3.5 mb-6 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-4 text-xs">
          <span className="font-medium text-foreground flex items-center gap-1.5 text-xs">
            📅 Filter Bookings by Date:
          </span>

          <div className="flex items-center gap-2 bg-background border border-border/80 rounded-xl px-3 py-1.5 shadow-2xs">
            <span className="text-muted-foreground font-medium text-xs">Start:</span>
            <input
              type="date"
              value={startDateFilter}
              onChange={(e) => handleStartDateChange(e.target.value)}
              className="bg-transparent text-xs font-medium text-foreground focus:outline-none cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-2 bg-background border border-border/80 rounded-xl px-3 py-1.5 shadow-2xs">
            <span className="text-muted-foreground font-medium text-xs">End:</span>
            <input
              type="date"
              value={endDateFilter}
              onChange={(e) => handleEndDateChange(e.target.value)}
              className="bg-transparent text-xs font-medium text-foreground focus:outline-none cursor-pointer"
            />
          </div>

          {(startDateFilter || endDateFilter) && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-muted-foreground hover:text-foreground px-2.5 rounded-lg"
              onClick={() => {
                setStartDateFilter("");
                setEndDateFilter("");
              }}
            >
              ✕ Clear
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2.5 self-end md:self-auto">
          <span className="bg-[#FFE5D9] text-[#DF301C] border border-[#FCD0C2] rounded-full px-3.5 py-1 font-semibold text-xs whitespace-nowrap">
            {filteredRentals.length} Bookings
          </span>
          <button
            type="button"
            onClick={() => setViewBookingsOpen(true)}
            className="bg-[#DF301C] hover:bg-[#B82210] text-white rounded-xl px-4 py-2 text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap"
          >
            <Eye className="w-4 h-4" />
            View Bookings ({filteredRentals.length})
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4 sm:gap-6">
        {/* Mobile: chronological day list */}
        <Card className="glass-panel p-0 overflow-hidden md:hidden">
          <div className="divide-y divide-border">
            {datesWithEvents.length === 0 && (
              <div className="px-4 py-6 text-sm text-muted-foreground">
                No calendar bookings match your search.
              </div>
            )}
            {datesWithEvents.map(({ date, events }) => {
              const [y, m, day] = date.split("-").map(Number);
              // Zeller-like: compute day-of-week without Date() to keep SSR + client identical
              const dow = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
              const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
              const dayName = DAY_NAMES[dow];
              const dayNum = day;
              return (
                <div 
                  key={date} 
                  className="flex gap-4 px-4 py-4 cursor-pointer hover:bg-secondary/20 transition-colors"
                  onClick={() => handleSelectDate(date, events.length)}
                >
                  <div className="text-center shrink-0 w-12">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-gold">
                      {dayName}
                    </div>
                    <div className="font-display text-2xl">{dayNum}</div>
                  </div>
                  <div className="flex-1 space-y-1.5 min-w-0">
                    {events.map((e) => {
                      const item = getItem(e.itemId);
                      const colorClass =
                        e.status === "overdue"
                          ? "bg-destructive/15 text-destructive border-destructive/40"
                          : e.status === "active"
                            ? "bg-gold/15 text-gold border-gold/40"
                            : "bg-emerald/15 text-emerald border-emerald/40";
                      return (
                        <div
                          key={e.id}
                          className={`text-xs px-2 py-1 rounded-sm border truncate ${colorClass}`}
                        >
                          {item ? `${item.id} - ${item.name}` : "Unknown"}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Desktop/tablet: stacked multi-month grids */}
        <div className="space-y-6 hidden md:block">
          {displayMonths.map(({ year, month, label }: { year: number; month: number; label: string }) => {
            const monthCells = getMonthCells(year, month);
            const monthEventCount = getMonthEventsCount(year, month);
            return (
              <Card key={`${year}-${month}`} className="glass-panel p-0 overflow-hidden border border-border">
                <div className="bg-secondary/40 px-5 py-2.5 border-b border-border flex items-center justify-between">
                  <h2 className="font-display text-base font-semibold tracking-wide text-foreground">
                    {label}
                  </h2>
                  <span className="text-xs text-muted-foreground font-medium">
                    {monthEventCount} booking{monthEventCount === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="grid grid-cols-7 border-b border-border bg-secondary/20">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                    <div
                      key={d}
                      className="px-3 py-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-semibold"
                    >
                      {d}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7">
                  {monthCells.map((cell, i) => {
                    const events = cell ? (eventsByDate[cell.date] ?? []) : [];
                    const isToday = cell?.date === todayStr;
                    return (
                      <div
                        key={i}
                        className={`min-h-24 p-2 relative ${
                          isToday
                            ? "border-2 border-gold z-10 bg-gold/5"
                            : "border-r border-b border-border/70"
                        } ${
                          events.length > 0
                            ? "cursor-pointer hover:bg-secondary/30 transition-colors"
                            : ""
                        }`}
                        onClick={() => {
                          if (events.length > 0 && cell)
                            handleSelectDate(cell.date, events.length);
                        }}
                      >
                        {cell && (
                          <>
                            <div className="text-xs text-muted-foreground font-medium mb-1">
                              {cell.day}
                            </div>
                            <div className="space-y-1">
                              {events.slice(0, 3).map((e) => {
                                const item = getItem(e.itemId);
                                const customer = getCustomer(e.customerId);
                                const colorClass =
                                  e.status === "overdue"
                                    ? "bg-destructive/20 text-destructive border-destructive/40"
                                    : e.status === "active"
                                      ? "bg-gold/20 text-gold border-gold/40"
                                      : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/40";
                                return (
                                  <div
                                    key={e.id}
                                    className={`text-[10px] p-1 rounded-md border flex items-center gap-1.5 truncate ${colorClass}`}
                                    title={`${item ? item.name : "Unknown"} - ${customer?.name || ""}`}
                                  >
                                    {item?.image ? (
                                      <img
                                        src={item.image}
                                        alt=""
                                        className="w-5 h-6 object-cover rounded shrink-0 border border-black/10"
                                      />
                                    ) : null}
                                    <div className="truncate min-w-0 flex-1">
                                      <p className="font-semibold leading-tight truncate">
                                        {item ? `${item.name}` : e.itemId}
                                      </p>
                                      <p className="text-[9px] opacity-85 leading-tight truncate">
                                        {customer?.name || e.billNo || e.id}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                              {events.length > 3 && (
                                <div className="text-[10px] font-semibold text-gold pl-0.5">
                                  +{events.length - 3} more
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>

        <Card className="glass-panel h-fit">
          <CardContent className="p-5">
            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-4">
              Up Next
            </p>
            <div className="space-y-4">
              {upcoming.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No upcoming bookings match your search.
                </p>
              )}
              {upcoming.map((r) => {
                const item = getItem(r.itemId);
                const customer = getCustomer(r.customerId);
                if (!item || !customer) return null;
                const delDateStr = r.deliveryDate || r.startDate;
                const delTimeStr = (r as any).deliveryTime;
                const delPeriodStr = (r as any).deliveryTimePeriod;
                const endTimeStr = (r as any).endTime;
                const endPeriodStr = (r as any).endTimePeriod;
                const isReady = (r as any).remarkCompleted;
                const isDryclean = (r as any).drycleanCompleted;

                return (
                  <ViewInvoiceDialog
                    key={r.id}
                    rental={r}
                    trigger={
                      <div className="flex items-start gap-3 p-3 rounded-lg border border-border/60 bg-card hover:bg-secondary/40 cursor-pointer transition-colors group shadow-sm">
                        <img
                          src={item.image}
                          alt={item.name}
                          width={52}
                          height={70}
                          loading="lazy"
                          className="h-20 w-14 object-cover rounded-md border border-border shrink-0"
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-display text-sm font-semibold leading-tight truncate group-hover:text-gold transition-colors">
                                {item.id} - {item.name}
                              </p>
                              {r.itemNo && (
                                <p className="text-[10px] text-muted-foreground">Item No: {r.itemNo}</p>
                              )}
                            </div>
                            <StatusBadge status={r.status} kind="rental" />
                          </div>

                          <p className="text-[11px] font-medium text-foreground truncate">
                            Client: {customer.name} {customer.phone ? `(${customer.phone})` : ""}
                          </p>

                          <div className="text-[11px] space-y-0.5 border-t border-border/40 pt-1.5 mt-1">
                            <p className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                              <span>📦 Delivery:</span>
                              <span>{formatDate(delDateStr)}</span>
                              {delTimeStr && <span>{delTimeStr}</span>}
                              {delPeriodStr && <span className="text-[10px] opacity-80">({delPeriodStr})</span>}
                            </p>
                            <p className="text-muted-foreground flex items-center gap-1">
                              <span>🔄 Return:</span>
                              <span>{formatDate(r.endDate)}</span>
                              {endTimeStr && <span>{endTimeStr}</span>}
                              {endPeriodStr && <span className="text-[10px] opacity-80">({endPeriodStr})</span>}
                            </p>
                          </div>

                          {(isReady || isDryclean) && (
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {isReady && (
                                <span className="text-[9px] font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-1.5 py-0.5 rounded">
                                  Fitting Ready
                                </span>
                              )}
                              {isDryclean && (
                                <span className="text-[9px] font-medium bg-indigo-500/10 text-indigo-600 border border-indigo-500/20 px-1.5 py-0.5 rounded">
                                  Drycleaned
                                </span>
                              )}
                            </div>
                          )}

                          <div className="flex items-center justify-between pt-1 border-t border-border/30">
                            <span className="text-[10px] text-muted-foreground">Bill: #{r.billNo || r.id}</span>
                            <span className="text-[10px] text-gold font-medium group-hover:underline">
                              View Bill &rarr;
                            </span>
                          </div>
                        </div>
                      </div>
                    }
                  />
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bookings Modal Dialog matching Screenshot 3 */}
      <Dialog
        open={viewBookingsOpen || !!selectedDate}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedDate(null);
            setViewBookingsOpen(false);
          }
        }}
      >
        <DialogContent className="max-w-7xl w-[96vw] max-h-[92vh] flex flex-col p-5 sm:p-6 overflow-hidden bg-white border-slate-200 rounded-2xl shadow-2xl">
          <DialogHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pr-6 shrink-0 pb-4 border-b border-slate-200">
            <div>
              <DialogTitle className="font-serif text-2xl font-normal tracking-tight text-slate-900">
                {selectedDate
                  ? `Bookings on ${formatDate(selectedDate)}`
                  : startDateFilter && endDateFilter
                    ? `Bookings: ${formatDate(startDateFilter)} to ${formatDate(endDateFilter)}`
                    : `Bookings (${filteredRentals.length})`}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Showing all {(selectedDate ? selectedEvents : filteredRentals).length} scheduled bookings active between selected dates.
              </DialogDescription>
            </div>
            <Button
              onClick={() =>
                handleExportExcel(
                  selectedDate ? selectedEvents : filteredRentals,
                  selectedDate
                    ? `Bookings_${selectedDate}`
                    : startDateFilter && endDateFilter
                      ? `Bookings_${startDateFilter}_to_${endDateFilter}`
                      : "All_Bookings"
                )
              }
              className="bg-[#00B7CD] hover:bg-[#009CB0] text-white gap-2 shrink-0 h-9 text-xs font-semibold rounded-lg shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4" /> Export to Excel
            </Button>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto overflow-x-auto lg:overflow-x-hidden mt-4 rounded-xl border border-slate-200 bg-white shadow-xs">
            <Table className="text-xs w-full border-collapse">
              <TableHeader className="bg-slate-100/90 sticky top-0 z-10 border-b border-slate-200">
                <TableRow className="border-slate-200 hover:bg-transparent">
                  <TableHead className="w-20 font-semibold text-slate-600 px-3 py-2.5">Bill</TableHead>
                  <TableHead className="min-w-[140px] font-semibold text-slate-600 px-3 py-2.5">Client</TableHead>
                  <TableHead className="min-w-[180px] font-semibold text-slate-600 px-3 py-2.5">Piece / Item</TableHead>
                  <TableHead className="min-w-[110px] font-semibold text-slate-600 px-3 py-2.5">Size / Color</TableHead>
                  <TableHead className="min-w-[130px] font-semibold text-slate-600 px-3 py-2.5">Booking Dates</TableHead>
                  <TableHead className="min-w-[100px] font-semibold text-slate-600 px-3 py-2.5">Delivery</TableHead>
                  <TableHead className="min-w-[90px] font-semibold text-slate-600 px-3 py-2.5">Status</TableHead>
                  <TableHead className="min-w-[200px] font-semibold text-slate-600 px-3 py-2.5">Remark & Prep</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(selectedDate ? selectedEvents : filteredRentals).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12 text-slate-500">
                      No bookings found for the selected view.
                    </TableCell>
                  </TableRow>
                ) : (
                  (selectedDate ? selectedEvents : filteredRentals).map((e, index) => {
                    const item = getItem(e.itemId);
                    const customer = getCustomer(e.customerId);
                    const isEven = index % 2 === 0;
                    const rowBg = isEven ? "bg-white" : "bg-slate-50/80";

                    const isEmployeeReady = Boolean((e as any).remarkCompleted || (e as any).adminReconfirmed);
                    const isDrycleanDone = Boolean((e as any).drycleanCompleted);

                    return (
                      <TableRow
                        key={e.id}
                        className={`${rowBg} hover:bg-slate-100/80 border-b border-slate-200/80 transition-colors`}
                      >
                        {/* Bill */}
                        <TableCell className="font-bold text-[#1c1917] align-middle px-3 py-2.5">
                          <ViewInvoiceDialog
                            rental={e}
                            trigger={
                              <button
                                type="button"
                                className="font-bold text-[#1c1917] hover:text-[#d97736] hover:underline cursor-pointer whitespace-nowrap"
                              >
                                {e.billNo || e.id}
                              </button>
                            }
                          />
                        </TableCell>

                        {/* Client */}
                        <TableCell className="align-middle px-3 py-2.5">
                          <div className="font-bold text-[#1c1917] truncate max-w-[140px]">
                            {customer?.name || "Unknown"}
                          </div>
                          <div className="text-[11px] text-[#78716c] font-mono whitespace-nowrap">{customer?.phone}</div>
                        </TableCell>

                        {/* Piece / Item */}
                        <TableCell className="align-middle px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            {item?.image ? (
                              <img
                                src={item.image}
                                alt={item.name}
                                className="h-10 w-8 object-cover rounded-md border border-[#e7e0d3] shrink-0 shadow-sm"
                              />
                            ) : (
                              <div className="h-10 w-8 rounded-md bg-[#e7e0d3] shrink-0" />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="font-bold text-[#1c1917] truncate max-w-[130px]">{item?.name || "Unknown"}</div>
                              <div className="text-[10px] text-[#78716c] font-mono">{e.itemNo || e.itemId}</div>
                            </div>
                          </div>
                        </TableCell>

                        {/* Size / Color */}
                        <TableCell className="whitespace-nowrap align-middle px-3 py-2.5">
                          <div className="font-bold text-[#1c1917]">Size {item?.size || "XL"}</div>
                          <div className="text-[11px] text-[#78716c] capitalize truncate max-w-[100px]">{item?.color || item?.name || "Standard"}</div>
                        </TableCell>

                        {/* Booking Dates */}
                        <TableCell className="whitespace-nowrap align-middle text-[11px] px-3 py-2.5">
                          <div className="text-[#78716c]">
                            Start: <strong className="text-[#1c1917] font-bold">{formatDate(e.startDate)}</strong>
                          </div>
                          <div className="text-[#78716c]">
                            End: <strong className="text-[#1c1917] font-bold">{formatDate(e.endDate)}</strong>
                          </div>
                        </TableCell>

                        {/* Delivery */}
                        <TableCell className="whitespace-nowrap align-middle text-[11px] px-3 py-2.5">
                          <div className="font-bold text-[#1c1917]">{formatDate(e.deliveryDate || e.startDate)}</div>
                          <div className="text-[#78716c] text-[10px]">{(e as any).deliveryTimePeriod || "Afternoon"}</div>
                        </TableCell>

                        {/* Status */}
                        <TableCell className="whitespace-nowrap align-middle px-3 py-2.5">
                          <span className="inline-block bg-[#e6f4ea] text-[#2d7d46] font-semibold px-2.5 py-0.5 text-[10px] uppercase tracking-wider rounded-full border border-[#b7e1cd]">
                            {e.status || "UPCOMING"}
                          </span>
                        </TableCell>

                        {/* Remark & Prep Buttons */}
                        <TableCell className="text-xs align-middle px-3 py-2.5">
                          <div className="flex flex-col gap-1 py-0.5">
                            {e.remark && (
                              <div className="bg-white/80 border border-[#e7e0d3] rounded-md text-[10px] px-2 py-0.5 text-[#78716c] truncate max-w-[200px]">
                                {e.remark}
                              </div>
                            )}

                            <div className="flex flex-wrap items-center gap-1.5">
                              {isDrycleanDone ? (
                                <span className="bg-[#f3e8ff] text-[#9333ea] border border-[#d8b4fe] text-[9px] font-bold tracking-wider rounded-full px-2.5 py-0.5 whitespace-nowrap">
                                  DRYCLEAN DONE
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  className="border border-[#c084fc] text-[#9333ea] hover:bg-[#faf5ff] text-[9px] font-bold tracking-wider rounded-full px-2.5 py-0.5 uppercase transition-all cursor-pointer whitespace-nowrap"
                                  onClick={() => {
                                    const currentName = localStorage.getItem("user_name") || "";
                                    handleMarkDryclean(e.id, currentName);
                                  }}
                                >
                                  MARK DRYCLEAN DONE
                                </button>
                              )}

                              {isEmployeeReady ? (
                                <span className="bg-[#ecfdf5] text-[#059669] border border-[#a7f3d0] text-[9px] font-bold tracking-wider rounded-full px-2.5 py-0.5 whitespace-nowrap">
                                  READY
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  className="border border-[#fb923c] text-[#ea580c] hover:bg-[#fff7ed] text-[9px] font-bold tracking-wider rounded-full px-2.5 py-0.5 uppercase transition-all cursor-pointer whitespace-nowrap"
                                  onClick={() => {
                                    const currentName = localStorage.getItem("user_name") || "";
                                    handleMarkReady(e.id, currentName);
                                  }}
                                >
                                  MARK READY
                                </button>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
