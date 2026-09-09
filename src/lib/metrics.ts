import { prisma } from "./db";

/**
 * متریک‌های موفقیت — استوری ۵.۵
 *
 * تفکیک منبع داده طبق تصمیم مصوب:
 *   • متریک‌های قیف تبدیل  → جدول رویدادها
 *   • متریک‌های عملیاتی    → جداول رزرو و خودرو
 *
 * هیچ شناسه‌ی ردیابی برای مهمان ذخیره نمی‌شود، پس اعداد قیف تجمیعی‌اند.
 */

const DAY = 86_400_000;

export type Metric = {
  key: string;
  label: string;
  value: number;
  display: string;
  target?: number;
  targetLabel?: string;
  meetsTarget?: boolean;
  monitorOnly?: boolean;
};

export async function getFunnel(days = 30) {
  const since = new Date(Date.now() - days * DAY);
  const rows = await prisma.event.groupBy({
    by: ["type"],
    where: { createdAt: { gte: since } },
    _count: true,
  });
  const n = (t: string) => rows.find((r) => r.type === t)?._count ?? 0;

  const stages = [
    { key: "search_performed", label: "جست‌وجو", count: n("search_performed") },
    { key: "car_viewed", label: "مشاهده خودرو", count: n("car_viewed") },
    { key: "booking_started", label: "شروع رزرو", count: n("booking_started") },
    { key: "booking_confirmed", label: "رزرو تأییدشده", count: n("booking_confirmed") },
  ];

  return stages.map((s, i) => ({
    ...s,
    dropFromPrev: i === 0 || stages[i - 1].count === 0
      ? null
      : Math.round((1 - s.count / stages[i - 1].count) * 100),
  }));
}

export async function getMetrics(days = 30): Promise<Metric[]> {
  const since = new Date(Date.now() - days * DAY);

  const [events, bookings, vehicleCount, rentals] = await Promise.all([
    prisma.event.groupBy({ by: ["type"], where: { createdAt: { gte: since } }, _count: true }),
    prisma.booking.findMany({
      where: { createdAt: { gte: since } },
      select: { status: true, days: true, pickupAt: true, dropoffAt: true },
    }),
    prisma.vehicle.count(),
    prisma.rental.findMany({
      where: { checkinAt: { gte: since } },
      select: { lateFee: true, extraKmFee: true },
    }),
  ]);

  const ev = (t: string) => events.find((r) => r.type === t)?._count ?? 0;
  const countBy = (s: string) => bookings.filter((b) => b.status === s).length;

  const searches = ev("search_performed");
  const confirmed = ev("booking_confirmed");
  const started = ev("booking_started");

  // نرخ جست‌وجوی بی‌نتیجه از payload محاسبه می‌شود
  const zeroResults = await prisma.event.count({
    where: { type: "search_performed", createdAt: { gte: since }, payload: { path: ["resultCount"], equals: 0 } },
  });

  // نرخ اشغال: روز-خودروی اجاره‌رفته ÷ کل روز-خودرو
  const rentedDays = bookings
    .filter((b) => ["confirmed", "active", "completed"].includes(b.status))
    .reduce((sum, b) => sum + b.days, 0);
  const capacityDays = vehicleCount * days;

  const completed = countBy("completed");
  const lateReturns = rentals.filter((r) => (r.lateFee ?? 0) > 0).length;
  const avgDays = bookings.length
    ? bookings.reduce((s, b) => s + b.days, 0) / bookings.length
    : 0;

  const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);

  return [
    {
      key: "conversion", label: "نرخ تبدیل رزرو",
      value: pct(confirmed, searches), display: `${pct(confirmed, searches)}٪`,
      target: 15, targetLabel: "حداقل ۱۵٪", meetsTarget: pct(confirmed, searches) >= 15,
    },
    {
      key: "payment_completion", label: "نرخ تکمیل پرداخت",
      value: pct(confirmed, started), display: `${pct(confirmed, started)}٪`,
      target: 80, targetLabel: "حداقل ۸۰٪", meetsTarget: pct(confirmed, started) >= 80,
    },
    {
      key: "zero_results", label: "نرخ جست‌وجوی بی‌نتیجه",
      value: pct(zeroResults, searches), display: `${pct(zeroResults, searches)}٪`,
      target: 20, targetLabel: "حداکثر ۲۰٪", meetsTarget: pct(zeroResults, searches) <= 20,
    },
    {
      key: "utilization", label: "نرخ اشغال ناوگان",
      value: pct(rentedDays, capacityDays), display: `${pct(rentedDays, capacityDays)}٪`,
      target: 40, targetLabel: "حداقل ۴۰٪", meetsTarget: pct(rentedDays, capacityDays) >= 40,
    },
    {
      key: "cancellation", label: "نرخ لغو",
      value: pct(countBy("cancelled"), countBy("confirmed") + countBy("cancelled")),
      display: `${pct(countBy("cancelled"), countBy("confirmed") + countBy("cancelled"))}٪`,
      target: 10, targetLabel: "حداکثر ۱۰٪",
      meetsTarget: pct(countBy("cancelled"), countBy("confirmed") + countBy("cancelled")) <= 10,
    },
    {
      key: "late_returns", label: "نرخ بازگشت با تأخیر",
      value: pct(lateReturns, completed), display: `${pct(lateReturns, completed)}٪`,
      target: 10, targetLabel: "حداکثر ۱۰٪", meetsTarget: pct(lateReturns, completed) <= 10,
    },
    {
      key: "avg_duration", label: "میانگین مدت اجاره",
      value: avgDays, display: `${Math.round(avgDays * 10) / 10} روز`,
      monitorOnly: true,
    },
  ];
}

/** روند روزانه‌ی رزروهای تأییدشده برای نمودار */
export async function getTrend(days = 30) {
  const since = new Date(Date.now() - days * DAY);
  const rows = await prisma.event.findMany({
    where: { type: "booking_confirmed", createdAt: { gte: since } },
    select: { createdAt: true },
  });

  const buckets = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    buckets.set(new Date(Date.now() - i * DAY).toISOString().slice(0, 10), 0);
  }
  for (const r of rows) {
    const k = r.createdAt.toISOString().slice(0, 10);
    if (buckets.has(k)) buckets.set(k, (buckets.get(k) ?? 0) + 1);
  }
  return [...buckets.entries()].map(([date, count]) => ({ date, count }));
}

export type Revenue = {
  rentRevenue: number;
  penaltyRevenue: number;
  avgBookingValue: number;
  revenuePerVehicleDay: number;
  completedCount: number;
};

export async function getRevenue(days = 30): Promise<Revenue> {
  const since = new Date(Date.now() - days * DAY);

  const [completed, rentals, vehicleCount] = await Promise.all([
    prisma.booking.findMany({
      where: { status: "completed", createdAt: { gte: since } },
      select: { rentAmount: true },
    }),
    prisma.rental.findMany({
      where: { checkinAt: { gte: since } },
      select: { chargesTotal: true },
    }),
    prisma.vehicle.count(),
  ]);

  const rentRevenue = completed.reduce((s, b) => s + b.rentAmount, 0);
  const penaltyRevenue = rentals.reduce((s, r) => s + (r.chargesTotal ?? 0), 0);

  return {
    rentRevenue,
    penaltyRevenue,
    completedCount: completed.length,
    avgBookingValue: completed.length ? Math.round(rentRevenue / completed.length) : 0,
    revenuePerVehicleDay: vehicleCount ? Math.round(rentRevenue / (vehicleCount * days)) : 0,
  };
}
