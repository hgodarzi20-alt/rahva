import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Row, Section } from "@/components/Row";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { toFaDigits, toman, vehicleName } from "@/lib/format";
import { formatJalali } from "@/lib/jalali";

export const dynamic = "force-dynamic";

export default async function ConfirmationPage({ params }: { params: { code: string } }) {
  const session = await getSession();
  if (!session) redirect("/auth");

  if (!params.code) notFound();

  const booking = await prisma.booking.findUnique({
    where: { code: params.code },
    include: { vehicle: true, branch: true },
  });
  if (!booking || booking.userId !== session.userId) notFound();

  const time = (d: Date) => toFaDigits(d.toTimeString().slice(0, 5));

  return (
    <>
      <Header />
      <main className="mx-auto max-w-[560px] px-6 py-10">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-ok text-2xl text-ok">✓</div>
          <h1 className="mt-4 text-xl font-bold">خودرو برای شما رزرو شد</h1>
          <p className="mt-1.5 text-[13px] text-ink-3">
            این کد را هنگام تحویل خودرو به اپراتور نشان دهید.
          </p>

          {/* کد رزرو در قالب پلاک — عنصر امضای طراحی */}
          <div className="mt-5 inline-flex overflow-hidden rounded-md border-2 border-ink bg-white">
            <span className="flex items-center bg-accent-navy px-1.5 text-[9px] leading-3 tracking-widest text-white">
              I.R.<br />IRAN
            </span>
            <span className="mono px-4 py-1.5 text-[22px] font-bold tracking-[0.16em]">{booking.code}</span>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-4">
          <Section title="جزئیات رزرو">
            <Row label="خودرو">
              {vehicleName(booking.vehicle)} · {toFaDigits(booking.vehicle.year)}
            </Row>
            <Row label="محل تحویل و بازگشت">{booking.branch.name}</Row>
            <Row label="تحویل">{formatJalali(booking.pickupAt)} · {time(booking.pickupAt)}</Row>
            <Row label="بازگشت">{formatJalali(booking.dropoffAt)} · {time(booking.dropoffAt)}</Row>
            <Row label="راننده">{booking.driverName}</Row>
            <Row label="پرداخت‌شده">{toman(booking.totalAmount)} تومان</Row>
          </Section>

          <div className="blk blk-info">
            <h4>هنگام تحویل خودرو</h4>
            <p>
              اصل گواهینامه و کارت ملی راننده را همراه داشته باشید. بدون رؤیت اصل مدارک،
              خودرو تحویل داده نمی‌شود.
              {booking.depositAmountSnapshot
                ? ` ودیعه ${toman(booking.depositAmountSnapshot)} تومان نیز در همان زمان دریافت می‌شود.`
                : ""}
            </p>
          </div>
        </div>

        <Link href="/account/bookings" className="btn btn-primary btn-lg mt-6">مشاهده رزروهای من</Link>
      </main>
      <Footer />
    </>
  );
}