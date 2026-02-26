"use client";

import { computeEvents, FamilyEvent } from "@/utils/eventHelpers";
import { motion } from "framer-motion";
import { Cake, CalendarDays, Clock, Flower } from "lucide-react";
import { useMemo, useState } from "react";
import { useDashboard } from "./DashboardContext";

interface EventsListProps {
  persons: {
    id: string;
    full_name: string;
    birth_year: number | null;
    birth_month: number | null;
    birth_day: number | null;
    death_year: number | null;
    death_month: number | null;
    death_day: number | null;
    is_deceased: boolean;
  }[];
}

const DAY_LABELS: Record<number, string> = {
  0: "Hôm nay",
  1: "Ngày mai",
};

function daysUntilLabel(days: number): string {
  if (days in DAY_LABELS) return DAY_LABELS[days];
  if (days <= 30) return `${days} ngày nữa`;
  if (days <= 60) return `${Math.ceil(days / 7)} tuần nữa`;
  return `${Math.ceil(days / 30)} tháng nữa`;
}

function EventCard({ event, index }: { event: FamilyEvent; index: number }) {
  const isBirthday = event.type === "birthday";
  const isToday = event.daysUntil === 0;
  const isSoon = event.daysUntil <= 7;

  const { setMemberModalId } = useDashboard();

  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.04 }}
      onClick={() => setMemberModalId(event.personId)}
      className={`w-full text-left flex items-center gap-4 p-4 rounded-2xl border transition-all hover:shadow-md group ${
        isToday
          ? "bg-amber-50 border-amber-300 shadow-sm"
          : isBirthday
            ? "bg-white/80 border-stone-200/60 hover:border-blue-200"
            : "bg-white/80 border-stone-200/60 hover:border-rose-200"
      }`}
    >
      {/* Icon */}
      <div
        className={`shrink-0 size-11 flex items-center justify-center rounded-xl ${
          isToday
            ? "bg-amber-100 text-amber-600"
            : isBirthday
              ? "bg-blue-50 text-blue-500"
              : "bg-rose-50 text-rose-500"
        }`}
      >
        {isBirthday ? (
          <Cake className="size-5" />
        ) : (
          <Flower className="size-5" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-stone-800 truncate group-hover:text-amber-700 transition-colors">
          {event.personName}
        </p>
        <p className="text-sm text-stone-500 flex items-center gap-1.5 mt-0.5">
          <CalendarDays className="size-3.5 shrink-0" />
          {isBirthday ? "Sinh nhật" : "Ngày giỗ"} —{" "}
          <span className="font-medium text-stone-600">
            {event.eventDateLabel}
          </span>
          {event.originYear && (
            <span className="text-stone-400">({event.originYear})</span>
          )}
        </p>
      </div>

      {/* Days badge */}
      <div
        className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${
          isToday
            ? "bg-amber-400 text-white"
            : isSoon
              ? "bg-red-100 text-red-600"
              : "bg-stone-100 text-stone-500"
        }`}
      >
        <Clock className="size-3" />
        {daysUntilLabel(event.daysUntil)}
      </div>
    </motion.button>
  );
}

export default function EventsList({ persons }: EventsListProps) {
  const [filter, setFilter] = useState<
    "all" | "birthday" | "death_anniversary"
  >("all");
  const [showCount, setShowCount] = useState(20);

  const allEvents = useMemo(() => computeEvents(persons), [persons]);

  const filtered = useMemo(
    () =>
      filter === "all" ? allEvents : allEvents.filter((e) => e.type === filter),
    [allEvents, filter],
  );

  // Split into upcoming (within 365 days) and far away
  const upcoming = filtered.filter((e) => e.daysUntil <= 365);
  const visible = upcoming.slice(0, showCount);

  const todayCount = allEvents.filter((e) => e.daysUntil === 0).length;
  const soonCount = allEvents.filter(
    (e) => e.daysUntil > 0 && e.daysUntil <= 7,
  ).length;

  return (
    <div className="space-y-5">
      {/* Summary banner */}
      {(todayCount > 0 || soonCount > 0) && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3"
        >
          <span className="text-2xl">🎊</span>
          <p className="text-sm font-medium text-amber-800">
            {todayCount > 0 && (
              <span className="font-bold">{todayCount} sự kiện hôm nay</span>
            )}
            {todayCount > 0 && soonCount > 0 && " · "}
            {soonCount > 0 && <span>{soonCount} sự kiện trong 7 ngày tới</span>}
          </p>
        </motion.div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(
          [
            { key: "all", label: "Tất cả" },
            { key: "birthday", label: "Sinh nhật" },
            { key: "death_anniversary", label: "Ngày giỗ" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              filter === tab.key
                ? "bg-amber-500 text-white shadow-sm"
                : "bg-white/80 text-stone-600 border border-stone-200/60 hover:border-amber-200 hover:text-amber-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-stone-400 self-center">
          {filtered.length} sự kiện trong năm
        </span>
      </div>

      {/* Event list */}
      {visible.length === 0 ? (
        <div className="text-center py-16 text-stone-400">
          <CalendarDays className="size-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Không có sự kiện nào</p>
          <p className="text-sm mt-1">
            Hãy bổ sung ngày sinh hoặc ngày mất cho thành viên
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {visible.map((event, i) => (
            <EventCard
              key={`${event.personId}-${event.type}`}
              event={event}
              index={i}
            />
          ))}
        </div>
      )}

      {/* Load more */}
      {upcoming.length > showCount && (
        <button
          onClick={() => setShowCount((n) => n + 20)}
          className="w-full py-3 text-sm font-semibold text-stone-500 hover:text-amber-600 transition-colors"
        >
          Xem thêm {upcoming.length - showCount} sự kiện…
        </button>
      )}
    </div>
  );
}
