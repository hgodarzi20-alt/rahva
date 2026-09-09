"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Step = "safety" | "emergency" | "scene" | "type" | "drivable" | "location" | "done";

/**
 * جریان ثبت حادثه — شش گام.
 * تک‌ستونی، دکمه‌های بزرگ، بدون ناوبری: کاربر مضطرب است و
 * احتمالاً در فضای باز با گوشی در دست.
 */
export default function IncidentWizard({
  bookingId,
  vehicleLabel,
}: {
  bookingId: number;
  vehicleLabel: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("safety");
  const [type, setType] = useState<"vehicle_collision" | "obstacle_collision" | null>(null);
  const [isDrivable, setIsDrivable] = useState<boolean | null>(null);
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [tracking, setTracking] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const stepNumber = { safety: 1, emergency: 1, scene: 1, type: 2, drivable: 2, location: 3, done: 3 }[step];

  function locate() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setError("دسترسی به موقعیت مکانی امکان‌پذیر نبود. نشانی را دستی بنویسید."),
    );
  }

  async function submit(hasInjury: boolean) {
    setBusy(true); setError("");
    const res = await fetch("/api/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bookingId, hasInjury, type, isDrivable,
        latitude: coords?.lat ?? null, longitude: coords?.lng ?? null,
        address: address || null,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "خطایی رخ داد.");
    if (hasInjury) { setTracking(data.trackingCode); setStep("emergency"); return; }
    router.push(`/incident/${data.trackingCode}`);
  }

  return (
    <div className="min-h-screen bg-white">
      {/* هدر حداقلی — ناوبری اصلی عمداً حذف شده */}
      <header className="border-b border-line">
        <div className="mx-auto flex h-14 max-w-[560px] items-center gap-3 px-5">
          <button onClick={() => router.back()} className="text-[18px] text-ink-2">→</button>
          <b className="text-[15px]">گزارش حادثه</b>
          <a href="tel:02191000000" className="mr-auto text-[13px] font-semibold text-danger">
            تماس با پشتیبانی
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-[560px] px-5 py-6">
        {step !== "emergency" && step !== "safety" && (
          <div className="mb-6">
            <div className="mb-2 text-[11px] text-ink-3">گام {stepNumber} از ۳</div>
            <div className="h-1 rounded bg-line">
              <span className="block h-1 rounded bg-accent" style={{ width: `${(stepNumber / 3) * 100}%` }} />
            </div>
          </div>
        )}

        {step === "safety" && (
          <>
            <h1 className="text-[24px] font-bold leading-relaxed">آیا کسی مصدوم شده است؟</h1>
            <p className="mt-3 text-[15px] text-ink-2">
              پیش از هر چیز، از سلامت خودتان و سرنشینان مطمئن شوید.
            </p>
            <div className="mt-7 flex flex-col gap-3">
              <button onClick={() => submit(true)} disabled={busy}
                className="w-full rounded border border-danger bg-danger px-6 py-4 text-base font-bold text-white">
                بله، مصدوم داریم
              </button>
              <button onClick={() => setStep("scene")} className="btn btn-lg">
                نه، کسی آسیب ندیده
              </button>
            </div>
            <p className="mt-6 text-[12px] text-ink-3">{vehicleLabel}</p>
          </>
        )}

        {step === "emergency" && (
          <>
            <div className="-mx-5 -mt-6 bg-danger px-5 py-7 text-white">
              <h1 className="text-[24px] font-bold">همین حالا تماس بگیرید</h1>
              <p className="mt-2.5 text-[15px] opacity-90">
                رسیدگی به مصدوم مقدم بر هر کار دیگری است. ثبت گزارش می‌تواند بعداً انجام شود.
              </p>
              <a href="tel:115" className="mt-5 flex items-center justify-between rounded bg-white px-4 py-4 text-danger">
                <span><b className="text-[22px]">۱۱۵</b><span className="mr-2 text-[13px]">اورژانس</span></span>
                <span className="text-[20px]">📞</span>
              </a>
              <a href="tel:110" className="mt-3 flex items-center justify-between rounded bg-white px-4 py-4 text-danger">
                <span><b className="text-[22px]">۱۱۰</b><span className="mr-2 text-[13px]">پلیس</span></span>
                <span className="text-[20px]">📞</span>
              </a>
            </div>

            <div className="mt-6 card p-4">
              <div className="flex items-center justify-between">
                <b className="text-[13px]">پرونده ثبت شد</b>
                <span className="badge badge-danger">مصدوم دارد</span>
              </div>
              <p className="mt-2 text-[13px] text-ink-2">
                کد پیگیری: <b className="mono">{tracking}</b>
              </p>
              <p className="mt-1.5 text-[13px] text-ink-3">
                پشتیبانی رهوا مطلع شد و به‌زودی با شما تماس می‌گیرد. لازم نیست فرمی پر کنید.
              </p>
            </div>

            <a href="tel:02191000000" className="btn btn-lg mt-4">تماس با پشتیبانی رهوا</a>
          </>
        )}

        {step === "scene" && (
          <>
            <h1 className="text-[21px] font-bold">پیش از ادامه، این کارها را انجام دهید</h1>

            <div className="mt-5 flex flex-col gap-2.5">
              <a href="tel:110" className="flex items-center gap-3 rounded border border-line px-4 py-3.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-accent-ring text-[13px] font-bold">۱</span>
                <span className="flex-1">
                  <b className="text-[13px]">با پلیس تماس بگیرید — ۱۱۰</b>
                  <span className="block text-[12px] text-ink-3">برای تنظیم کروکی یا گزارش انتظامی</span>
                </span>
                <span className="text-ink-3">📞</span>
              </a>
              <a href="tel:02191000000" className="flex items-center gap-3 rounded border border-line px-4 py-3.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-accent-ring text-[13px] font-bold">۲</span>
                <span className="flex-1">
                  <b className="text-[13px]">با پشتیبانی رهوا تماس بگیرید</b>
                  <span className="block text-[12px] text-ink-3">۰۲۱‑۹۱۰۰۰۰۰۰ — ۲۴ ساعته</span>
                </span>
                <span className="text-ink-3">📞</span>
              </a>
            </div>

            <div className="blk blk-warn mt-5">
              <h4>تا رسیدن افسر، این کارها را نکنید</h4>
              <p>
                · صحنه را تغییر ندهید و خودرو را جابه‌جا نکنید<br />
                · با طرف مقابل شخصاً تسویه یا توافق نکنید<br />
                · خودرو را به تعمیرگاه نبرید
              </p>
              <p className="mt-2 text-[11px]">این موارد در قرارداد اجاره شما ذکر شده است.</p>
            </div>

            <button onClick={() => setStep("type")} className="btn btn-primary btn-lg mt-6">
              تماس گرفتم، ادامه می‌دهم
            </button>
          </>
        )}

        {step === "type" && (
          <>
            <h1 className="text-[21px] font-bold">چه اتفاقی افتاد؟</h1>
            <div className="mt-5 flex flex-col gap-3">
              <Choice selected={type === "vehicle_collision"} onClick={() => setType("vehicle_collision")}
                title="برخورد با خودروی دیگر" hint="تصادف با یک وسیله نقلیه دیگر" />
              <Choice selected={type === "obstacle_collision"} onClick={() => setType("obstacle_collision")}
                title="برخورد با مانع ثابت" hint="جدول، دیوار، تیر، درخت یا حیوان" />
            </div>
            <button onClick={() => setStep("drivable")} disabled={!type}
              className="btn btn-primary btn-lg mt-7">ادامه</button>
          </>
        )}

        {step === "drivable" && (
          <>
            <h1 className="text-[21px] font-bold">آیا خودرو قابل رانندگی است؟</h1>
            <p className="mt-2.5 text-[13px] text-ink-3">
              اگر مطمئن نیستید، گزینه دوم را انتخاب کنید. امداد اعزام می‌شود.
            </p>
            <div className="mt-5 flex flex-col gap-3">
              <Choice selected={isDrivable === true} onClick={() => setIsDrivable(true)}
                title="بله، خودرو حرکت می‌کند" hint="می‌توانم با آن رانندگی کنم" />
              <Choice selected={isDrivable === false} onClick={() => setIsDrivable(false)}
                title="خیر، خودرو حرکت نمی‌کند" hint="یا رانندگی با آن خطرناک است" />
            </div>
            <button onClick={() => { setStep("location"); locate(); }} disabled={isDrivable === null}
              className="btn btn-primary btn-lg mt-7">ادامه</button>
          </>
        )}

        {step === "location" && (
          <>
            <h1 className="text-[21px] font-bold">خودرو کجاست؟</h1>

            <div className="mt-4 flex h-36 items-center justify-center rounded-card border border-line bg-line-2">
              {coords ? (
                <span className="h-3.5 w-3.5 rounded-full bg-accent shadow-[0_0_0_6px_rgba(66,75,237,0.2)]" />
              ) : (
                <button onClick={locate} className="btn btn-sm">دریافت موقعیت من</button>
              )}
            </div>
            {coords && <p className="mt-2 text-[12px] text-ok">✓ موقعیت شما دریافت شد</p>}

            <div className="mt-4">
              <label className="label">نشانی</label>
              <input className="input" value={address} onChange={(e) => setAddress(e.target.value)}
                placeholder="مثلاً اتوبان تهران‑کرج، کیلومتر ۱۴" />
            </div>

            {error && <p className="error-text">{error}</p>}

            <button onClick={() => submit(false)} disabled={busy || (!coords && !address)}
              className="btn btn-primary btn-lg mt-6">
              {busy ? "در حال ثبت…" : "ثبت پرونده"}
            </button>
          </>
        )}
      </main>
    </div>
  );
}

function Choice({
  selected, onClick, title, hint,
}: {
  selected: boolean; onClick: () => void; title: string; hint: string;
}) {
  return (
    <button onClick={onClick}
      className={`rounded-card border px-4 py-4 text-right transition ${
        selected ? "border-2 border-accent" : "border-line hover:border-ink-3"
      }`}>
      <b className="text-[15px]">{title}</b>
      <span className="mt-1 block text-[12px] text-ink-3">{hint}</span>
    </button>
  );
}