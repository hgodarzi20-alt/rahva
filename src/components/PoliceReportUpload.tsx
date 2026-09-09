"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * آپلود نسخه کروکی از صفحه پرونده — استوری ۴.۲ بند ۳.
 * کاربر کروکی را در صحنه گرفته ولی نسخه‌اش را بعداً از راهور می‌گیرد،
 * پس باید بتواند بیرون از جریان مستندسازی هم فایل را اضافه کند.
 */
export default function PoliceReportUpload({ code }: { code: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setBusy(true); setError("");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/incidents/${code}/police-report`, { method: "POST", body: fd });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "آپلود ناموفق بود.");
    router.refresh();
  }

  return (
    <>
      <label className="btn btn-primary btn-sm mt-3 cursor-pointer">
        <input type="file" accept="image/*,application/pdf" className="hidden"
          onChange={(e) => upload(e.target.files)} />
        {busy ? "در حال آپلود…" : "آپلود کروکی"}
      </label>
      {error && <p className="error-text">{error}</p>}
    </>
  );
}
