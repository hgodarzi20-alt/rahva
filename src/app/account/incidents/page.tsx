import Link from "next/link";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { STATUS_FA, INCIDENT_TYPE_FA, type IncidentStatus } from "@/lib/incident";
import { totals } from "@/lib/settlement";
import { toFaDigits, toman, vehicleName } from "@/lib/format";
import { formatJalali } from "@/lib/jalali";

export const dynamic = "force-dynamic";

/** پرونده‌هایی که هنوز اقدامی روی آن‌ها باز است */
const OPEN = ["reported", "documented", "assistance_dispatched", "vehicle_recovered",
  "under_assessment", "estimate_issued", "disputed", "resolved", "accepted"];

export default async function MyIncidentsPage() {
  const session = await getSession();
  if (!session) redirect("/auth?next=/account/incidents");

  const cases = await prisma.incidentCase.findMany({
    where: { userId: session.userId },
    include: {
      booking: { include: { vehicle: true } },
      invoice: { include: { items: true } },
    },
    orderBy: { id: "desc" },
  });

  const open = cases.filter((c: any) => OPEN.includes(c.status));
  const closed = cases.filter((c: any) => !OPEN.includes(c.status));

  const Card = ({ c }: { c: any }) => {
    const status = c.status as IncidentStatus;
    const share = c.invoice?.issuedAt ? totals(c.invoice.items).damageTotal : null;

    /** کاری که همین حالا از کاربر خواسته می‌شود */
    const action =
      status === "reported" ? { label: "تکمیل مستندات", href: `/incident/${c.trackingCode}/documents` }
      : status === "estimate_issued" ? { label: "بررسی صورت‌حساب", href: `/incident/${c.trackingCode}` }
      : c.policeReportStatus === "pending" ? { label: "آپلود کروکی", href: `/incident/${c.trackingCode}` }
      : null;

    return (
      <article className="card p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/incident/${c.trackingCode}`} className="mono font-bold">{c.trackingCode}</Link>
          <span className="badge">{STATUS_FA[status]}</span>
          {c.policeReportStatus === "not_obtained" && <span className="badge badge-danger">بدون کروکی</span>}
        </div>

        <div className="mt-2 text-[13px] text-ink-2">
          {vehicleName(c.booking.vehicle)}
          {c.type ? ` · ${INCIDENT_TYPE_FA[c.type as keyof typeof INCIDENT_TYPE_FA]}` : ""}
          {c.occurredAt ? ` · ${formatJalali(c.occurredAt)}` : ""}
        </div>

        {share !== null && (
          <div className="mt-2 text-[13px]">
            سهم شما از خسارت <b>{toman(share)}</b> تومان
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Link href={`/incident/${c.trackingCode}`} className="btn btn-sm">مشاهده پرونده</Link>
          {action && <Link href={action.href} className="btn btn-primary btn-sm">{action.label}</Link>}
        </div>
      </article>
    );
  };

  return (
    <>
      <Header />
      <main className="mx-auto max-w-[900px] px-6 py-8">
        <h1 className="text-xl font-bold">پرونده‌های حادثه</h1>
        <p className="mt-1.5 text-[13px] text-ink-3">
          پرونده‌های ثبت‌شده برای سفرهای شما و وضعیت رسیدگی هرکدام.
        </p>

        <h2 className="mb-3 mt-6 text-[15px] font-bold">
          در جریان <span className="text-ink-3">({toFaDigits(open.length)})</span>
        </h2>
        <div className="flex flex-col gap-4">
          {open.length
            ? open.map((c: any) => <Card key={c.id} c={c} />)
            : <div className="card p-8 text-center text-ink-3">پرونده در جریانی ندارید.</div>}
        </div>

        {closed.length > 0 && (
          <>
            <h2 className="mb-3 mt-8 text-[15px] font-bold">
              بسته‌شده <span className="text-ink-3">({toFaDigits(closed.length)})</span>
            </h2>
            <div className="flex flex-col gap-4">
              {closed.map((c: any) => <Card key={c.id} c={c} />)}
            </div>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}