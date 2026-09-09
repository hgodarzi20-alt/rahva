import Link from "next/link";
import StaffHeader from "@/components/StaffHeader";
import { StatusBadge } from "@/components/Badge";
import { prisma } from "@/lib/db";
import { faDateShort, toFaDigits, toman, vehicleName } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ManagerDashboard() {
  const now = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);

  const [pickupsToday, returnsToday, overdue, noShows, stuck, vehicles, rentedNow, recent] =
    await Promise.all([
      prisma.booking.count({ where: { status: "confirmed", pickupAt: { gte: start, lt: end } } }),
      prisma.booking.count({ where: { status: "active", dropoffAt: { gte: start, lt: end } } }),
      prisma.booking.findMany({
        where: { status: "active", dropoffAt: { lt: now } },
        include: { vehicle: true }, orderBy: { dropoffAt: "asc" }, take: 10,
      }),
      prisma.booking.findMany({
        where: { status: "no_show" },
        include: { vehicle: true }, orderBy: { pickupAt: "desc" }, take: 10,
      }),
      prisma.booking.count({ where: { status: "pending_payment" } }),
      prisma.vehicle.groupBy({ by: ["status"], _count: true }),
      prisma.booking.count({ where: { status: "active" } }),
      prisma.booking.findMany({
        include: { vehicle: true }, orderBy: { createdAt: "desc" }, take: 10,
      }),
    ]);

  const available = (vehicles.find((v) => v.status === "available")?._count ?? 0) - rentedNow;
  const maintenance = vehicles.find((v) => v.status === "maintenance")?._count ?? 0;

  const Card = ({ label, value, tone }: { label: string; value: number; tone?: string }) => (
    <div className="rounded border border-line bg-white p-4">
      <div className="text-[11px] text-ink-3">{label}</div>
      <div className={`text-[26px] font-bold ${tone ?? ""}`}>{toFaDigits(value)}</div>
    </div>
  );

  return (
    <>
      <StaffHeader panel="manager" active="/manager" />
      <main className="p-6">
        <h1 className="mb-4 text-[17px] font-bold">داشبورد عملیاتی</h1>

        <div className="mb-6 grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <Card label="تحویل امروز" value={pickupsToday} />
          <Card label="بازگشت امروز" value={returnsToday} />
          <Card label="خودرو در اجاره" value={rentedNow} />
          <Card label="در انتظار پرداخت" value={stuck} tone={stuck > 0 ? "text-signal" : ""} />
        </div>

        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <section>
            <h2 className="mb-3 border-b border-line-2 pb-2 text-[13px] font-bold text-danger">
              بازگشت‌های عقب‌افتاده · {toFaDigits(overdue.length)}
            </h2>
            {overdue.length ? overdue.map((b) => (
              <Link key={b.id} href={`/staff/bookings/${b.code}`} className="mb-1.5 flex items-center justify-between rounded border border-line p-2.5 text-[13px]">
                <span className="mono">{b.code}</span>
                <span className="text-ink-2">{vehicleName(b.vehicle)}</span>
                <span className="text-[11px] text-danger">موعد: {faDateShort(b.dropoffAt)}</span>
              </Link>
            )) : <p className="text-[13px] text-ink-3">موردی نیست.</p>}
          </section>

          <section>
            <h2 className="mb-3 border-b border-line-2 pb-2 text-[13px] font-bold">
              عدم مراجعه · {toFaDigits(noShows.length)}
            </h2>
            {noShows.length ? noShows.map((b) => (
              <div key={b.id} className="mb-1.5 flex items-center justify-between rounded border border-line p-2.5 text-[13px]">
                <span className="mono">{b.code}</span>
                <span className="text-ink-2">{vehicleName(b.vehicle)}</span>
                <span className="text-[11px] text-ink-3">بازگشتی: {toman(b.refundAmount ?? 0)}</span>
              </div>
            )) : <p className="text-[13px] text-ink-3">موردی نیست.</p>}
          </section>
        </div>

        <div className="mb-6 grid gap-3.5 sm:grid-cols-3">
          <Card label="خودرو آزاد" value={available} />
          <Card label="خودرو در اجاره" value={rentedNow} />
          <Card label="خودرو در تعمیرگاه" value={maintenance} />
        </div>

        <h2 className="mb-3 border-b border-line-2 pb-2 text-[13px] font-bold">آخرین رزروها</h2>
        <table className="w-full rounded border border-line text-[13px]">
          <thead>
            <tr className="border-b border-line text-[11px] text-ink-3">
              <th className="p-2.5 text-right">کد</th><th className="text-right">خودرو</th>
              <th className="text-right">بازه</th><th className="text-right">مبلغ</th><th className="text-right">وضعیت</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((b) => (
              <tr key={b.id} className="border-b border-line-2">
                <td className="mono p-2.5">{b.code}</td>
                <td className="text-ink-2">{vehicleName(b.vehicle)}</td>
                <td className="text-ink-2">{faDateShort(b.pickupAt)} تا {faDateShort(b.dropoffAt)}</td>
                <td className="text-ink-2">{toman(b.totalAmount)}</td>
                <td className="p-2.5"><StatusBadge status={b.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </>
  );
}
