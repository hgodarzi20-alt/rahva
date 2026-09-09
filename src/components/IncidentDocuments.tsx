"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import JalaliDateInput from "@/components/JalaliDateInput";
import JalaliDateTimeInput from "@/components/JalaliDateTimeInput";

type Step = "photos" | "details" | "police" | "risk";
type PoliceStatus = "uploaded" | "pending" | "not_obtained";
type Photo = { id: number; key: string; hint: string | null };

/**
 * زاویه‌های راهنمایی‌شده — استوری ۴.۱ بند ۱.
 * شش قاب اجباری؛ دو قاب آخر بسته به نوع حادثه فرق می‌کند.
 */
const SLOTS_VEHICLE = [
  { key: "overall_right", label: "نمای کلی از راست" },
  { key: "overall_left", label: "نمای کلی از چپ" },
  { key: "damage_closeup", label: "نمای نزدیک آسیب" },
  { key: "scene_wide", label: "صحنه از فاصله دور" },
  { key: "counterparty_plate", label: "پلاک طرف مقابل" },
  { key: "counterparty_damage", label: "آسیب طرف مقابل" },
] as const;

const SLOTS_OBSTACLE = [
  { key: "overall_right", label: "نمای کلی از راست" },
  { key: "overall_left", label: "نمای کلی از چپ" },
  { key: "damage_closeup", label: "نمای نزدیک آسیب" },
  { key: "scene_wide", label: "صحنه از فاصله دور" },
  { key: "obstacle_closeup", label: "نمای نزدیک مانع" },
  { key: "obstacle_wide", label: "موقعیت مانع نسبت به خودرو" },
] as const;

/** تبدیل Date به قالب ورودی datetime-local در وقت محلی */
function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * تکمیل مستندات — گام ۴ و ۵ جرنی.
 * کاربر معمولاً کنار جاده و منتظر افسر است، پس فرم تکه‌تکه شده
 * و هر گام کوتاه است.
 */
export default function IncidentDocuments({
  code,
  type,
  vehicleLabel,
  initialPhotos,
  pickupAt,
  initialReportKey,
}: {
  code: string;
  type: "vehicle_collision" | "obstacle_collision";
  vehicleLabel: string;
  initialPhotos: Photo[];
  /** زمان تحویل خودرو — حادثه نمی‌تواند پیش از آن رخ داده باشد */
  pickupAt: string;
  /** اگر سند کروکی قبلاً آپلود شده باشد */
  initialReportKey: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("photos");

  const slots = type === "vehicle_collision" ? SLOTS_VEHICLE : SLOTS_OBSTACLE;
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos);
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);

  const [occurredAt, setOccurredAt] = useState(toLocalInput(new Date()));
  const [description, setDescription] = useState("");
  const [fault, setFault] = useState<"self" | "other_party" | "unknown">("unknown");

  // طرف مقابل — فقط در تصادف با خودرو
  const [cp, setCp] = useState({
    fullName: "", phone: "", plateNumber: "",
    insurerName: "", policyNumber: "", policyValidTo: "",
  });

  // مانع — فقط در برخورد با مانع ثابت
  const [ownership, setOwnership] = useState<"unowned" | "third_party">("unowned");
  const [ownerNote, setOwnerNote] = useState("");

  const [police, setPolice] = useState<PoliceStatus | null>(null);
  const [reportFile, setReportFile] = useState(initialReportKey);
  const [uploadingReport, setUploadingReport] = useState(false);
  const [riskAccepted, setRiskAccepted] = useState(false);
  const [impounded, setImpounded] = useState<boolean | null>(null);

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const bySlot = useMemo(() => {
    const map: Record<string, Photo | undefined> = {};
    for (const p of photos) if (p.hint) map[p.hint] = p;
    return map;
  }, [photos]);

  const extras = photos.filter((p) => !p.hint || !slots.some((s) => s.key === p.hint));
  const filledSlots = slots.filter((s) => bySlot[s.key]).length;
  const photosReady = filledSlots === slots.length;

  const occurredError = (() => {
    if (!occurredAt) return "تاریخ و ساعت حادثه را وارد کنید.";
    const t = new Date(occurredAt).getTime();
    if (Number.isNaN(t)) return "تاریخ و ساعت معتبر نیست.";
    if (t > Date.now() + 60_000) return "زمان حادثه نمی‌تواند در آینده باشد.";
    if (t < new Date(pickupAt).getTime()) return "زمان حادثه نمی‌تواند پیش از تحویل خودرو باشد.";
    return "";
  })();

  async function upload(files: FileList | null, hint: string | null) {
    if (!files?.length) return;
    setUploadingSlot(hint ?? "extra"); setError("");

    // قاب پرشده جایگزین می‌شود، نه اینکه دو عکس روی هم بنشیند
    const existing = hint ? bySlot[hint] : undefined;
    if (existing) await removePhoto(existing.id, true);

    const fd = new FormData();
    Array.from(files).forEach((f) => fd.append("files", f));
    if (hint) fd.append("hint", hint);

    const res = await fetch(`/api/incidents/${code}/photos`, { method: "POST", body: fd });
    const data = await res.json();
    setUploadingSlot(null);
    if (!res.ok) return setError(data.error ?? "آپلود ناموفق بود.");
    setPhotos((prev) => [...prev, ...(data.photos as Photo[])]);
  }

  async function removePhoto(id: number, silent = false) {
    const res = await fetch(`/api/incidents/${code}/photos/${id}`, { method: "DELETE" });
    if (!res.ok) {
      if (!silent) {
        const d = await res.json();
        setError(d.error ?? "حذف ناموفق بود.");
      }
      return;
    }
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  }

  async function uploadReport(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setUploadingReport(true); setError("");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/incidents/${code}/police-report`, { method: "POST", body: fd });
    const data = await res.json();
    setUploadingReport(false);
    if (!res.ok) return setError(data.error ?? "آپلود ناموفق بود.");
    setReportFile(data.key as string);
  }

  async function submit() {
    if (occurredError) { setStep("details"); return setError(occurredError); }
    setBusy(true); setError("");
    const res = await fetch(`/api/incidents/${code}/documents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        occurredAt: new Date(occurredAt).toISOString(),
        description,
        faultClaim: fault,
        counterparty: type === "vehicle_collision" ? cp : null,
        obstacle: type === "obstacle_collision" ? { ownership, ownerNote } : null,
        policeReportStatus: police,
        riskAccepted: police === "not_obtained" ? riskAccepted : false,
        policeImpounded: impounded === true,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "خطایی رخ داد.");
    router.push(`/incident/${code}`);
  }

  const stepNumber = { photos: 4, details: 4, police: 5, risk: 5 }[step];

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-line">
        <div className="mx-auto flex h-14 max-w-[560px] items-center gap-3 px-5">
          <button onClick={() => router.back()} className="text-[18px] text-ink-2">→</button>
          <b className="text-[15px]">تکمیل مستندات</b>
          <span className="mono mr-auto text-[12px] text-ink-3">{code}</span>
        </div>
      </header>

      <main className="mx-auto max-w-[560px] px-5 py-6">
        <div className="mb-6">
          <div className="mb-2 text-[11px] text-ink-3">گام {stepNumber} از ۵</div>
          <div className="h-1 rounded bg-line">
            <span className="block h-1 rounded bg-accent" style={{ width: `${(stepNumber / 5) * 100}%` }} />
          </div>
        </div>

        {step === "photos" && (
          <>
            <h1 className="text-[21px] font-bold">عکس‌های حادثه</h1>
            <p className="mt-2 text-[13px] text-ink-3">
              شش عکس زیر لازم است. روی هر قاب بزنید و عکس همان زاویه را بگیرید.
            </p>

            <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {slots.map((slot) => {
                const photo = bySlot[slot.key];
                const loading = uploadingSlot === slot.key;
                return (
                  <div key={slot.key} className="flex flex-col gap-1">
                    <label className={`relative flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-card border text-center ${
                      photo ? "border-line" : "border-dashed border-line"
                    }`}>
                      <input type="file" accept="image/*" capture="environment" className="hidden"
                        onChange={(e) => upload(e.target.files, slot.key)} />
                      {photo ? (
                        <img src={`/api/files?key=${photo.key}`} alt={slot.label}
                          className="h-full w-full object-cover" />
                      ) : (
                        <span className="px-2 text-[11px] leading-5 text-ink-3">
                          {loading ? "در حال آپلود…" : slot.label}
                        </span>
                      )}
                      {photo && (
                        <span className="absolute bottom-1 right-1 rounded bg-white/90 px-1.5 text-[10px] text-ok">✓</span>
                      )}
                    </label>
                    {photo && (
                      <button onClick={() => removePhoto(photo.id)}
                        className="btn btn-text text-[11px]">حذف</button>
                    )}
                    {!photo && <span className="h-[18px]" />}
                  </div>
                );
              })}
            </div>

            {/* عکس‌های اختیاری بیشتر */}
            {extras.length > 0 && (
              <div className="mt-4">
                <b className="text-[13px]">عکس‌های بیشتر</b>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {extras.map((p) => (
                    <div key={p.id} className="relative aspect-square overflow-hidden rounded border border-line">
                      <img src={`/api/files?key=${p.key}`} alt="" className="h-full w-full object-cover" />
                      <button onClick={() => removePhoto(p.id)}
                        className="absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-[13px] text-danger"
                        aria-label="حذف عکس">✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <label className="mt-3 flex h-14 cursor-pointer items-center justify-center rounded-card border border-dashed border-line text-[12px] text-ink-3">
              <input type="file" accept="image/*" multiple capture="environment" className="hidden"
                onChange={(e) => upload(e.target.files, null)} />
              {uploadingSlot === "extra" ? "در حال آپلود…" : "افزودن عکس بیشتر (اختیاری)"}
            </label>

            <p className="mt-3 text-[13px]">
              <b>{filledSlots.toLocaleString("fa-IR")}</b> از {slots.length.toLocaleString("fa-IR")} عکس لازم ثبت شد
            </p>

            {error && <p className="error-text">{error}</p>}

            <button onClick={() => { setError(""); setStep("details"); }} disabled={!photosReady}
              className="btn btn-primary btn-lg mt-5">ادامه</button>
            <p className="mt-3 text-[12px] text-ink-3">{vehicleLabel}</p>
          </>
        )}

        {step === "details" && (
          <>
          <h1 className="text-[21px] font-bold">جزئیات حادثه</h1>

            <div className="mt-5">
              <JalaliDateTimeInput
                label="تاریخ و ساعت حادثه"
                value={occurredAt}
                onChange={setOccurredAt}
              />
              {occurredError
                ? <p className="error-text">{occurredError}</p>
                : <p className="hint">اگر زمان دقیق را نمی‌دانید، نزدیک‌ترین زمان ممکن را بزنید.</p>}
            </div>

            {type === "vehicle_collision" ? (
              <>
                <h2 className="mt-7 text-[15px] font-bold">اطلاعات طرف مقابل</h2>
                <p className="mt-5 text-[13px] text-ink-3">
                  اطلاعات بیمه‌نامه ثالث مهم‌ترین بخش است. بدون آن، امکان مطالبه از مقصر وجود ندارد.
                </p>
                <div className="mt-4 flex flex-col gap-4">
                  <F label="نام و نام خانوادگی">
                    <input className="input" value={cp.fullName} onChange={(e) => setCp({ ...cp, fullName: e.target.value })} />
                  </F>
                  <F label="شماره تماس">
                    <input className="input mono" inputMode="numeric" value={cp.phone} onChange={(e) => setCp({ ...cp, phone: e.target.value })} />
                  </F>
                  <F label="شماره پلاک">
                    <input className="input mono" value={cp.plateNumber} onChange={(e) => setCp({ ...cp, plateNumber: e.target.value })} />
                  </F>
                  <F label="شرکت بیمه">
                    <input className="input" value={cp.insurerName} onChange={(e) => setCp({ ...cp, insurerName: e.target.value })} />
                  </F>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <F label="شماره بیمه‌نامه ثالث">
                      <input className="input mono" value={cp.policyNumber} onChange={(e) => setCp({ ...cp, policyNumber: e.target.value })} />
                    </F>
                                      <JalaliDateInput
                      label="اعتبار بیمه‌نامه"
                      value={cp.policyValidTo}
                      onChange={(v) => setCp({ ...cp, policyValidTo: v })}
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
             <h2 className="mt-7 text-[15px] font-bold">مشخصات مانع</h2>
                <p className="mt-5 text-[13px] text-ink-3">
                  اگر مانع مالک داشته باشد، ممکن است بعداً مطالبه‌ای مطرح شود.
                </p>
                <div className="mt-4 flex flex-col gap-3">
                  <Choice selected={ownership === "unowned"} onClick={() => setOwnership("unowned")}
                    title="مانع بدون مالک مشخص" hint="جدول، درخت، حیوان" />
                  <Choice selected={ownership === "third_party"} onClick={() => setOwnership("third_party")}
                    title="مانع متعلق به شخص یا نهاد دیگر" hint="تیر برق، نرده، دیوار ملک" />
                </div>
                {ownership === "third_party" && (
                  <div className="mt-4">
                    <label className="label">مشخصات مالک، در صورت اطلاع</label>
                    <textarea className="input h-20" value={ownerNote} onChange={(e) => setOwnerNote(e.target.value)} />
                  </div>
                )}
              </>
            )}

            <div className="mt-5">
              <label className="label">شرح ماجرا</label>
              <textarea className="input h-24" value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="به زبان ساده بنویسید چه اتفاقی افتاد" />
            </div>

            <div className="mt-5">
              <label className="label">به نظر شما مقصر کیست؟</label>
              <div className="flex flex-wrap gap-2">
                {([["self", "خودم"], ["other_party", "طرف مقابل"], ["unknown", "مشخص نیست"]] as const).map(([v, l]) => (
                  <button key={v} onClick={() => setFault(v)} className={`chip ${fault === v ? "chip-on" : ""}`}>{l}</button>
                ))}
              </div>
              <p className="hint">این پاسخ ثبت می‌شود ولی تعیین مقصر با کروکی و کارشناس است.</p>
            </div>

            <button onClick={() => { setError(""); setStep("police"); }} disabled={!!occurredError}
              className="btn btn-primary btn-lg mt-6">ادامه</button>
          </>
        )}

        {step === "police" && (
          <>
            <h1 className="text-[21px] font-bold">
              {type === "vehicle_collision" ? "کروکی" : "گزارش انتظامی"}
            </h1>
            <p className="mt-2 text-[13px] text-ink-3">
              بدون این سند، بیمه بدنه خسارت را پرداخت نمی‌کند.
            </p>

            <div className="mt-5 flex flex-col gap-3">
              <Choice selected={police === "uploaded"} onClick={() => setPolice("uploaded")}
                title="تنظیم شد و آن را دارم" hint="تصویرش را در پرونده آپلود می‌کنم" />
              <Choice selected={police === "pending"} onClick={() => setPolice("pending")}
                title="تنظیم شد ولی هنوز نگرفته‌ام" hint="باید برای دریافت نسخه‌اش مراجعه کنم" />
              <Choice selected={police === "not_obtained"} onClick={() => setPolice("not_obtained")}
                title="تنظیم نشد" hint="افسر حاضر نشد یا صحنه را ترک کردم" />
            </div>

            {police && (
              <div className="mt-5">
                <label className="label">آیا پلیس خودرو را به پارکینگ منتقل کرد؟</label>
                <div className="mt-3 flex flex-col gap-3">
                  <Choice selected={impounded === false} onClick={() => setImpounded(false)}
                    title="خیر، خودرو همچنان در اختیار من است"
                    hint="طبق هماهنگی با پشتیبانی، روش بازگرداندن خودرو مشخص می‌شود." />
                  <Choice selected={impounded === true} onClick={() => setImpounded(true)}
                    title="بله، پلیس خودرو را توقیف و به پارکینگ منتقل کرد"
                    hint="پرونده منتظر ترخیص می‌ماند؛ نیازی نیست خودرو را جایی ببرید." />
                </div>
              </div>
            )}

            {police === "uploaded" && (
              <div className="mt-4">
                <label className="label">تصویر کروکی یا گزارش</label>
                <label className="flex h-20 cursor-pointer items-center justify-center rounded-card border border-dashed border-line text-[12px] text-ink-3">
                  <input type="file" accept="image/*,application/pdf" className="hidden"
                    onChange={(e) => uploadReport(e.target.files)} />
                  {uploadingReport ? "در حال آپلود…" : reportFile ? "فایل ثبت شد — برای جایگزینی بزنید" : "افزودن فایل"}
                </label>
                {reportFile && (
                  <a href={`/api/files?key=${reportFile}`} target="_blank" rel="noreferrer"
                    className="link mt-2 inline-block text-[12px]">مشاهده فایل ثبت‌شده</a>
                )}
              </div>
            )}

            {police === "pending" && (
              <div className="blk blk-info mt-4">
                <h4>مهلت ارائه نسخه کروکی</h4>
                <p>پس از ثبت مستندات، مهلتی برای آپلود نسخه کروکی خواهید داشت که در صفحه پرونده نمایش داده می‌شود.</p>
              </div>
            )}

            {error && <p className="error-text">{error}</p>}

            <button
              onClick={() => (police === "not_obtained" ? setStep("risk") : submit())}
              disabled={!police || impounded === null || busy || (police === "uploaded" && !reportFile)}
              className="btn btn-primary btn-lg mt-6"
            >
              {busy ? "در حال ثبت…" : police === "not_obtained" ? "ادامه" : "ثبت نهایی"}
            </button>
            {police === "uploaded" && !reportFile && (
              <p className="mt-2 text-[12px] text-ink-3">برای ادامه، فایل کروکی را آپلود کنید.</p>
            )}
          </>
        )}

        {step === "risk" && (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-danger text-[24px] font-bold text-danger">!</div>
            <h1 className="mt-4 text-[21px] font-bold">بدون کروکی، خسارت بر عهده شماست</h1>

            <div className="blk blk-danger mt-4">
              <p>
                · بدون کروکی یا گزارش انتظامی، بیمه بدنه هیچ مبلغی پرداخت نمی‌کند.<br />
                · مطابق قرارداد اجاره، جبران کامل خسارت بر عهده شماست.<br />
                · اگر خسارت از ودیعه بیشتر باشد، مابه‌التفاوت از شما مطالبه می‌شود.
              </p>
            </div>

            <div className="card mt-3 p-4">
              <b className="text-[13px]">هنوز می‌توانید کروکی بگیرید</b>
              <p className="mt-1.5 text-[13px] text-ink-3">
                اگر همچنان در صحنه هستید، با ۱۱۰ تماس بگیرید و منتظر افسر بمانید.
              </p>
              <a href="tel:110" className="btn btn-sm mt-3">تماس با ۱۱۰</a>
            </div>

            <label className="mt-5 flex cursor-pointer items-start gap-2.5 text-[13px]">
              <input type="checkbox" className="mt-1" checked={riskAccepted}
                onChange={(e) => setRiskAccepted(e.target.checked)} />
              <span>شرایط بالا را خوانده‌ام و مسئولیت مالی کامل خسارت را می‌پذیرم.</span>
            </label>

            {error && <p className="error-text">{error}</p>}

            <button onClick={submit} disabled={!riskAccepted || busy} className="btn btn-primary btn-lg mt-5">
              {busy ? "در حال ثبت…" : "ثبت نهایی پرونده"}
            </button>
          </>
        )}
      </main>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="label">{label}</label>{children}</div>;
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
