"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const FUEL = ["1/1", "3/4", "1/2", "1/4"];

interface DamageDraft { title: string; location: string }

export default function CheckoutForm({
  bookingId,
  depositAmount,
  driver,
}: {
  bookingId: number;
  /** ودیعه‌ای که در همین مرحله وصول می‌شود */
  depositAmount: number | null;
  /** اطلاعات ثبت‌شده در رزرو، برای تطبیق با اصل مدارک */
  driver: { name: string; nationalId: string; licenseNumber: string; licenseExpiry: string | null };
}) {
  const router = useRouter();
  const [odometer, setOdometer] = useState("");
  const [fuel, setFuel] = useState("1/1");
  const [notes, setNotes] = useState("");
  const [checks, setChecks] = useState({ licenseChecked: false, idChecked: false, contractSigned: false });
  const [depositCollected, setDepositCollected] = useState(false);

  const [damages, setDamages] = useState<DamageDraft[]>([]);
  const [dTitle, setDTitle] = useState("");
  const [dLocation, setDLocation] = useState("");

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const allChecked = checks.licenseChecked && checks.idChecked && checks.contractSigned;
  const ready = allChecked && odometer !== "" && (!depositAmount || depositCollected);

  function addDamage() {
    if (!dTitle.trim()) return;
    setDamages([...damages, { title: dTitle.trim(), location: dLocation.trim() }]);
    setDTitle(""); setDLocation("");
  }

  async function submit() {
    setBusy(true); setError("");
    const res = await fetch(`/api/staff/bookings/${bookingId}/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        checkoutOdometer: Number(odometer),
        checkoutFuel: fuel,
        checkoutNotes: notes,
        ...checks,
        depositCollected,
        damages,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "خطایی رخ داد.");
    router.refresh();
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      {/* تطبیق مدارک — استوری ۰.۲ */}
      <section className="card p-5">
        <h2 className="text-[15px] font-bold">تطبیق مدارک</h2>
        <p className="mt-1 text-[12px] text-ink-3">
          اصل مدارک را با اطلاعات ثبت‌شده مقایسه کنید. بدون این تأیید، سفر فعال نمی‌شود.
        </p>

        <div className="mt-4 grid gap-3 text-[13px] sm:grid-cols-2">
          <Info label="نام راننده" value={driver.name} />
          <Info label="کد ملی" value={driver.nationalId} mono />
          <Info label="شماره گواهینامه" value={driver.licenseNumber} mono />
          <Info label="انقضای گواهینامه" value={driver.licenseExpiry ?? "—"} mono />
        </div>

        <div className="mt-4 flex flex-col gap-2 text-[13px]">
          {([
            ["licenseChecked", "اصل گواهینامه رؤیت و با اطلاعات بالا تطبیق داده شد"],
            ["idChecked", "اصل کارت ملی رؤیت و با اطلاعات بالا تطبیق داده شد"],
            ["contractSigned", "قرارداد چاپی امضا شد"],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex cursor-pointer items-start gap-2.5">
              <input type="checkbox" className="mt-1" checked={checks[key]}
                onChange={(e) => setChecks({ ...checks, [key]: e.target.checked })} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </section>

      {/* ودیعه */}
      {depositAmount ? (
        <section className="card p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[15px] font-bold">ودیعه</h2>
            <b className="text-[17px]">{depositAmount.toLocaleString("fa-IR")} تومان</b>
          </div>
          <label className="mt-3 flex cursor-pointer items-start gap-2.5 text-[13px]">
            <input type="checkbox" className="mt-1" checked={depositCollected}
              onChange={(e) => setDepositCollected(e.target.checked)} />
            <span>ودیعه دریافت شد</span>
          </label>
        </section>
      ) : (
        <div className="blk blk-warn">
          <h4>ودیعه تعیین نشده</h4>
          <p>برای این خودرو ارزش روز ثبت نشده، پس مبلغ ودیعه محاسبه نشده است.</p>
        </div>
      )}

      {/* برگه وضعیت پایه — اپیک ۱ */}
      <section className="card p-5">
        <h2 className="text-[15px] font-bold">برگه وضعیت خودرو</h2>
        <p className="mt-1 max-w-[70ch] text-[12px] text-ink-3">
          مبنای بررسی خسارت در پایان سفر یا در صورت حادثه، همین برگه است.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">کیلومتر اولیه</label>
            <input className="input mono" inputMode="numeric" placeholder="000000"
              value={odometer} onChange={(e) => setOdometer(e.target.value)} />
          </div>
          <div>
            <label className="label">سطح سوخت</label>
            <select className="input mono" value={fuel} onChange={(e) => setFuel(e.target.value)}>
              {FUEL.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label className="label">یادداشت کلی</label>
          <textarea className="input h-16" value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="هر نکته‌ای که در فهرست خسارت نمی‌گنجد" />
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <b className="text-[13px]">خسارت‌های موجود</b>
            <span className="badge">{damages.length ? `${damages.length} مورد` : "موردی ثبت نشده"}</span>
          </div>

          {damages.length > 0 && (
            <div className="mb-3 flex flex-col gap-1.5">
              {damages.map((d, i) => (
                <div key={i} className="flex items-center justify-between rounded border border-line px-3 py-2 text-[13px]">
                  <span>{d.title}{d.location ? ` — ${d.location}` : ""}</span>
                  <button type="button" className="btn btn-text text-[12px]"
                    onClick={() => setDamages(damages.filter((_, j) => j !== i))}>حذف</button>
                </div>
              ))}
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-[1.4fr_1fr_auto]">
            <input className="input" placeholder="مثلاً خش سطحی" value={dTitle}
              onChange={(e) => setDTitle(e.target.value)} />
            <input className="input" placeholder="محل، مثلاً درب عقب راست" value={dLocation}
              onChange={(e) => setDLocation(e.target.value)} />
            <button type="button" className="btn" onClick={addDamage}>افزودن</button>
          </div>
        </div>
      </section>

      {error && <div className="blk blk-danger text-[13px] text-danger">{error}</div>}

      <div>
        <button onClick={submit} disabled={busy || !ready} className="btn btn-primary btn-lg">
          {busy ? "…" : "ثبت تحویل و شروع اجاره"}
        </button>
        <p className="mt-2 text-[12px] text-ink-3">
          {ready ? "وضعیت رزرو: تأییدشده ← در حال اجاره" : "برای فعال شدن دکمه، همه تأییدها و کیلومتر لازم است."}
        </p>
      </div>
    </div>
  );
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded border border-line px-3 py-2">
      <div className="text-[11px] text-ink-3">{label}</div>
      <div className={`font-semibold ${mono ? "mono" : ""}`}>{value}</div>
    </div>
  );
}