"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * پاسخ مستأجر به صورت‌حساب — استوری ۵.۳.
 * حق اعتراض یک بار است، پس پیش از ثبت صریح هشدار داده می‌شود.
 */
export default function EstimateResponse({
  code,
  items,
}: {
  code: string;
  items: { id: number; label: string; amount: number }[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "dispute">("idle");
  const [reason, setReason] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function send(action: "accept" | "dispute") {
    setBusy(true); setError("");
    const res = await fetch(`/api/incidents/${code}/estimate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason, disputedItems: picked }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "خطایی رخ داد.");
    router.refresh();
  }

  if (mode === "idle") {
    return (
      <div className="mt-4">
        {error && <p className="error-text">{error}</p>}
        <div className="flex flex-col gap-2.5">
          <button onClick={() => send("accept")} disabled={busy} className="btn btn-primary btn-lg">
            {busy ? "…" : "تأیید صورت‌حساب"}
          </button>
          <button onClick={() => setMode("dispute")} className="btn btn-lg">اعتراض دارم</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="blk blk-warn">
        <h4>اعتراض یک‌بار ثبت می‌شود</h4>
        <p>پس از ثبت، مدیر بررسی می‌کند و نتیجه نهایی است.</p>
      </div>

      <div className="mt-4">
        <label className="label">به کدام اقلام اعتراض دارید؟</label>
        <div className="flex flex-col gap-1.5">
          {items.map((i) => (
            <label key={i.id} className="flex cursor-pointer items-center gap-2.5 text-[13px]">
              <input type="checkbox" checked={picked.includes(i.id)}
                onChange={(e) =>
                  setPicked(e.target.checked ? [...picked, i.id] : picked.filter((x) => x !== i.id))
                } />
              <span className="flex-1">{i.label}</span>
              <span className="mono text-ink-3">{i.amount.toLocaleString("fa-IR")}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <label className="label">توضیح شما</label>
        <textarea className="input h-24" value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="دلیل اعتراض را بنویسید" />
        <p className="hint">حداقل ۱۰ نویسه</p>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="mt-4 flex gap-2.5">
        <button onClick={() => send("dispute")} disabled={busy || reason.trim().length < 10}
          className="btn btn-primary">{busy ? "…" : "ثبت اعتراض"}</button>
        <button onClick={() => setMode("idle")} className="btn">انصراف</button>
      </div>
    </div>
  );
}
