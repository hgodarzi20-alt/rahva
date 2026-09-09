import Link from "next/link";
import StaffHeader from "@/components/StaffHeader";
import { StatusBadge } from "@/components/Badge";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { isLateForPickup } from "@/lib/sweep";
import { faDate, faTime, toFaDigits, vehicleName } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function StaffTodayPage() {
  const settings = await getSettings();
  const now = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);

  const [pickups, returns] = await Promise.all([
    prisma.booking.findMany({
      where: { status: "confirmed", pickupAt: { gte: start, lt: end } },
      include: { vehicle: true, user: true },
      orderBy: { pickupAt: "asc" },
    }),
    prisma.booking.findMany({
      where: { status: "active", dropoffAt: { gte: start, lt: end } },
      include: { vehicle: true, user: true },
      orderBy: { dropoffAt: "asc" },
    }),
  ]);

  return (
    <>
      <StaffHeader panel="staff" active="/staff" />
      <main className="p-6">
        <div className="mb-5 flex items-baseline">
          <h1 className="text-[17px] font-bold">{faDate(now)}</h1>
          <span className="mr-auto text-[11px] text-ink-3">
            {toFaDigits(pickups.length)} تحویل · {toFaDigits(returns.length)} بازگشت
          </span>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section>
            <h2 className="mb-3 border-b border-line-2 pb-2 text-[13px] font-bold">تحویل امروز</h2>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line text-[11px] text-ink-3">
                  <th className="p-2.5 text-right">کد</th><th className="text-right">مشتری</th>
                  <th className="text-right">خودرو</th><th className="text-right">ساعت</th><th></th>
                </tr>
              </thead>
              <tbody>
                {pickups.map((b) => {
                  const late = isLateForPickup(b.pickupAt, settings.no_show_grace_hours);
                  return (
                    <tr key={b.id} className="border-b border-line-2">
                      <td className="mono p-2.5">{b.code}</td>
                      <td><strong>{b.driverName}</strong></td>
                      <td className="text-ink-2">{vehicleName(b.vehicle)}</td>
                      <td className="mono text-ink-2">{faTime(b.pickupAt)}</td>
                      <td className="p-2.5 text-left">
                        {late && <StatusBadge status="late" label="تأخیر در مراجعه" />}{" "}
                        <Link href={`/staff/bookings/${b.code}`} className="btn btn-sm btn-primary">ثبت تحویل</Link>
                      </td>
                    </tr>
                  );
                })}
                {!pickups.length && <tr><td colSpan={5} className="p-4 text-center text-ink-3">تحویلی برای امروز ثبت نشده است.</td></tr>}
              </tbody>
            </table>
          </section>

          <section>
            <h2 className="mb-3 border-b border-line-2 pb-2 text-[13px] font-bold">بازگشت امروز</h2>
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line text-[11px] text-ink-3">
                  <th className="p-2.5 text-right">کد</th><th className="text-right">مشتری</th>
                  <th className="text-right">خودرو</th><th className="text-right">ساعت</th><th></th>
                </tr>
              </thead>
              <tbody>
                {returns.map((b) => (
                  <tr key={b.id} className="border-b border-line-2">
                    <td className="mono p-2.5">{b.code}</td>
                    <td><strong>{b.driverName}</strong></td>
                    <td className="text-ink-2">{vehicleName(b.vehicle)}</td>
                    <td className="mono text-ink-2">{faTime(b.dropoffAt)}</td>
                    <td className="p-2.5 text-left">
                      <Link href={`/staff/bookings/${b.code}`} className="btn btn-sm btn-primary">ثبت بازگشت</Link>
                    </td>
                  </tr>
                ))}
                {!returns.length && <tr><td colSpan={5} className="p-4 text-center text-ink-3">بازگشتی برای امروز ثبت نشده است.</td></tr>}
              </tbody>
            </table>
          </section>
        </div>

        <p className="mt-6 text-[11px] text-ink-3">
          برای پیدا کردن رزرو با کد، آدرس <span className="mono">/staff/bookings/کد-رزرو</span> را باز کنید.
        </p>
      </main>
    </>
  );
}
