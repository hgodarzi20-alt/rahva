"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toman } from "@/lib/format";

/**
 * رسیدگی مدیر به اعتراض — استوری ۶.۲.
 * دو تصمیم: رد یا قبول. در حالت قبول، اقلام مورد اعتراض حذف می‌شوند.
 * مبلغ دستی تغییر نمی‌کند؛ یا قلم می‌ماند یا نمی‌ماند.
 */
export default function DisputeResolver({
  code,
  items,
  disputedIds,
}: {
  code: string;
  items: { id: number; label: string; amount: number; basis: string | null }[];
  disputedIds: number[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<number[]>(disputedIds);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const disputed = items.filter((i) => disputedIds.includes(i.id));
  const removedTotal = items
    .filter((i) => selected.includes(i.id))
    .reduce((s, i) => s + i.amount, 0);

  function toggle(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((n) => n !== id) : [...prev, id]));
  }

  async function submit(action: "accept" | "reject") {
    if (note.trim().length < 10) {
      return setError("دلیل تصمیم را کامل‌تر بنویسید.");
    }
    setBusy(true);
    setError("");
    const res = await fetch(`/api/manager/incidents/${code}/dispute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        managerNote: note.trim(),
        ...(action === "accept" ? { removeItemIds: selected } : {}),
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "خطایی رخ داد.");
    router.refresh();
  }

  return (
    <div className="mt-4 border-t border-line-2 pt-4">
      <b className="text-[13px]">اقلام مورد اعتراض</b>

      {disputed.length === 0 ? (
        <p className="mt-2 text-[12px] text-ink-3">
          کاربر قلم مشخصی را نام نبرده و به کل صورت‌حساب اعتراض کرده است.
        </p>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          {disputed.map((i) => (
            <label
              key={i.id}
              className="flex cursor-pointer items-start justify-between gap-3 rounded border border-line p-2.5 text-[13px]"
            >
              <span className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected.includes(i.id)}
                  onChange={() => toggle(i.id)}
                />
                <span>
                  {i.label}
                  {i.basis && <span className="block text-[11px] text-ink-3">{i.basis}</span>}
                </span>
              </span>
              <span className="mono">{toman(i.amount)}</span>
            </label>
          ))}
        </div>
      )}

      {selected.length > 0 && (
        <p className="mt-2 text-[12px] text-ink-3">
          با پذیرش اعتراض، {toman(removedTotal)} تومان از صورت‌حساب حذف می‌شود.
        </p>
      )}

      <div className="mt-4">
        <label className="label">دلیل تصمیم</label>
        <textarea
          className="input"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="مبنای پذیرش یا رد اعتراض را بنویسید."
        />
        <p className="hint">این متن در پرونده ثبت می‌شود و قابل تغییر نیست.</p>
      </div>

      {error && <p className="error-text">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-2.5">
        <button onClick={() => submit("reject")} disabled={busy} className="btn">
          رد اعتراض
        </button>
        <button
          onClick={() => submit("accept")}
          disabled={busy || selected.length === 0}
          className="btn btn-primary"
        >
          {busy ? "…" : "پذیرش و حذف اقلام"}
        </button>
      </div>
      <p className="mt-2 text-[12px] text-ink-3">
        پس از ثبت، پرونده برای تسویه به اپراتور برمی‌گردد. تصمیم نهایی است.
      </p>
    </div>
  );
}
