import Link from "next/link";
import StaffHeader from "@/components/StaffHeader";
import DisputeResolver from "@/components/DisputeResolver";
import { prisma } from "@/lib/db";
import { totals } from "@/lib/settlement";
import { faDateTime, toFaDigits, toman, vehicleName } from "@/lib/format";

export const dynamic = "force-dynamic";

/** رسیدگی به اعتراض‌ها — استوری ۶.۲ */
export default async function ManagerDisputesPage() {
  const open = await prisma.incidentCase.findMany({
    where: { status: "disputed" },
    include: {
      dispute: true,
      invoice: { include: { items: true } },
      booking: { include: { vehicle: true } },
    },
    orderBy: { updatedAt: "asc" },
  });

  const recent = await prisma.dispute.findMany({
    where: { resolvedAt: { not: null } },
    include: { incident: true },
    orderBy: { resolvedAt: "desc" },
    take: 10,
  });

  return (
    <>
      <StaffHeader panel="manager" active="/manager/disputes" />
      <main className="p-6">
        <h1 className="mb-1 text-[17px] font-bold">رسیدگی به اعتراض‌ها</h1>
        <p className="mb-5 text-[13px] text-ink-3">
          {open.length > 0
            ? `${toFaDigits(open.length)} پرونده در انتظار تصمیم شماست.`
            : "پرونده‌ای در انتظار رسیدگی نیست."}
        </p>

        {open.map((incident) => {
          const items = incident.invoice?.items ?? [];
          const t = totals(items);
          return (
            <section key={incident.id} className="card mb-5 p-5">
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={`/staff/incidents/${incident.trackingCode}`}
                  className="link mono text-[15px] font-bold"
                >
                  {incident.trackingCode}
                </Link>
                <span className="badge">اعتراض</span>
                <span className="text-[13px] text-ink-3">
                  {vehicleName(incident.booking.vehicle)} · {incident.booking.driverName}
                </span>
              </div>

              <div className="blk blk-warn mt-4">
                <h4>متن اعتراض کاربر</h4>
                <p>{incident.dispute?.reason}</p>
                <p className="mt-1.5 text-[11px]">
                  ثبت‌شده در{" "}
                  {incident.dispute ? faDateTime(incident.dispute.submittedAt) : "—"}
                </p>
              </div>

              <div className="mt-4 overflow-hidden rounded border border-line">
                <table className="w-full text-[13px]">
                  <tbody>
                    {items.map((i: any) => (
                      <tr key={i.id} className="border-b border-line-2">
                        <td className="p-3">
                          {i.label}
                          {i.basis && (
                            <span className="mr-2 text-[11px] text-ink-3">{i.basis}</span>
                          )}
                        </td>
                        <td className={`mono p-3 text-left ${i.amount < 0 ? "text-ok" : ""}`}>
                          {toman(i.amount)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-line-2">
                      <td className="p-3 font-bold">سهم مستأجر از خسارت</td>
                      <td className="mono p-3 text-left font-bold">{toman(t.damageTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <DisputeResolver
                code={incident.trackingCode}
                items={items.map((i: any) => ({
                  id: i.id,
                  label: i.label,
                  amount: i.amount,
                  basis: i.basis,
                }))}
                disputedIds={incident.dispute?.disputedItems ?? []}
              />
            </section>
          );
        })}

        {recent.length > 0 && (
          <>
            <h2 className="mb-3 mt-8 border-b border-line-2 pb-2 text-[13px] font-bold">
              رسیدگی‌های اخیر
            </h2>
            {recent.map((d: any) => (
              <Link
                key={d.id}
                href={`/staff/incidents/${d.incident.trackingCode}`}
                className="mb-1.5 flex items-center justify-between rounded border border-line p-2.5 text-[13px]"
              >
                <span className="mono">{d.incident.trackingCode}</span>
                <span className="truncate px-3 text-ink-2">{d.managerNote ?? "—"}</span>
                <span className="text-[11px] text-ink-3">{faDateTime(d.resolvedAt)}</span>
              </Link>
            ))}
          </>
        )}
      </main>
    </>
  );
}
