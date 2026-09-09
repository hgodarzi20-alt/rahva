"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { computeReturnCharges } from "@/lib/pricing";
import { toFaDigits, toman } from "@/lib/format";

const FUEL = ["1/1", "3/4", "1/2", "1/4"];

export default function CheckinForm(props: {
  bookingId: number;
  checkoutOdometer: number;
  days: number;
  dailyKmLimit: number;
  extraKmRate: number;
  dailyRate: number;
  dropoffAt: string;
  lateGraceHours: number;
  lateFeePercent: number;
}) {
  const router = useRouter();
  const [odometer, setOdometer] = useState("");
  const [fuel, setFuel] = useState("1/1");
  const [collected, setCollected] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // پیش‌نمایش محاسبه — همان تابعی که سرور استفاده می‌کند
  const charges = useMemo(() => {
    const n = Number(odometer);
    if (!Number.isFinite(n) || n < Number(props.checkoutOdometer)) return null;
    return computeReturnCharges({
      days: Number(props.days),
      dailyRate: Number(props.dailyRate),
      dailyKmLimit: Number(props.dailyKmLimit),
      extraKmRate: Number(props.extraKmRate),
      dropoffAt: new Date(props.dropoffAt),
      checkinAt: new Date(),
      checkoutOdometer: Number(props.checkoutOdometer),
      checkinOdometer: n,
      lateGraceHours: Number(props.lateGraceHours),
      lateFeePercent: Number(props.lateFeePercent),
    });
  }, [odometer, props]);

  async function submit() {
    setBusy(true); setError("");
    const res = await fetch(`/api/staff/bookings/${props.bookingId}/checkin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkinOdometer: Number(odometer), checkinFuel: fuel, chargesCollected: collected }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "خطایی رخ داد.");
    router.refresh();
  }

  return (
    <div className="max-w-xl rounded border border-line p-5">
      <h2 className="mb-4 border-b border-line-2 pb-2 text-[13px] font-bold">فرم بازگشت خودرو</h2>

      <div className="mb-3 grid gap-3.5 sm:grid-cols-2">
        <div>
          <label className="label">کیلومتر نهایی</label>
          <input className="input mono" placeholder={String(props.checkoutOdometer)} value={odometer} onChange={(e) => setOdometer(e.target.value)} />
          <p className="mt-1 text-[11px] text-ink-3">کیلومتر اولیه: {toFaDigits(props.checkoutOdometer)}</p>
        </div>
        <div>
          <label className="label">سطح سوخت</label>
          <select className="input mono" value={fuel} onChange={(e) => setFuel(e.target.value)}>
            {FUEL.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      </div>

      <div className="mb-3 rounded border border-line p-4">
        <div className="mb-2.5 text-xs font-bold">محاسبه خودکار</div>
        {charges ? (
          <>
            <Row label="کیلومتر پیموده‌شده" value={toFaDigits(charges.kmDriven)} />
            <Row label={`مازاد بر سقف (${toFaDigits(Number(props.dailyKmLimit) * Number(props.days))} کیلومتر)`} value={toFaDigits(charges.kmOverLimit)} />
            <Row label="جریمه کیلومتر اضافه" value={toman(charges.extraKmFee)} />
            <Row label="تأخیر در بازگشت" value={`${toFaDigits(charges.lateDays)} روز · ${toman(charges.lateFee)}`} />
            <div className="mt-2.5 flex justify-between border-t border-line-2 pt-2.5 font-bold">
              <span>قابل دریافت از مشتری</span><span>{toman(charges.chargesTotal)} تومان</span>
            </div>
          </>
        ) : (
          <p className="text-[11px] text-ink-3">کیلومتر نهایی را وارد کنید تا محاسبه انجام شود.</p>
        )}
      </div>

      {charges && charges.chargesTotal > 0 ? (
        <label className="flex cursor-pointer items-center gap-2 rounded border border-signal-ring bg-white p-3 text-[13px] text-signal">
          <input type="checkbox" checked={collected} onChange={(e) => setCollected(e.target.checked)} />
          مبلغ بالا به‌صورت حضوری از مشتری دریافت شد
        </label>
      ) : (
        <p className="rounded bg-line-2 p-3 text-[13px] text-ink-3">
          مبلغی برای دریافت وجود ندارد.
        </p>
      )}

      {error && <p className="mt-3 text-xs text-danger">{error}</p>}

      <button onClick={submit} disabled={busy || !charges || (charges.chargesTotal > 0 && !collected)} className="btn btn-primary btn-lg mt-4">
        {busy ? "…" : "ثبت بازگشت و پایان اجاره"}
      </button>
      <p className="mt-1.5 text-center text-[11px] text-ink-3">وضعیت رزرو: در حال اجاره ← تکمیل‌شده</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-1.5 flex justify-between">
      <span className="text-ink-2">{label}</span><span className="mono">{value}</span>
    </div>
  );
}
