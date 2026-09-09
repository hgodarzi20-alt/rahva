"use client";

import { useEffect, useRef, useState } from "react";
import {
  JALALI_MONTHS, WEEKDAYS_SHORT, addJalaliMonth, faNum, firstWeekdayIndex,
  formatJalali, jalaliMonthLength, sameDay, startOfDay, toGregorian, toJalali,
} from "@/lib/jalali";

/**
 * انتخاب تاریخ و ساعت یک رویداد گذشته — زمان حادثه.
 *
 * برخلاف DateRangePicker که بازه می‌گیرد و آینده را باز می‌گذارد،
 * اینجا یک روز انتخاب می‌شود و روزهای آینده غیرفعال‌اند: حادثه‌ای که
 * هنوز رخ نداده قابل ثبت نیست.
 *
 * مقدار خروجی همان قالب datetime-local است تا سمت سرور تغییری لازم نباشد.
 */
export default function JalaliDateTimeInput({
  value,
  onChange,
  label,
}: {
  /** قالب YYYY-MM-DDTHH:mm */
  value: string;
  onChange: (next: string) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const today = startOfDay(new Date());
  const [datePart = "", timePart = ""] = value.split("T");

  const selected = datePart ? parseLocalDate(datePart) : null;
  const jSel = toJalali(selected ?? today);
  const [cursor, setCursor] = useState({ jy: jSel.jy, jm: jSel.jm });

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function pickDay(d: Date) {
    onChange(`${isoDay(d)}T${timePart || "12:00"}`);
    setOpen(false);
  }

  function pickTime(t: string) {
    onChange(`${datePart || isoDay(today)}T${t}`);
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

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="input flex-1 text-right"
        >
          {selected ? formatJalali(selected) : "انتخاب تاریخ"}
        </button>
        <input
          type="time"
          className="input mono w-32"
          value={timePart}
          onChange={(e) => pickTime(e.target.value)}
        />
      </div>

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
              const future = d > today;
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
                    disabled={future}
                    onClick={() => pickDay(d)}
                    className={`flex h-8 w-8 items-center justify-center rounded-full transition
                      ${future ? "cursor-not-allowed text-ink-3" : "hover:bg-line-2"} ${circle}`}
                  >
                    {faNum(day)}
                  </button>
                </span>
              );
            })}
          </div>

          <div className="mt-3 border-t border-line-2 pt-3 text-center">
            <button
              type="button"
              onClick={() => pickDay(today)}
              className="link text-[12px]"
            >
              امروز
            </button>
          </div>
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
