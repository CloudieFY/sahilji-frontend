import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useStore } from "@/data/store";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatCurrencyINR } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
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
  const [currentDate, setCurrentDate] = useState(() => {
    const now = new Date();
    now.setDate(1);
    now.setHours(0, 0, 0, 0);
    return now;
  });

  const todayStr = today();
  const YEAR = currentDate.getFullYear();
  const MONTH = currentDate.getMonth();
  const MONTH_NAME = currentDate.toLocaleString("default", { month: "long", year: "numeric" });

  const query = searchQuery.trim().toLowerCase();
  const filteredRentals = rentals.filter((r) => {
    const item = getItem(r.itemId);
    const customer = getCustomer(r.customerId);
    const searchable = [
      r.id,
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

    if (m - 1 !== MONTH || y !== YEAR) return;
    const key = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    eventsByDate[key] ??= [];
    eventsByDate[key].push(r);
  });

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

  const handleExportExcel = () => {
    if (!selectedDate || selectedEvents.length === 0) {
      console.info("[calendar] export skipped", {
        selectedDate,
        selectedEvents: selectedEvents.length,
      });
      return;
    }
    console.info("[calendar] export started", {
      selectedDate,
      selectedEvents: selectedEvents.length,
    });
    const exportData = selectedEvents.map((e) => {
      const item = getItem(e.itemId);
      return {
        "Bill No": e.billNo || e.id,
        "Item No": e.itemNo || e.itemId,
        "Piece / Item": item?.name || "Unknown",
        "Delivery Date": formatDate(e.deliveryDate || e.startDate),
        Status: e.status,
        Remark: e.remark || "-",
        "Confirmed By": (e as any).remarkConfirmedBy || "-",
        "Admin Recheck": (e as any).adminReconfirmed ? "Recheck is done by admin" : "-",
        "Admin Recheck By": (e as any).adminReconfirmedBy || "-",
      };
    });
    const worksheet = XLSX.utils.json_to_sheet(exportData);
    worksheet["!cols"] = [
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
      { wch: 12 },
      { wch: 35 },
      { wch: 18 },
      { wch: 26 },
      { wch: 18 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Bookings");
    XLSX.writeFile(workbook, `Bookings_${selectedDate}.xlsx`);
    console.info("[calendar] export completed", {
      selectedDate,
      rows: exportData.length,
    });
  };

  return (
    <AppShell>
      <div className="flex items-end justify-between mb-6 sm:mb-8">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-gold">Diary</p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl">{MONTH_NAME}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="hidden sm:inline-flex" onClick={handleToday}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={handleNextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
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

        {/* Desktop/tablet: month grid */}
        <Card className="glass-panel p-0 overflow-hidden hidden md:block">
          <div className="grid grid-cols-7 border-b border-border">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div
                key={d}
                className="px-3 py-3 text-[10px] uppercase tracking-[0.25em] text-muted-foreground"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((cell, i) => {
              const events = cell ? (eventsByDate[cell.date] ?? []) : [];
              const isToday = cell?.date === todayStr;
              return (
                <div
                  key={i}
                  className={`min-h-27.5 p-2 relative ${isToday ? "border-2 border-gold z-10 bg-gold/5" : "border-r border-b border-border"} ${
                    events.length > 0 ? "cursor-pointer hover:bg-secondary/20 transition-colors" : ""
                  }`}
                  onClick={() => {
                    if (events.length > 0 && cell) handleSelectDate(cell.date, events.length);
                  }}
                >
                  {cell && (
                    <>
                      <div className="text-xs text-muted-foreground mb-1.5">
                        {cell.day}
                      </div>
                      <div className="space-y-1">
                        {events.slice(0, 2).map((e) => {
                          const item = getItem(e.itemId);
                          const colorClass =
                            e.status === "overdue"
                              ? "bg-destructive/20 text-destructive border-destructive/40"
                              : e.status === "active"
                                ? "bg-gold/15 text-gold border-gold/40"
                                : "bg-emerald/15 text-emerald border-emerald/40";
                          return (
                            <div
                              key={e.id}
                              className={`text-[10px] truncate px-1.5 py-0.5 rounded-sm border ${colorClass}`}
                              title={item ? `${item.id} - ${item.name}` : "Unknown"}
                            >
                              {item ? `${item.id} - ${item.name}` : "Unknown"}
                            </div>
                          );
                        })}
                        {events.length > 2 && (
                          <div className="text-[10px] text-muted-foreground">
                            +{events.length - 2} more
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
                return (
                  <div key={r.id} className="flex items-start gap-3">
                    <img
                      src={item.image}
                      alt={item.name}
                      width={48}
                      height={64}
                      loading="lazy"
                      className="h-16 w-12 object-cover rounded-sm border border-border"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-sm leading-tight">
                        {item.id} - {item.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {customer.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {r.startDate} to {r.endDate}
                      </p>
                      <div className="mt-1.5">
                        <StatusBadge status={r.status} kind="rental" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedDate} onOpenChange={(open) => !open && setSelectedDate(null)}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pr-6">
            <div>
              <DialogTitle className="font-display text-2xl">
                Bookings on {selectedDate ? formatDate(selectedDate) : ""}
              </DialogTitle>
              <DialogDescription>
                Detailed view of all scheduled bookings and remarks for this date.
              </DialogDescription>
            </div>
            <Button
              onClick={handleExportExcel}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shrink-0"
            >
              <Download className="w-4 h-4" /> Export to Excel
            </Button>
          </DialogHeader>
          <div className="overflow-x-auto rounded-md border border-border mt-4">
            <Table className="text-sm">
              <TableHeader className="bg-secondary/40">
                <TableRow>
                  <TableHead className="whitespace-nowrap">Bill No</TableHead>
                  <TableHead className="whitespace-nowrap">Client</TableHead>
                  <TableHead className="whitespace-nowrap">Piece / Item</TableHead>
                  <TableHead className="whitespace-nowrap">Size / Color</TableHead>
                  <TableHead className="whitespace-nowrap">Delivery</TableHead>
                  <TableHead className="whitespace-nowrap">Status</TableHead>
                  <TableHead className="min-w-48">Remark & Prep</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selectedEvents.map((e) => {
                  const item = getItem(e.itemId);
                  const customer = getCustomer(e.customerId);
                  const deliveryStr = (e.deliveryDate || e.startDate || "").slice(0, 10);
                  const daysToDelivery = Math.round((new Date(deliveryStr).getTime() - new Date(todayStr).getTime()) / 86400000);
                  const needsAttention = e.status !== "returned" && !!e.remark && !(e as any).remarkCompleted && daysToDelivery <= 5;
                  const isEmployeeReady = Boolean((e as any).remarkCompleted);
                  const isAdminReconfirmed = Boolean((e as any).adminReconfirmed);
                  const isDrycleanDone = Boolean((e as any).drycleanCompleted);
                  const isDrycleanAdminConfirmed = Boolean((e as any).drycleanAdminConfirmed);

                  return (
                    <TableRow key={e.id} className={needsAttention ? "bg-orange-500/5 hover:bg-orange-500/10" : "hover:bg-secondary/30"}>
                      <TableCell className="font-medium whitespace-nowrap">{e.billNo || e.id}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="font-semibold">{customer?.name || "Unknown"}</div>
                        <div className="text-xs text-muted-foreground">{customer?.phone}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{item?.name || "Unknown"}</div>
                        <div className="text-xs text-muted-foreground">{e.itemNo || e.itemId}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="text-sm font-medium">Size {item?.size || "-"}</div>
                        <div className="text-[10px] text-muted-foreground">{item?.color || "-"}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-medium text-emerald-600 dark:text-emerald-500">
                        {formatDate(e.deliveryDate || e.startDate)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <StatusBadge status={e.status} kind="rental" />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        <div className="flex items-start justify-between gap-3">
                          <div className="whitespace-pre-wrap flex-1 min-w-0">{e.remark || "-"}</div>
                          <div className="flex shrink-0 flex-col items-end gap-1.5">
                            {isDrycleanDone ? (
                              <Badge variant="outline" className="bg-indigo-500/10 text-indigo-500 border-indigo-500/20 font-medium tracking-wide text-[9px]">
                                Dryclean: {(e as any).drycleanCompletedBy}
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-[10px] uppercase tracking-wider text-indigo-700 border-indigo-500/40 hover:bg-indigo-500/10"
                                onClick={() => {
                                  const currentName = localStorage.getItem("user_name") || "";
                                  handleMarkDryclean(e.id, currentName);
                                }}
                              >
                                Mark Dryclean Done
                              </Button>
                            )}

                            {isDrycleanAdminConfirmed ? (
                              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-medium tracking-wide text-[9px]">
                                Dryclean Confirmed: {(e as any).drycleanAdminConfirmedBy}
                              </Badge>
                            ) : (
                              (role === "admin" || role === "reception") && isDrycleanDone && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 text-[10px] uppercase tracking-wider text-emerald-700 border-emerald-500/40 hover:bg-emerald-500/10"
                                  onClick={() => {
                                    const currentName = localStorage.getItem("user_name") || "";
                                    handleAdminConfirmDryclean(e.id, currentName);
                                  }}
                                >
                                  Confirm Dryclean
                                </Button>
                              )
                            )}

                            {isEmployeeReady ? (
                              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-medium tracking-wide text-[9px]">
                                Ready: {(e as any).remarkConfirmedBy}
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-[10px] uppercase tracking-wider text-orange-600 border-orange-500/40 hover:bg-orange-500/10"
                                onClick={() => {
                                  const currentName = localStorage.getItem("user_name") || "";
                                  handleMarkReady(e.id, currentName);
                                }}
                              >
                                Mark Ready
                              </Button>
                            )}
                            {isAdminReconfirmed ? (
                              <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20 font-medium tracking-wide text-[9px]">
                                Recheck is done by admin: {(e as any).adminReconfirmedBy}
                              </Badge>
                            ) : (
                              (role === "admin" || role === "reception") && isEmployeeReady && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 text-[10px] uppercase tracking-wider text-blue-600 border-blue-500/40 hover:bg-blue-500/10"
                                  onClick={() => {
                                    const currentName = localStorage.getItem("user_name") || "";
                                    handleAdminReconfirm(e.id, currentName);
                                  }}
                                >
                                  Admin Check
                                </Button>
                              )
                            )}
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
