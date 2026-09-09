"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toman } from "@/lib/format";

interface Draft { title: string; estimateAmount: string }

/**
 * بازرسی مقایسه‌ای — استوری ۵.۱.
 * اقلام «از قبل» فقط نمایش داده می‌شوند؛ اپراتور اقلام جدید را با
 * مبلغ برآوردی ثبت می‌کند و مجموعشان برآورد کل را می‌سازد.
 */
export default function InspectionForm({
  code,
  priorDamages,
}: {
  code: string;
  priorDamages: { title: string; location: string }[];
}) {
  const router = useRouter();
  const [items, setItems] = useState<Draft[]>([]);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [fault, setFault] = useState<"self" | "other_party" | "unknown" | "">("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const gross = items.reduce((s, i) => s + (Number(i.estimateAmount) || 0), 0);

  function add() {
    if (!title.trim() || !(Number(amount) > 0)) {
      return setError("فیلد خسارت و مبلغ برآوردی هر قلم لازم است.");
    }
    setError("");
    setItems([...items, { title: title.trim(), estimateAmount: amount }]);
    setTitle(""); setAmount("");
  }

  async function submit() {
    // ردیف نیمه‌پرشده‌ای که «افزودن» نخورده را هم قبل از ثبت لحاظ کن
    const pending = title.trim() && Number(amount) > 0
      ? [{ title: title.trim(), estimateAmount: amount }] : [];
    const list = [...items, ...pending];

    if (!list.length) return setError("حداقل یک قلم خسارت ثبت کنید.");
    if (!fault) return setError("مقصر حادثه را تعیین کنید.");
    if (pending.length) { setItems(list); setTitle(""); setAmount(""); }
    setBusy(true); setError("");
    const res = await fetch(`/api/staff/incidents/${code}/inspection`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirmedFault: fault,
        damages: list.map((i) => ({ ...i, estimateAmount: Number(i.estimateAmount) })),
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "خطایی رخ داد.");
    router.refresh();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="card p-5">
        <div className="flex items-center justify-between">
          <b className="text-[13px]">وضعیت پایه — هنگام تحویل</b>
          <span className="badge">تأیید کاربر دارد</span>
        </div>
        {priorDamages.length ? (
          <div className="mt-3 flex flex-col gap-1.5">
            {priorDamages.map((d, i) => (
              <div key={i} className="flex items-center justify-between rounded border border-line px-3 py-2 text-[13px]">
                <span>{d.title}{d.location ? ` — ${d.location}` : ""}</span>
                <span className="badge">از قبل</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-[13px] text-ink-3">در زمان تحویل خسارتی ثبت نشده بود.</p>
        )}
      </section>

      <section className="card p-5">
        <div className="flex items-center justify-between">
          <b className="text-[13px]">برآورد کارشناسی خسارت</b>
          <span className="badge badge-danger">{items.length ? `${items.length} مورد` : "ثبت نشده"}</span>
        </div>

        {items.length > 0 && (
          <div className="mt-3 flex flex-col gap-1.5">
            {items.map((d, i) => (
              <div key={i} className="flex items-center gap-2 rounded border border-line px-3 py-2 text-[13px]">
                <span className="flex-1">{d.title}</span>
                <span className="mono">{toman(Number(d.estimateAmount))}</span>
                <button className="btn btn-text text-[12px]"
                  onClick={() => setItems(items.filter((_, j) => j !== i))}>حذف</button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 grid gap-2 sm:grid-cols-[2fr_1fr_auto]">
          <input className="input" placeholder="فیلد خسارت — مثلاً: آسیب به درب راست" value={title} onChange={(e) => setTitle(e.target.value)} />
          <input className="input mono" inputMode="numeric" placeholder="برآورد تعمیر"
            value={amount} onChange={(e) => setAmount(e.target.value)} />
          <button className="btn" onClick={add}>افزودن</button>
        </div>

        <div className="mt-4 flex items-baseline justify-between border-t border-line pt-3">
          <b className="text-[13px]">جمع برآورد کارشناسی</b>
          <b className="text-[17px]">{toman(gross)}</b>
        </div>
        <p className="hint">از مجموع اقلام محاسبه می‌شود و قابل ورود دستی نیست.</p>

        <div className="mt-4">
          <label className="label">مقصر تأییدشده</label>
          <div className="flex flex-wrap gap-2">
            {([["other_party", "طرف مقابل"], ["self", "مستأجر"], ["unknown", "نامشخص"]] as const).map(([v, l]) => (
              <button key={v} onClick={() => setFault(v)} className={`chip ${fault === v ? "chip-on" : ""}`}>{l}</button>
            ))}
          </div>
          <p className="hint">مبنای مسیر مالی صورت‌حساب است، نه ادعای کاربر.</p>
        </div>

        {error && <p className="error-text">{error}</p>}

        <button onClick={submit} disabled={busy} className="btn btn-primary btn-lg mt-4">
          {busy ? "در حال ثبت…" : "ثبت بازرسی و ادامه به صورت‌حساب"}
        </button>
      </section>
    </div>
  );
}
