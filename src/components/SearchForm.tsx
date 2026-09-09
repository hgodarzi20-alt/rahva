"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import DateRangePicker from "./DateRangePicker";
import { faNum, formatJalali, fromIso, isoOf } from "@/lib/jalali";

/** ساعت‌های داخل بازه کاری شعبه — استوری ۱.۱ بند ۵ */
function workingHours(opens: string, closes: string) {
  const out: string[] = [];
  for (let h = Number(opens.slice(0, 2)); h <= Number(closes.slice(0, 2)); h++) {
    out.push(`${String(h).padStart(2, "0")}:00`);
  }
  return out;
}

export default function SearchForm({
  branchName,
  opensAt,
  closesAt,
  defaults,
  compact = false,
}: {
  branchName: string;
  opensAt: string;
  closesAt: string;
  defaults?: { from?: string; to?: string; fromTime?: string; toTime?: string };
  /** نمای فشرده برای نوار بالای صفحه نتایج */
  compact?: boolean;
}) {
  const router = useRouter();
  const today = new Date();
  const inThree = new Date(today.getTime() + 3 * 86400000);

  const [from, setFrom] = useState(defaults?.from ?? isoOf(today));
  const [to, setTo] = useState(defaults?.to ?? isoOf(inThree));
  const [fromTime, setFromTime] = useState(defaults?.fromTime ?? "10:00");
  const [toTime, setToTime] = useState(defaults?.toTime ?? "10:00");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  const hours = workingHours(opensAt, closesAt);
  const days = Math.max(1, Math.round((fromIso(to).getTime() - fromIso(from).getTime()) / 86400000));

  function submit() {
    const start = new Date(`${from}T${fromTime}`);
    const end = new Date(`${to}T${toTime}`);
    if (start < new Date(new Date().toDateString())) return setError("تاریخ گذشته قابل انتخاب نیست.");
    if (end <= start) return setError("زمان بازگشت باید بعد از زمان تحویل باشد.");
    if (days > 30) return setError("حداکثر مدت اجاره ۳۰ روز است.");
    setError("");
    router.push(`/search?from=${from}&fromTime=${fromTime}&to=${to}&toTime=${toTime}`);
  }

  return (
    <div className={compact ? "" : "rounded-card border border-line bg-white p-5 shadow-sh2"}>
      <div className={`grid items-end gap-3 ${compact ? "md:grid-cols-[1fr_1.4fr_auto]" : "md:grid-cols-[1fr_1.6fr_0.7fr_auto]"}`}>

        <div>
          <label className="label">محل تحویل و بازگشت</label>
          <div className="input input-locked flex items-center justify-between">
            <span>{branchName}</span>
            <span className="text-ink-3">🔒</span>
          </div>
          {!compact && <p className="hint">در این نسخه فقط یک شعبه در تهران فعال است.</p>}
        </div>

        <div className="relative">
          <label className="label">تاریخ سفر</label>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="input flex items-center justify-between text-right"
          >
            <span>{formatJalali(fromIso(from))} — {formatJalali(fromIso(to))}</span>
            <span className="text-ink-3">📅</span>
          </button>
          {!compact && <p className="hint">{faNum(days)} روز</p>}

          {open && (
            <div className="absolute right-0 top-full z-30 mt-2">
              <DateRangePicker
                from={from}
                to={to}
                onChange={(f, t) => { setFrom(f); setTo(t); }}
                onClose={() => setOpen(false)}
              />
            </div>
          )}
        </div>

        {!compact && (
          <div>
            <label className="label">ساعت تحویل و بازگشت</label>
            <div className="flex gap-1.5">
              <select className="input" value={fromTime} onChange={(e) => setFromTime(e.target.value)}>
                {hours.map((h) => <option key={h} value={h}>{faNum(h)}</option>)}
              </select>
              <select className="input" value={toTime} onChange={(e) => setToTime(e.target.value)}>
                {hours.map((h) => <option key={h} value={h}>{faNum(h)}</option>)}
              </select>
            </div>
          </div>
        )}

        <button onClick={submit} className="btn btn-primary h-[46px] px-8">جست‌وجوی خودرو</button>
      </div>

      {!compact && (
        <p className="mt-3 text-[11px] text-ink-3">
          ساعت کاری شعبه {faNum(opensAt)} تا {faNum(closesAt)} — ساعت‌های خارج از این بازه قابل انتخاب نیستند.
        </p>
      )}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
