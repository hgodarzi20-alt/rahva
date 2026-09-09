"use client";

import { useEffect, useRef, useState } from "react";
import {
  JALALI_MONTHS, WEEKDAYS_SHORT, addJalaliMonth, faNum, firstWeekdayIndex,
  formatJalali, jalaliMonthLength, sameDay, startOfDay, toGregorian, toJalali,
} from "@/lib/jalali";

/**
 * انتخاب یک تاریخ بدون ساعت — مثل اعتبار بیمه‌نامه طرف مقابل.
 *
 * برخلاف JalaliDateTimeInput که فقط گذشته را می‌پذیرد، اینجا آینده باز است
 * چون بیمه‌نامه در آینده منقضی می‌شود.
 *
 * مقدار خروجی همان قالب ورودی date است (YYYY-MM-DD) تا سمت سرور
 * تغییری لازم نباشد.
 */
export default function JalaliDateInput({
  value,
  onChange,
  label,
  disablePast = false,
}: {
  /** قالب YYYY-MM-DD */
  value: string;
  onChange: (next: string) => void;
  label?: string;
  disablePast?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const today = startOfDay(new Date());
  const selected = value ? parseLocalDate(value) : null;
  const jSel = toJalali(selected ?? today);
  const [cursor, setCursor] = useState({ jy: jSel.jy, jm: jSel.jm });

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function pick(d: Date) {
    onChange(isoDay(d));
    setOpen(false);
  }

  const length = jalaliMonthLength(cursor.jy, cursor.jm);
  const offset = firstWeekdayIndex(cursor.jy, cursor.jm);
  const cells: (number | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length }, (_, i) => i + 1),
  ];

  return (
    <div className="relative" ref={ref}>
      {label && <label className="label">{label}</label>}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="input w-full text-right"
      >
        {selected ? formatJalali(selected) : "انتخاب تاریخ"}
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-[min(92vw,320px)] rounded-card border border-line bg-white p-4 shadow-sh2">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCursor(addJalaliMonth(cursor.jy, cursor.jm, -1))}
              className="px-1.5 text-ink-3"
            >
              ›
            </button>
            <b className="text-[13px]">
              {JALALI_MONTHS[cursor.jm - 1]} {faNum(cursor.jy)}
            </b>
            <button
              type="button"
              onClick={() => setCursor(addJalaliMonth(cursor.jy, cursor.jm, 1))}
              className="px-1.5 text-ink-3"
            >
              ‹
            </button>
          </div>

          <div className="grid grid-cols-7 text-center text-[11px] text-ink-3">
            {WEEKDAYS_SHORT.map((w) => (
              <span key={w} className="py-1">
                {w}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 text-center text-[13px]">
            {cells.map((day, i) => {
              if (day === null) return <span key={`e${i}`} className="h-9" />;

              const d = toGregorian(cursor.jy, cursor.jm, day);
              const blocked = disablePast && d < today;
              const isSelected = selected ? sameDay(d, selected) : false;
              const isToday = sameDay(d, today);

              const circle = isSelected
                ? "bg-accent text-white font-semibold"
                : isToday
                  ? "ring-1 ring-inset ring-accent font-semibold"
                  : "";

              return (
                <span key={day} className="flex h-9 items-center justify-center">
                  <button
                    type="button"
                    disabled={blocked}
                    onClick={() => pick(d)}
                    className={`flex h-8 w-8 items-center justify-center rounded-full transition
                      ${blocked ? "cursor-not-allowed text-ink-3" : "hover:bg-line-2"} ${circle}`}
                  >
                    {faNum(day)}
                  </button>
                </span>
              );
            })}
          </div>

          {value && (
            <div className="mt-3 border-t border-line-2 pt-3 text-center">
              <button type="button" onClick={() => { onChange(""); setOpen(false); }} className="link text-[12px]">
                پاک کردن
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function isoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}
