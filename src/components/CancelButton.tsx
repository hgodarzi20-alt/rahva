"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CancelButton({ bookingId }: { bookingId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function cancel() {
    if (!confirm("رزرو لغو شود؟ مبلغ پرداختی به‌طور کامل برمی‌گردد.")) return;
    setBusy(true); setError("");
    const res = await fetch(`/api/bookings/${bookingId}/cancel`, { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "خطایی رخ داد.");
    router.refresh();
  }

  return (
    <div className="text-left">
      <button onClick={cancel} disabled={busy} className="btn btn-danger btn-sm">
        {busy ? "…" : "لغو رزرو"}
      </button>
      {error && <p className="mt-1 max-w-[190px] text-[11px] text-danger">{error}</p>}
    </div>
  );
}
