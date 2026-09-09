"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toman, toFaDigits } from "@/lib/format";

/**
 * تشکیل و صدور صورت‌حساب — استوری ۵.۲.
 * فرانشیز و اعتبار روزهای استفاده‌نشده را سرور می‌سازد؛ اینجا فقط
 * اقلام دستی و تصمیم چشم‌پوشی از کروکی گرفته می‌شود.
 */
export default function InvoiceBuilder({
  code,
  gross,
  franchisePercent,
  waiverCeiling,
  policeReportStatus,
  confirmedFault,
  responseHours,
  parkingDailyRate,
  preview,
}: {
  code: string;
  gross: number;
  franchisePercent: number;
  waiverCeiling: number;
  policeReportStatus: string | null;
  confirmedFault: string | null;
  responseHours: number;
  parkingDailyRate: number;
  /** اقلام ذخیره‌شده از آخرین پیش‌نویس */
  preview: { type: string; label: string; amount: number; basis: string | null }[];
}) {
  const router = useRouter();
  const [towing, setTowing] = useState("");
  const [downtimeDays, setDowntimeDays] = useState("");
  const [downtimeRate, setDowntimeRate] = useState("");
  const [parkingDays, setParkingDays] = useState("");
  const [waived, setWaived] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const canWaive = gross < waiverCeiling;
  const hasReport = policeReportStatus === "uploaded" || waived;
  const otherAtFault = confirmedFault === "other_party";

  const downtime = (Number(downtimeDays) || 0) * (Number(downtimeRate) || 0);
  const parking = (Number(parkingDays) || 0) * parkingDailyRate;

  function payload(issue: boolean) {
    return {
      issue,
      policeReportWaived: waived,
      manual: {
        assistance_towing: Number(towing) || 0,
        vehicle_downtime: downtime,
        parking,
      },
      basis: {
        vehicle_downtime: downtimeDays
          ? `${toFaDigits(downtimeDays)} روز × ${toman(Number(downtimeRate) || 0)}`
          : null,
        parking: parkingDays
          ? `${toFaDigits(parkingDays)} روز × ${toman(parkingDailyRate)}`
          : null,
      },
    };
  }

  async function save(issue: boolean) {
    setBusy(true); setError("");
    const res = await fetch(`/api/staff/incidents/${code}/invoice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload(issue)),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "خطایی رخ داد.");
    router.refresh();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <section className="card p-5">
        <b className="text-[13px]">اقلام صورت‌حساب</b>

        <div className="mt-4 flex flex-col gap-4">
          <div>
            <label className="label">امداد و حمل با خودروبر</label>
            <input className="input mono" inputMode="numeric" placeholder="۰"
              value={towing} onChange={(e) => setTowing(e.target.value)} />
            <p className="hint">فقط اگر خودروبر واقعاً اعزام شده باشد.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">خواب خودرو — تعداد روز</label>
              <input className="input mono" inputMode="numeric"
                value={downtimeDays} onChange={(e) => setDowntimeDays(e.target.value)} />
              <p className="hint">روزهایی که خودرو از چرخه اجاره خارج بوده.</p>
            </div>
            <div>
              <label className="label">نرخ روزانه خواب خودرو</label>
              <input className="input mono" inputMode="numeric"
                value={downtimeRate} onChange={(e) => setDowntimeRate(e.target.value)} />
              <p className="hint">{downtime > 0 ? toman(downtime) : "معمولاً برابر اجاره‌بهای روزانه"}</p>
            </div>
          </div>

          <div>
            <label className="label">پارکینگ — تعداد روز</label>
            <input className="input mono" inputMode="numeric"
              value={parkingDays} onChange={(e) => setParkingDays(e.target.value)} />
            <p className="hint">
              فقط اگر خودرو در پارکینگ پلیس یا انبار شرکت مانده — معمولاً حداکثر سه روز.
              نرخ روزانه {toman(parkingDailyRate)} · جمع {toman(parking)}
            </p>
          </div>
        </div>

        <div className="mt-5 border-t border-line-2 pt-4">
          <b className="text-[13px]">وضعیت کروکی</b>
          <p className="mt-1.5 text-[12px] text-ink-3">
            {policeReportStatus === "uploaded"
              ? "سند کروکی در پرونده ثبت شده است."
              : policeReportStatus === "pending"
                ? "کاربر اعلام کرده کروکی تنظیم شده ولی نسخه‌اش را ارائه نکرده."
                : "کاربر اعلام کرده کروکی تنظیم نشده و مسئولیت مالی را پذیرفته."}
          </p>

          {policeReportStatus !== "uploaded" && (
            <div className={`blk mt-3 ${canWaive ? "blk-info" : "blk-warn"}`}>
              <p>
                برآورد خسارت {toman(gross)} تومان است و سقف عدم‌نیاز به کروکی{" "}
                {toman(waiverCeiling)} تومان.
                {canWaive
                  ? " چون زیر سقف است، شرکت می‌تواند بدون کروکی از بیمه استفاده کند."
                  : " چون بالای سقف است، بدون کروکی بیمه پرداختی ندارد."}
              </p>
              <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-[13px]">
                <input type="checkbox" className="mt-1" disabled={!canWaive}
                  checked={waived} onChange={(e) => setWaived(e.target.checked)} />
                <span>چشم‌پوشی از الزام کروکی</span>
              </label>
            </div>
          )}
        </div>

        {error && <p className="error-text">{error}</p>}

        <div className="mt-5 flex flex-wrap gap-2.5">
          <button onClick={() => save(false)} disabled={busy} className="btn">ذخیره پیش‌نویس</button>
          <button onClick={() => save(true)} disabled={busy} className="btn btn-primary">
            {busy ? "…" : "صدور و ابلاغ به مستأجر"}
          </button>
        </div>
        <p className="mt-2 text-[12px] text-ink-3">
          پس از صدور، مستأجر {toFaDigits(responseHours)} ساعت برای پاسخ فرصت دارد.
        </p>
      </section>

      <aside className="card self-start p-5">
        <b className="text-[13px]">مسیر مالی</b>
        <p className="mt-2 text-[12px] leading-6 text-ink-2">
          {!hasReport
            ? "بدون کروکی: کل برآورد خسارت بر عهده مستأجر است."
            : otherAtFault
              ? "مقصر طرف مقابل و کروکی موجود: سهم مستأجر از تعمیر صفر است."
              : `مقصر مستأجر و کروکی موجود: فرانشیز ${toFaDigits(franchisePercent)}٪ برآورد.`}
        </p>

        {preview.length > 0 && (
          <>
            <div className="my-4 h-px bg-line-2" />
            <b className="text-[13px]">آخرین پیش‌نویس ذخیره‌شده</b>
            <div className="mt-2 flex flex-col gap-1.5 text-[13px]">
              {preview.map((i, n) => (
                <div key={n} className="flex items-baseline justify-between gap-2">
                  <span className="text-ink-2">{i.label}</span>
                  <span className={`mono ${i.amount < 0 ? "text-ok" : ""}`}>{toman(i.amount)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
