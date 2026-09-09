"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function PaymentButtons({ bookingId }: { bookingId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function pay(outcome: "success" | "failure") {
    setBusy(true); setError("");
    const res = await fetch(`/api/bookings/${bookingId}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome }),
    });
    const data = await res.json();
    setBusy(false);

    if (res.ok && data.ok) return router.push(`/booking/${data.code}`);
    if (res.ok && !data.ok) return router.push(`/payment/failed?id=${bookingId}`);
    setError(data.error ?? "خطایی رخ داد.");
  }

  return (
    <>
      <div className="flex gap-2.5">
        <button onClick={() => pay("success")} disabled={busy} className="btn btn-primary flex-1">پرداخت موفق</button>
        <button onClick={() => pay("failure")} disabled={busy} className="btn btn-danger flex-1">پرداخت ناموفق</button>
      </div>
      {error && <p className="mt-3 text-xs text-danger">{error}</p>}
    </>
  );
}
