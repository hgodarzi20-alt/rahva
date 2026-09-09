"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function StatusToggle({ vehicleId, status }: { vehicleId: number; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const next = status === "maintenance" ? "available" : "maintenance";

  async function toggle(force = false) {
    setBusy(true);
    const res = await fetch(`/api/vehicles/${vehicleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next, force }),
    });
    const data = await res.json();
    setBusy(false);

    if (!res.ok) {
      // هشدار صریح پیش از خروج از دسترس — استوری ۵.۳ بند ۳
      if (data.needsConfirm && confirm(`${data.error}\n\nادامه می‌دهید؟`)) return toggle(true);
      return alert(data.error);
    }
    router.refresh();
  }

  return (
    <button onClick={() => toggle()} disabled={busy} className="btn btn-sm">
      {next === "maintenance" ? "خروج از دسترس" : "بازگشت به ناوگان"}
    </button>
  );
}
