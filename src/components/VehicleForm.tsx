"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type V = {
  id?: number; plate: string; brand: string; model: string; year: string;
  vehicleClass: string; transmission: string; fuelType: string; seats: string;
  dailyRate: string; dailyKmLimit: string; extraKmRate: string; marketValue: string;
};
const EMPTY: V = {
  plate: "", brand: "", model: "", year: "1402", vehicleClass: "economy",
  transmission: "automatic", fuelType: "petrol", seats: "5",
  dailyRate: "", dailyKmLimit: "250", extraKmRate: "", marketValue: "",
};

export default function VehicleForm({ initial }: { initial?: V }) {
  const router = useRouter();
  const [v, setV] = useState<V>(initial ?? EMPTY);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isEdit = Boolean(initial?.id);

  const set = (k: keyof V) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setV({ ...v, [k]: e.target.value });

  async function submit() {
    setBusy(true); setError("");
    const res = await fetch(isEdit ? `/api/vehicles/${initial!.id}` : "/api/vehicles", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(v),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "خطایی رخ داد.");
    router.push("/manager/fleet");
    router.refresh();
  }

  return (
    <div className="max-w-2xl rounded border border-line p-5">
      <div className="mb-3.5 grid gap-3.5 sm:grid-cols-3">
        <div><label className="label">پلاک</label><input className="input mono" placeholder="۱۲ ج ۳۴۵ — ۶۷" value={v.plate} onChange={set("plate")} /></div>
        <div><label className="label">برند</label><input className="input" placeholder="پژو" value={v.brand} onChange={set("brand")} /></div>
        <div><label className="label">مدل</label><input className="input" placeholder="۲۰۷ اتوماتیک" value={v.model} onChange={set("model")} /></div>
      </div>

      <div className="mb-3.5 grid gap-3.5 sm:grid-cols-3">
        <div><label className="label">سال</label><input className="input mono" value={v.year} onChange={set("year")} /></div>
        <div>
          <label className="label">کلاس</label>
          <select className="input" value={v.vehicleClass} onChange={set("vehicleClass")}>
            <option value="economy">اقتصادی</option><option value="standard">استاندارد</option>
            <option value="suv">شاسی‌بلند</option><option value="luxury">لوکس</option>
          </select>
        </div>
        <div><label className="label">ظرفیت</label><input className="input mono" value={v.seats} onChange={set("seats")} /></div>
      </div>

      <div className="mb-3.5 grid gap-3.5 sm:grid-cols-2">
        <div>
          <label className="label">گیربکس</label>
          <select className="input" value={v.transmission} onChange={set("transmission")}>
            <option value="automatic">اتوماتیک</option><option value="manual">دنده‌ای</option>
          </select>
        </div>
        <div>
          <label className="label">نوع سوخت</label>
          <select className="input" value={v.fuelType} onChange={set("fuelType")}>
            <option value="petrol">بنزینی</option><option value="diesel">دیزلی</option><option value="hybrid">هیبرید</option>
          </select>
        </div>
      </div>

      <h3 className="mb-3 mt-5 border-b border-line-2 pb-2 text-[13px] font-bold">قیمت و محدودیت</h3>
      <div className="grid gap-3.5 sm:grid-cols-3">
        <div><label className="label">اجاره روزانه (تومان)</label><input className="input mono" placeholder="2500000" value={v.dailyRate} onChange={set("dailyRate")} /></div>
        <div><label className="label">سقف کیلومتر روزانه</label><input className="input mono" value={v.dailyKmLimit} onChange={set("dailyKmLimit")} /></div>
        <div><label className="label">نرخ کیلومتر اضافه (تومان)</label><input className="input mono" placeholder="5000" value={v.extraKmRate} onChange={set("extraKmRate")} /></div>
      </div>
    
      <div className="mt-3.5 grid gap-3.5 sm:grid-cols-3">
        <div>
          <label className="label">ارزش روز خودرو (تومان)</label>
          <input className="input mono" placeholder="500000000" value={v.marketValue} onChange={set("marketValue")} />
        </div>
      </div>

      {isEdit && (
        <p className="mt-3.5 rounded bg-white p-3 text-[11px] text-signal">
          تغییر نرخ فقط روی رزروهای جدید اثر دارد؛ مبلغ رزروهای ثبت‌شده تغییر نمی‌کند.
        </p>
      )}

      {error && <p className="mt-3 text-xs text-danger">{error}</p>}

      <button onClick={submit} disabled={busy} className="btn btn-primary btn-lg mt-4">
        {busy ? "…" : isEdit ? "ذخیره تغییرات" : "افزودن به ناوگان"}
      </button>
    </div>
  );
}
