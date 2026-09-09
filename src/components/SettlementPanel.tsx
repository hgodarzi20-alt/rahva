"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { settleDeposit } from "@/lib/settlement";
import { toman } from "@/lib/format";

/**
 * تسویه نهایی پرونده — استوری ۶.۱.
 * ارقام همین‌جا با همان تابع سرور محاسبه و پیش‌نمایش داده می‌شوند،
 * ولی تصمیم نهایی و ثبت رکوردها فقط در سرور انجام می‌شود.
 */
export default function SettlementPanel({
  code,
  damageTotal,
  rentalCreditTotal,
  depositAmount,
  refundIban,
  refundBankName,
}: {
  code: string;
  damageTotal: number;
  rentalCreditTotal: number;
  depositAmount: number;
  refundIban: string | null;
  refundBankName: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const r = settleDeposit({ damageTotal, rentalCreditTotal, depositAmount });
  const totalPayout = r.depositRefund + r.rentalCreditPayout;
  const needsIban = totalPayout > 0;
  const blocked = needsIban && !refundIban;

  async function settle() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/staff/incidents/${code}/settle`, { method: "POST" });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "خطایی رخ داد.");
    router.refresh();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <section className="card p-5">
        <b className="text-[13px]">تسویه از دو منبع</b>
        <p className="mt-1.5 text-[12px] text-ink-3">
          اقلام خسارت از ودیعه تسویه می‌شود و اعتبار روزهای استفاده‌نشده از پرداخت
          اولیه اجاره. این دو با هم خالص نمی‌شوند.
        </p>

        <div className="mt-4 overflow-hidden rounded border border-line">
          <table className="w-full text-[13px]">
            <tbody>
              <tr className="border-b border-line-2">
                <td className="p-3 text-ink-2">ودیعه وصول‌شده</td>
                <td className="mono p-3 text-left">{toman(depositAmount)}</td>
              </tr>
              <tr className="border-b border-line-2">
                <td className="p-3 text-ink-2">سهم مستأجر از خسارت</td>
                <td className="mono p-3 text-left">{toman(damageTotal)}</td>
              </tr>
              <tr className="border-b border-line-2">
                <td className="p-3 text-ink-2">کسر از ودیعه</td>
                <td className="mono p-3 text-left">{toman(r.deductedFromDeposit)}</td>
              </tr>
              <tr className="border-b border-line-2">
                <td className="p-3">استرداد ودیعه</td>
                <td className="mono p-3 text-left text-ok">{toman(r.depositRefund)}</td>
              </tr>
              {r.rentalCreditPayout > 0 && (
                <tr className="border-b border-line-2">
                  <td className="p-3">اعتبار روزهای استفاده‌نشده</td>
                  <td className="mono p-3 text-left text-ok">{toman(r.rentalCreditPayout)}</td>
                </tr>
              )}
              <tr className="bg-line-2">
                <td className="p-3 font-bold">جمع واریز به مستأجر</td>
                <td className="mono p-3 text-left font-bold">{toman(totalPayout)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {r.shortfall > 0 && (
          <div className="blk blk-warn mt-4">
            <h4>بدهی باقی‌مانده</h4>
            <p>
              سهم مستأجر از ودیعه بیشتر است. ودیعه کاملاً کسر می‌شود و مبلغ{" "}
              {toman(r.shortfall)} تومان بدهی باقی می‌ماند که خارج از این سامانه
              پیگیری می‌شود.
            </p>
          </div>
        )}

        {blocked && (
          <div className="blk blk-warn mt-4">
            <h4>شبا ثبت نشده</h4>
            <p>بدون شماره شبای مستأجر امکان صدور دستور واریز وجود ندارد.</p>
          </div>
        )}

        {error && <p className="error-text">{error}</p>}

        <div className="mt-5">
          <button onClick={settle} disabled={busy || blocked} className="btn btn-primary">
            {busy ? "…" : "تسویه نهایی و صدور دستور واریز"}
          </button>
        </div>
        <p className="mt-2 text-[12px] text-ink-3">
          پس از تسویه، پرونده بسته‌شدنی می‌شود و این عملیات برگشت‌پذیر نیست.
        </p>
      </section>

      <aside className="card self-start p-5">
        <b className="text-[13px]">حساب مقصد</b>
        {refundIban ? (
          <>
            <p className="mono mt-2 text-[13px]">{refundIban}</p>
            <p className="mt-1 text-[12px] text-ink-3">{refundBankName ?? "—"}</p>
          </>
        ) : (
          <p className="mt-2 text-[12px] text-ink-3">در زمان رزرو ثبت نشده است.</p>
        )}

        <div className="my-4 h-px bg-line-2" />
        <b className="text-[13px]">وضعیت نهایی ودیعه</b>
        <p className="mt-2 text-[12px] leading-6 text-ink-2">
          {r.depositStatus === "fully_refunded"
            ? "سهم مستأجر صفر است و کل ودیعه مسترد می‌شود."
            : r.depositStatus === "partially_refunded"
              ? "بخشی از ودیعه بابت خسارت کسر و مابقی مسترد می‌شود."
              : "ودیعه کاملاً بابت خسارت کسر می‌شود."}
        </p>
      </aside>
    </div>
  );
}