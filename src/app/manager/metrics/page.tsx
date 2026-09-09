import StaffHeader from "@/components/StaffHeader";
import Sparkline from "@/components/Sparkline";
import { getFunnel, getMetrics, getRevenue, getTrend } from "@/lib/metrics";
import { toFaDigits, toman } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MetricsPage() {
  const [funnel, metrics, trend, revenue] = await Promise.all([getFunnel(30), getMetrics(30), getTrend(30), getRevenue(30)]);
  const top = funnel[0]?.count ?? 0;
  const worst = funnel.reduce((a, b) => ((b.dropFromPrev ?? -1) > (a.dropFromPrev ?? -1) ? b : a), funnel[0]);
  const hasData = top > 0;

  return (
    <>
      <StaffHeader panel="manager" active="/manager/metrics" />
      <main className="p-6">
        <div className="mb-5 flex items-center">
          <div>
            <h1 className="text-[17px] font-bold">شاخص‌های عملکرد</h1>
            <p className="text-[11px] text-ink-3">محاسبه از جدول رویدادها و جداول عملیاتی</p>
          </div>
          <span className="mr-auto rounded border border-line px-3 py-1.5 text-xs text-ink-2">۳۰ روز گذشته</span>
        </div>

        {!hasData ? (
          <div className="rounded border border-dashed border-line p-10 text-center text-ink-3">
            در این بازه رویدادی ثبت نشده است.
          </div>
        ) : (
          <>
            <h2 className="mb-3 border-b border-line-2 pb-2 text-[13px] font-bold">قیف تبدیل</h2>
            {funnel.map((s) => (
              <div key={s.key} className="mb-2 grid grid-cols-[1fr_auto] items-center gap-5">
                <div style={{ width: `${Math.max(12, (s.count / top) * 100)}%` }}>
                  <div className="flex h-9 items-center rounded bg-accent px-3.5 text-[13px] text-white">{s.label}</div>
                </div>
                <div className="min-w-[130px] text-left">
                  <strong className="mono">{toFaDigits(s.count)}</strong>{" "}
                  {s.dropFromPrev !== null && <span className="text-[11px] text-ink-3">−{toFaDigits(s.dropFromPrev)}٪</span>}
                </div>
              </div>
            ))}
            <p className="mt-1.5 text-[11px] text-ink-3">
              بیشترین ریزش پیش از «{worst?.label}» است.
            </p>
            <p className="mb-6 text-[11px] text-ink-3">
              اعداد تجمیعی‌اند و مسیر یک کاربر مشخص را دنبال نمی‌کنند.
            </p>

            <h2 className="mb-3 border-b border-line-2 pb-2 text-[13px] font-bold">کسب‌وکار</h2>
            <div className="mb-6 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded border border-line p-4">
                <div className="text-[11px] text-ink-3">درآمد اجاره</div>
                <div className="my-1 text-2xl font-bold">{toman(revenue.rentRevenue)}</div>
                <div className="text-[11px] text-ink-3">تومان · از {toFaDigits(revenue.completedCount)} اجاره تکمیل‌شده</div>
              </div>
              <div className="rounded border border-line p-4">
                <div className="text-[11px] text-ink-3">میانگین ارزش رزرو</div>
                <div className="my-1 text-2xl font-bold">{toman(revenue.avgBookingValue)}</div>
                <div className="text-[11px] text-ink-3">تومان — بدون مالیات</div>
              </div>
              <div className="rounded border border-line p-4">
                <div className="text-[11px] text-ink-3">درآمد هر خودرو در روز</div>
                <div className="my-1 text-2xl font-bold">{toman(revenue.revenuePerVehicleDay)}</div>
                <div className="text-[11px] text-ink-3">تومان — بهره‌وری دارایی</div>
              </div>
              <div className="rounded border border-line p-4">
                <div className="text-[11px] text-ink-3">درآمد جریمه</div>
                <div className="my-1 text-2xl font-bold">{toman(revenue.penaltyRevenue)}</div>
                <div className="text-[11px] text-ink-3">تومان — جدا از اجاره</div>
              </div>
            </div>
            <p className="mb-6 text-[11px] text-ink-3">درآمد از مبلغ اجاره محاسبه می‌شود، نه مبلغ کل — مالیات درآمد آژانس نیست. درآمد جریمه جدا نگه داشته شده تا ماهی که مشتریان دیر برگردانده‌اند، پرفروش به نظر نرسد.</p>

            <h2 className="mb-3 border-b border-line-2 pb-2 text-[13px] font-bold">محصول</h2>
            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
              {metrics.map((m) => (
                <div key={m.key} className="rounded border border-line p-4">
                  <div className="text-[11px] text-ink-3">{m.label}</div>
                  <div className="my-1 flex items-baseline gap-2">
                    <span className="text-2xl font-bold">{m.display}</span>
                    {m.monitorOnly ? null : (
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        m.meetsTarget ? "bg-accent-soft text-accent" : "bg-white text-danger"}`}>
                        {m.meetsTarget ? "به هدف رسید" : "خارج از هدف"}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-ink-3">
                    {m.monitorOnly ? "بدون هدف — فقط پایش" : `هدف: ${m.targetLabel}`}
                  </div>
                </div>
              ))}
            </div>

            <h2 className="mb-3 mt-6 border-b border-line-2 pb-2 text-[13px] font-bold">
              روند رزروهای تأییدشده — ۳۰ روز گذشته
            </h2>
            <div className="rounded border border-line p-4">
              <Sparkline data={trend.map((t) => t.count)} />
            </div>
          </>
        )}
      </main>
    </>
  );
}
