"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * ثبت روش واقعی بازگرداندن خودرو — بعد از هماهنگی تلفنی اپراتور با مستأجر.
 * انتخاب بین این دو گزینه به کاربر داده نمی‌شود؛ اپراتور روش نهایی را ثبت می‌کند.
 */
export default function RecoveryMethodPicker({
  code,
  current,
}: {
  code: string;
  current: "user_delivers" | "agent_pickup" | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function set(method: "user_delivers" | "agent_pickup") {
    setBusy(true);
    const res = await fetch(`/api/staff/incidents/${code}/recovery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recoveryMethod: method }),
    });
    setBusy(false);
    if (!res.ok) return alert((await res.json()).error ?? "خطایی رخ داد.");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button onClick={() => set("user_delivers")} disabled={busy}
        className={`chip ${current === "user_delivers" ? "chip-on" : ""}`}>
        مستأجر خودرو را تحویل می‌دهد
      </button>
      <button onClick={() => set("agent_pickup")} disabled={busy}
        className={`chip ${current === "agent_pickup" ? "chip-on" : ""}`}>
        مأمور شرکت اعزام می‌شود
      </button>
    </div>
  );
}
