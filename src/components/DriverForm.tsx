"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { isValidNationalId, validateIban, ageAt, requiredLicenseValidity, toLatinDigits } from "@/lib/identity";
import { formatJalali } from "@/lib/jalali";

export default function DriverForm({
  vehicleId, pickupAt, dropoffAt, minAge, licenseMargin, initial,
}: {
  vehicleId: number;
  pickupAt: string;
  dropoffAt: string;
  minAge: number;
  /** ماه‌های اعتبار لازم گواهینامه پس از پایان اجاره */
  licenseMargin: number;
  initial: { fullName: string; birthDate: string; licenseNumber: string; mobile: string };
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initial.fullName);
  const [birthDate, setBirthDate] = useState(initial.birthDate);
  const [licenseNumber, setLicenseNumber] = useState(initial.licenseNumber);
  const [nationalId, setNationalId] = useState("");
  const [licenseExpiry, setLicenseExpiry] = useState("");
  const [iban, setIban] = useState("");

  const [confirmed, setConfirmed] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);

  /** نام بانک به‌محض معتبر شدن شبا نمایش داده می‌شود */
  const bank = useMemo(() => {
    const r = validateIban(iban);
    return r.ok ? r.bankName : "";
  }, [iban]);

  /** حداقل تاریخ انقضای قابل قبول گواهینامه */
  const minExpiry = useMemo(
    () => requiredLicenseValidity(new Date(dropoffAt), licenseMargin),
    [dropoffAt, licenseMargin],
  );

  function validate() {
    const e: Record<string, string> = {};

    if (!fullName.trim()) e.fullName = "نام راننده را وارد کنید.";

    if (!birthDate) e.birthDate = "تاریخ تولد را وارد کنید.";
    else if (ageAt(new Date(birthDate), new Date(pickupAt)) < minAge) {
      e.birthDate = `حداقل سن مجاز ${minAge} سال است.`;
    }

    if (!isValidNationalId(nationalId)) {
      e.nationalId = "کد ملی معتبر نیست. ارقام را دوباره بررسی کنید.";
    }

    if (!/^\d{6,12}$/.test(toLatinDigits(licenseNumber).trim())) {
      e.licenseNumber = "شماره گواهینامه بین ۶ تا ۱۲ رقم است.";
    }

    if (!licenseExpiry) e.licenseExpiry = "تاریخ انقضای گواهینامه را وارد کنید.";
    else if (new Date(licenseExpiry) < minExpiry) {
      e.licenseExpiry = `اعتبار گواهینامه باید تا ${formatJalali(minExpiry)} باقی باشد.`;
    }

    const ib = validateIban(iban);
    if (!ib.ok) {
      e.iban =
        ib.reason === "format" ? "شبا باید با IR شروع شود و ۲۴ رقم داشته باشد."
        : ib.reason === "checksum" ? "شماره شبا معتبر نیست."
        : "بانک این شبا شناسایی نشد.";
    }

    setFieldErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit() {
    if (!confirmed) return setError("برای ادامه باید صحت اطلاعات را تأیید کنید.");
    if (!validate()) return setError("");

    setBusy(true); setError(""); setBlocked(false);

    const ib = validateIban(iban);
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vehicleId, pickupAt, dropoffAt,
        driverName: fullName,
        driverBirthDate: birthDate,
        driverLicenseNumber: toLatinDigits(licenseNumber).trim(),
        driverNationalId: toLatinDigits(nationalId).replace(/\D/g, ""),
        driverLicenseExpiry: licenseExpiry,
        refundIban: ib.ok ? ib.normalized : iban,
      }),
    });
    const data = await res.json();
    setBusy(false);

    if (!res.ok) {
      setError(data.error ?? "خطایی رخ داد.");
      if (data.eligibility) setBlocked(true);
      return;
    }
    router.push(`/booking/review?id=${data.id}`);
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="card p-5">
        <h2 className="text-[15px] font-bold">مشخصات راننده</h2>
        <p className="mt-1 max-w-[62ch] text-[12px] text-ink-3">
          خودرو فقط به همین فرد تحویل داده می‌شود و رانندگی توسط شخص دیگر مجاز نیست.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="نام و نام خانوادگی" error={fieldErrors.fullName}>
            <input className={`input ${fieldErrors.fullName ? "input-error" : ""}`}
              placeholder="مطابق گواهینامه" value={fullName}
              onChange={(e) => setFullName(e.target.value)} />
          </Field>

          <Field label="شماره موبایل" hint="با شماره‌ی ورود شما یکی است">
            <input className="input input-locked mono" value={initial.mobile} readOnly />
          </Field>

          <Field label="کد ملی" error={fieldErrors.nationalId} hint="۱۰ رقم، بدون خط تیره">
            <input className={`input mono ${fieldErrors.nationalId ? "input-error" : ""}`}
              inputMode="numeric" maxLength={12} placeholder="0000000000"
              value={nationalId} onChange={(e) => setNationalId(e.target.value)} />
          </Field>

          <Field label="تاریخ تولد" error={fieldErrors.birthDate} hint={`حداقل سن مجاز ${minAge} سال است`}>
            <input type="date" className={`input mono ${fieldErrors.birthDate ? "input-error" : ""}`}
              value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
          </Field>

          <Field label="شماره گواهینامه" error={fieldErrors.licenseNumber}>
            <input className={`input mono ${fieldErrors.licenseNumber ? "input-error" : ""}`}
              inputMode="numeric" placeholder="0000000000"
              value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} />
          </Field>

          <Field label="تاریخ انقضای گواهینامه" error={fieldErrors.licenseExpiry}
            hint={`باید تا ${formatJalali(minExpiry)} معتبر باشد`}>
            <input type="date" className={`input mono ${fieldErrors.licenseExpiry ? "input-error" : ""}`}
              value={licenseExpiry} onChange={(e) => setLicenseExpiry(e.target.value)} />
          </Field>
        </div>
      </section>

      <section className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-bold">حساب بازگشت ودیعه</h2>
          <span className="badge">الزامی</span>
        </div>
        <p className="mt-1 max-w-[62ch] text-[12px] text-ink-3">
          ودیعه پس از بازگشت خودرو به همین حساب واریز می‌شود. حساب باید به نام راننده باشد.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-[1.4fr_1fr]">
          <Field label="شماره شبا" error={fieldErrors.iban} hint="۲۴ رقم پس از IR">
            <input className={`input mono ${fieldErrors.iban ? "input-error" : ""}`}
              dir="ltr" placeholder="IR000000000000000000000000"
              value={iban} onChange={(e) => setIban(e.target.value)} />
          </Field>

          <Field label="بانک" hint={bank ? "از روی شبا تشخیص داده شد" : "پس از ورود شبای معتبر"}>
            <input className="input input-locked" value={bank} readOnly />
          </Field>
        </div>
      </section>

      <label className="blk blk-info flex cursor-pointer gap-2.5">
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-1" />
        <span className="text-[13px]">
          تأیید می‌کنم اطلاعات بالا درست است و گواهینامه‌ام معتبر و همراهم خواهد بود.
          <span className="mt-1 block text-[12px] text-ink-3">
            اصل گواهینامه و کارت ملی هنگام تحویل خودرو کنترل می‌شود. رانندگی توسط شخص
            دیگر، پوشش بیمه را باطل می‌کند.
          </span>
        </span>
      </label>

      {error && (
        <div className="blk blk-danger">
          <p className="text-[13px] text-danger">{error}</p>
          {blocked && <p className="mt-1 text-[12px] text-ink-3">این رزرو قابل ادامه نیست.</p>}
        </div>
      )}

      <div>
        <button onClick={submit} disabled={busy || blocked} className="btn btn-primary btn-lg">
          {busy ? "در حال ثبت…" : "ادامه"}
        </button>
      </div>
    </div>
  );
}

function Field({
  label, error, hint, children,
}: {
  label: string; error?: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {error ? <p className="error-text">{error}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}