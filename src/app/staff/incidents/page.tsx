import Link from "next/link";
import StaffHeader from "@/components/StaffHeader";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { STATUS_FA, INCIDENT_TYPE_FA, type IncidentStatus } from "@/lib/incident";
import { faDate, toFaDigits, toman, vehicleName } from "@/lib/format";

export const dynamic = "force-dynamic";

const OPEN_STATUSES = [
  "reported", "documented", "assistance_dispatched",
  "vehicle_recovered", "under_assessment", "estimate_issued",
  "accepted", "disputed", "resolved",
];

export default async function StaffIncidentsPage() {
  const session = await getSession();
  if (!session || session.role !== "operator") redirect("/auth");

  const cases = await prisma.incidentCase.findMany({
    include: { booking: { include: { vehicle: true, user: true } }, invoice: { include: { items: true } } },
    orderBy: { id: "desc" },
  });

  const open = cases.filter((c: any) => OPEN_STATUSES.includes(c.status));
  const closed = cases.filter((c: any) => !OPEN_STATUSES.includes(c.status));

  const Table = ({ rows }: { rows: any[] }) => (
    <div className="card overflow-hidden">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-line bg-line-2 text-right text-[12px] text-ink-2">
            <th className="p-3 font-semibold">کد</th>
            <th className="p-3 font-semibold">خودرو</th>
            <th className="p-3 font-semibold">مستأجر</th>
            <th className="p-3 font-semibold">نوع</th>
            <th className="p-3 font-semibold">کروکی</th>
            <th className="p-3 font-semibold">وضعیت</th>
            <th className="p-3 font-semibold">روز از بازرسی</th>
            <th className="p-3 font-semibold">سهم مستأجر</th>
            <th className="p-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const share = (c.invoice?.items ?? [])
              .filter((i: any) => i.type !== "rental_credit")
              .reduce((s: number, i: any) => s + i.amount, 0);
            // چند روز از تکمیل بازرسی گذشته — بدون منطق مهلت، فقط برای دیده‌شدن پرونده‌های فراموش‌شده
            const daysSinceInspection = c.status === "under_assessment" && c.invoice?.createdAt
              ? Math.floor((Date.now() - new Date(c.invoice.createdAt).getTime()) / 86_400_000)
              : null;
            return (
              <tr key={c.id} className="border-b border-line-2 last:border-0">
                <td className="mono p-3">{c.trackingCode}</td>
                <td className="p-3">{vehicleName(c.booking.vehicle)}</td>
                <td className="p-3 text-ink-2">{c.booking.driverName}</td>
                <td className="p-3 text-ink-2">
                  {c.type ? INCIDENT_TYPE_FA[c.type as keyof typeof INCIDENT_TYPE_FA] : "—"}
                </td>
                <td className="p-3">
                  {c.policeReportStatus === "uploaded" ? <span className="badge badge-ok">دارد</span>
                    : c.policeReportStatus === "pending" ? <span className="badge badge-warn">در انتظار</span>
                    : c.policeReportStatus === "not_obtained" ? <span className="badge badge-danger">ندارد</span>
                    : <span className="badge">—</span>}
                </td>
                <td className="p-3"><span className="badge">{STATUS_FA[c.status as IncidentStatus]}</span></td>
                <td className="mono p-3">
                  {daysSinceInspection === null ? "—" : `${toFaDigits(daysSinceInspection)} روز`}
                </td>
                <td className="mono p-3">{c.invoice?.items?.length ? toman(share) : "—"}</td>
                <td className="p-3">
                  <Link href={`/staff/incidents/${c.trackingCode}`} className="btn btn-sm">بازکردن</Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  return (
    <>
      <StaffHeader panel="staff" active="/staff/incidents" />
      <main className="p-6">
        <div className="mb-5 flex items-baseline">
          <h1 className="text-[17px] font-bold">پرونده‌های حادثه</h1>
          <span className="mr-auto text-[11px] text-ink-3">
            {toFaDigits(open.length)} باز · {toFaDigits(closed.length)} بسته
          </span>
        </div>

        {open.length ? <Table rows={open} /> : (
          <div className="card p-8 text-center text-ink-3">پرونده بازی وجود ندارد.</div>
        )}

        {closed.length > 0 && (
          <>
            <h2 className="mb-3 mt-8 text-[15px] font-bold">بسته‌شده</h2>
            <Table rows={closed} />
          </>
        )}
      </main>
    </>
  );
}
