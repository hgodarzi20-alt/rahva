import Link from "next/link";
import StaffHeader from "@/components/StaffHeader";
import StatusToggle from "@/components/StatusToggle";
import { prisma } from "@/lib/db";
import { toFaDigits, toman, TRANSMISSION_FA, VEHICLE_CLASS_FA, vehicleName } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function FleetPage() {
  const [vehicles, activeBookings] = await Promise.all([
    prisma.vehicle.findMany({ orderBy: { id: "asc" } }),
    prisma.booking.findMany({ where: { status: "active" }, select: { vehicleId: true } }),
  ]);
  const rented = new Set(activeBookings.map((b) => b.vehicleId));

  return (
    <>
      <StaffHeader panel="manager" active="/manager/fleet" />
      <main className="p-6">
        <div className="mb-4 flex items-center">
          <h1 className="text-[17px] font-bold">ناوگان · {toFaDigits(vehicles.length)} خودرو</h1>
          <Link href="/manager/fleet/new" className="btn btn-primary btn-sm mr-auto">افزودن خودرو</Link>
        </div>

        <table className="w-full rounded border border-line text-[13px]">
          <thead>
            <tr className="border-b border-line text-[11px] text-ink-3">
              <th className="p-2.5 text-right">پلاک</th><th className="text-right">خودرو</th>
              <th className="text-right">کلاس</th><th className="text-right">گیربکس</th>
              <th className="text-right">اجاره روزانه</th><th className="text-right">سقف کیلومتر</th>
              <th className="text-right">وضعیت</th><th></th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v) => {
              const state = rented.has(v.id) ? "rented" : v.status;
              return (
                <tr key={v.id} className="border-b border-line-2">
                  <td className="mono p-2.5">{v.plate}</td>
                  <td><strong>{vehicleName(v)}</strong><div className="text-[11px] text-ink-3">{toFaDigits(v.year)}</div></td>
                  <td className="text-ink-2">{VEHICLE_CLASS_FA[v.vehicleClass]}</td>
                  <td className="text-ink-2">{TRANSMISSION_FA[v.transmission]}</td>
                  <td className="text-ink-2">{toman(v.dailyRate)}</td>
                  <td className="text-ink-2">{toFaDigits(v.dailyKmLimit)}</td>
                  <td>
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      state === "rented" ? "bg-white text-ink"
                      : state === "maintenance" ? "bg-line-2 text-ink-3"
                      : "bg-accent-soft text-accent"}`}>
                      {state === "rented" ? "در اجاره" : state === "maintenance" ? "تعمیرگاه" : "آزاد"}
                    </span>
                  </td>
                  <td className="p-2.5 text-left">
                    <div className="flex justify-end gap-1.5">
                      <Link href={`/manager/fleet/${v.id}`} className="btn btn-sm">ویرایش</Link>
                      {state !== "rented" && <StatusToggle vehicleId={v.id} status={v.status} />}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <p className="mt-2.5 text-[11px] text-ink-3">
          اجاره روزانه و سقف کیلومتر هر خودرو در همین جدول تنظیم می‌شود؛ سیستم قیمت را از این مقدار می‌سازد.
          وضعیت «در اجاره» را سیستم می‌گذارد و قابل تغییر دستی نیست.
        </p>
      </main>
    </>
  );
}
