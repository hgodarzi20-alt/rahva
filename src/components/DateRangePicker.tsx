"use client";

import { useEffect, useRef, useState } from "react";
import {
  JALALI_MONTHS, WEEKDAYS_SHORT, addJalaliMonth, faNum, firstWeekdayIndex,
  formatJalali, fromIso, isoOf, jalaliMonthLength, sameDay, startOfDay, toGregorian, toJalali,
} from "@/lib/jalali";

interface Props {
  from: string;   // ISO میلادی
  to: string;
  onChange: (from: string, to: string) => void;
  onClose?: () => void;
}

/**
 * انتخابگر بازه شمسی.
 * روز شروع و پایان دایره پر می‌گیرند، بین آن‌ها باند آبی خیلی روشن.
 * روز جاری فقط حلقه دارد. روزهای گذشته غیرفعال‌اند و حذف نمی‌شوند تا
 * ساختار هفته به هم نریزد.
 */
export default function DateRangePicker({ from, to, onChange, onClose }: Props) {
  const today = startOfDay(new Date());
  const fromDate = fromIso(from);
  const toDate = fromIso(to);

  const jFrom = toJalali(fromDate);
  const [cursor, setCursor] = useState({ jy: jFrom.jy, jm: jFrom.jm });
  const [picking, setPicking] = useState<"from" | "to">("from");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose?.();
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [onClose]);

  function select(d: Date) {
    if (d < today) return;
    if (picking === "from") {
      const nextTo = d >= toDate ? new Date(d.getTime() + 86400000) : toDate;
      onChange(isoOf(d), isoOf(nextTo));
      setPicking("to");
    } else {
      if (d <= fromDate) {
        onChange(isoOf(d), isoOf(new Date(d.getTime() + 86400000)));
        setPicking("to");
      } else {
        onChange(from, isoOf(d));
        setPicking("from");
      }
    }
  }

  const nights = Math.max(1, Math.round((toDate.getTime() - fromDate.getTime()) / 86400000));

  return (
    <div ref={ref} className="w-[min(92vw,660px)] rounded-card border border-line bg-white p-4 shadow-sh2">
      <div className="mb-3 flex gap-2">
        <button
          type="button"
          onClick={() => setPicking("from")}
          className={`flex-1 rounded border px-3 py-2 text-right transition ${picking === "from" ? "border-accent shadow-[inset_0_0_0_1px_theme(colors.accent.DEFAULT)]" : "border-line"}`}
        >
          <span className="block text-[11px] text-ink-3">تحویل</span>
          <span className="block font-semibold">{formatJalali(fromDate)}</span>
        </button>
        <button
          type="button"
          onClick={() => setPicking("to")}
          className={`flex-1 rounded border px-3 py-2 text-right transition ${picking === "to" ? "border-accent shadow-[inset_0_0_0_1px_theme(colors.accent.DEFAULT)]" : "border-line"}`}
        >
          <span className="block text-[11px] text-ink-3">بازگشت</span>
          <span className="block font-semibold">{formatJalali(toDate)}</span>
        </button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {[0, 1].map((offset) => {
          const m = addJalaliMonth(cursor.jy, cursor.jm, offset);
          return (
            <Month
              key={`${m.jy}-${m.jm}`}
              jy={m.jy}
              jm={m.jm}
              today={today}
              from={fromDate}
              to={toDate}
              onSelect={select}
              showPrev={offset === 0}
              showNext={offset === 1}
              onPrev={() => setCursor(addJalaliMonth(cursor.jy, cursor.jm, -1))}
              onNext={() => setCursor(addJalaliMonth(cursor.jy, cursor.jm, 1))}
            />
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-line-2 pt-3">
        <span className="text-[13px]">
          <b>{faNum(nights)} روز اجاره</b>
        </span>
        <button type="button" onClick={onClose} className="btn btn-primary btn-sm">تأیید تاریخ</button>
      </div>
    </div>
  );
}

function Month({
  jy, jm, today, from, to, onSelect, showPrev, showNext, onPrev, onNext,
}: {
  jy: number; jm: number; today: Date; from: Date; to: Date;
  onSelect: (d: Date) => void;
  showPrev: boolean; showNext: boolean; onPrev: () => void; onNext: () => void;
}) {
  const length = jalaliMonthLength(jy, jm);
  const offset = firstWeekdayIndex(jy, jm);
  const cells: (number | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length }, (_, i) => i + 1),
  ];

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={onPrev} disabled={!showPrev}
          className="px-1.5 text-ink-3 disabled:opacity-0">›</button>
        <b className="text-[13px]">{JALALI_MONTHS[jm - 1]} {faNum(jy)}</b>
        <button type="button" onClick={onNext} disabled={!showNext}
          className="px-1.5 text-ink-3 disabled:opacity-0">‹</button>
      </div>

      <div className="grid grid-cols-7 text-center text-[11px] text-ink-3">
        {WEEKDAYS_SHORT.map((w) => <span key={w} className="py-1">{w}</span>)}
      </div>

      <div className="grid grid-cols-7 text-center text-[13px]">
        {cells.map((day, i) => {
          if (day === null) return <span key={`e${i}`} className="h-10" />;

          const d = toGregorian(jy, jm, day);
          const past = d < today;
          const isFrom = sameDay(d, from);
          const isTo = sameDay(d, to);
          const inRange = d > from && d < to;
          const isToday = sameDay(d, today);

          const band = isFrom ? "bg-accent-soft rounded-r-[21px]"
            : isTo ? "bg-accent-soft rounded-l-[21px]"
            : inRange ? "bg-accent-soft" : "";

          const circle = isFrom ? "bg-accent text-white font-semibold"
            : isTo ? "bg-accent text-white font-semibold ring-2 ring-accent-dark"
            : isToday ? "ring-1 ring-inset ring-accent font-semibold"
            : "";

          return (
            <span key={day} className={`flex h-10 items-center justify-center ${band}`}>
              <button
                type="button"
                disabled={past}
                onClick={() => onSelect(d)}
                className={`flex h-9 w-9 items-center justify-center rounded-full transition
                  ${past ? "cursor-not-allowed text-ink-3 line-through" : "hover:bg-line-2"} ${circle}`}
              >
                {faNum(day)}
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}
