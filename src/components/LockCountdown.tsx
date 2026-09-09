"use client";

import { useEffect, useState } from "react";

export default function LockCountdown({ expiresAt }: { expiresAt: string | null }) {
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setLeft(Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);

  if (left === null) return null;

  const mm = String(Math.floor(left / 60000)).padStart(2, "0");
  const ss = String(Math.floor((left % 60000) / 1000)).padStart(2, "0");
  const expired = left <= 0;

  return (
    <div className={`mb-5 flex items-center rounded border p-3 text-[13px] ${
      expired ? "border-danger-ring bg-white text-danger" : "border-accent-ring bg-white text-ink"}`}>
      <span>{expired ? "مهلت نگهداری خودرو تمام شد. لطفا دوباره جست‌وجو کنید." : "این خودرو برای شما نگه داشته شده است."}</span>
      {!expired && <span className="mono mr-auto font-bold">{mm}:{ss}</span>}
    </div>
  );
}
