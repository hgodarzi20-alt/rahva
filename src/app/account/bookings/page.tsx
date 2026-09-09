import Link from "next/link";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { StatusBadge } from "@/components/Badge";
import CancelButton from "@/components/CancelButton";
import { VehicleImage } from "@/components/VehicleCard";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { toFaDigits, vehicleName } from "@/lib/format";
import { formatJalali } from "@/lib/jalali";

export const dynamic = "force-dynamic";

const ACTIVE_STATUSES = ["pending_payment", "confirmed", "active"] as const;

export default async function MyBookingsPage() {
  const session = await getSession();
  if (!session) redirect("/auth?next=/account/bookings");

  const settings = await getSettings();
  const bookings = await prisma.booking.findMany({
    where: { userId: session.userId },
      include: { vehicle: true, incident: { select: { trackingCode: true, status: true } } },
    orderBy: { pickupAt: "desc" },
  });

  const active = bookings.filter((b) => ACTIVE_STATUSES.includes(b.status as never));
  const past = bookings.filter((b) => !ACTIVE_STATUSES.includes(b.status as never));

  function cancelState(b: (typeof bookings)[number]) {
    if (["cancelled", "completed", "failed", "no_show"].includes(b.status)) {
      return { can: false, reason: "" };
    }
    if (b.status !== "confirmed") return { can: false, reason: "فقط رزرو تأییدشده قابل لغو است" };
    const hoursLeft = (b.pickupAt.getTime() - Date.now()) / 3_600_000;
    if (hoursLeft < settings.cancel_deadline_hours) {
      return { can: false, reason: `مهلت لغو (${toFaDigits(settings.cancel_deadline_hours)} ساعت پیش از تحویل) گذشته است` };
    }
    return { can: true, reason: "" };
  }

  const BookingCard = ({ b }: { b: (typeof bookings)[number] }) => {
    const c = cancelState(b);
    const isActive = b.status === "active";

    return (
      <article className="card overflow-hidden">
              <div className="grid md:grid-cols-[1fr_auto]">

          <div className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <strong className="text-[15px]">{vehicleName(b.vehicle)}</strong>
              <StatusBadge status={b.status} />
            </div>
            <div className="mt-2 text-[13px] text-ink-2">
              {formatJalali(b.pickupAt)} تا {formatJalali(b.dropoffAt)} · {toFaDigits(b.days)} روز
            </div>
            <div className="mt-1 text-[12px] text-ink-3">
              کد رزرو <span className="mono">{b.code}</span>
            </div>
          </div>

          <div className="flex flex-col items-stretch justify-center gap-2 border-t border-line p-4 md:border-r md:border-t-0">
            <Link href={`/booking/${b.code}`} className="btn btn-sm">جزئیات</Link>
            {b.incident ? (
              <Link href={`/incident/${b.incident.trackingCode}`} className="btn btn-sm">
                پرونده حادثه <span className="mono">{b.incident.trackingCode}</span>
              </Link>
            ) : (
              isActive && (
                <Link href={`/incident/new?booking=${b.id}`} className="btn btn-danger btn-sm">
                  گزارش حادثه
                </Link>
              )
            )}
            {c.can && <CancelButton bookingId={b.id} />}
            {!c.can && c.reason && (
              <span className="max-w-[190px] text-[11px] text-ink-3">{c.reason}</span>
            )}
          </div>
        </div>
      </article>
    );
  };

  return (
    <>
      <Header />
      <main className="mx-auto max-w-[1000px] px-6 py-8">
        <h1 className="text-xl font-bold">رزروهای من</h1>

        <h2 className="mb-3 mt-6 text-[15px] font-bold">
          جاری <span className="text-ink-3">({toFaDigits(active.length)})</span>
        </h2>
        <div className="flex flex-col gap-4">
          {active.length ? (
            active.map((b) => <BookingCard key={b.id} b={b} />)
          ) : (
            <div className="card p-8 text-center text-ink-3">رزرو جاری ندارید.</div>
          )}
        </div>

        <h2 className="mb-3 mt-8 text-[15px] font-bold">
          گذشته <span className="text-ink-3">({toFaDigits(past.length)})</span>
        </h2>
        <div className="flex flex-col gap-4">
          {past.length ? (
            past.map((b) => <BookingCard key={b.id} b={b} />)
          ) : (
            <div className="card p-8 text-center text-ink-3">رزرو گذشته‌ای ندارید.</div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}