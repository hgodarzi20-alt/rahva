import { redirect } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Stepper from "@/components/Stepper";
import LockCountdown from "@/components/LockCountdown";
import { Row, Section } from "@/components/Row";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { toFaDigits, toman, vehicleName } from "@/lib/format";
import { formatJalali } from "@/lib/jalali";

export const dynamic = "force-dynamic";

export default async function ReviewPage({ searchParams }: { searchParams: { id?: string } }) {
  const session = await getSession();
  if (!session) redirect("/auth");

  const booking = await prisma.booking.findUnique({
    where: { id: Number(searchParams.id) },
    include: { vehicle: true, branch: true },
  });
  if (!booking || booking.userId !== session.userId) redirect("/");
  if (booking.status === "confirmed") redirect(`/booking/${booking.code}`);

  const time = (d: Date) => toFaDigits(d.toTimeString().slice(0, 5));

  if (booking.status !== "pending_payment") {
    return (
      <>
        <Header />
        <main className="flex justify-center px-6 py-12">
          <div className="w-[440px] text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-danger text-2xl text-danger">!</div>
            <h1 className="mt-4 text-lg font-bold">مهلت نگهداری خودرو تمام شد</h1>
            <p className="mt-2 text-ink-2">این خودرو دیگر برای شما نگه داشته نشده و ممکن است رزرو شده باشد.</p>
            <p className="mb-6 mt-1 text-[11px] text-ink-3">مبلغی از حساب شما کسر نشده است.</p>
            <div className="card mb-5 p-4 text-right">
              <div className="flex justify-between">
                <span className="text-ink-2">{vehicleName(booking.vehicle)}</span>
                <span className="badge badge-danger">منقضی‌شده</span>
              </div>
              <div className="mt-1.5 text-[11px] text-ink-3">
                {formatJalali(booking.pickupAt)} تا {formatJalali(booking.dropoffAt)}
              </div>
            </div>
            <a href={`/search?from=${booking.pickupAt.toISOString().slice(0, 10)}&to=${booking.dropoffAt.toISOString().slice(0, 10)}`} className="btn btn-primary btn-lg">
              جست‌وجوی دوباره در همین تاریخ
            </a>
            <a href="/" className="btn mt-2.5 w-full">بازگشت به صفحه اصلی</a>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-[1200px] px-6 py-6">
        <Stepper current={3} />

        <LockCountdown expiresAt={booking.lockExpiresAt?.toISOString() ?? null} />

        <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_340px]">
          <Section title="خلاصه رزرو" className="self-start">
            <Row label="خودرو">
              {vehicleName(booking.vehicle)} · {toFaDigits(booking.vehicle.year)}
            </Row>
            <Row label="محل تحویل و بازگشت">{booking.branch.name}</Row>
            <Row label="تحویل">{formatJalali(booking.pickupAt)} · {time(booking.pickupAt)}</Row>
            <Row label="بازگشت">{formatJalali(booking.dropoffAt)} · {time(booking.dropoffAt)}</Row>
            <Row label="مدت اجاره">{toFaDigits(booking.days)} روز</Row>
            <Row label="راننده">{booking.driverName}</Row>
            <p className="mt-3 border-t border-line-2 pt-3 text-[12px] text-ink-3">
              هر ۲۴ ساعت یک روز اجاره محاسبه می‌شود.
            </p>
          </Section>

          <aside className="self-start lg:sticky lg:top-[84px]">
            <Section title="ریز مبلغ">
              <Row label="اجاره روزانه" strong={false}>{toman(booking.dailyRateSnapshot)}</Row>
              <Row label="تعداد روز" strong={false}>× {toFaDigits(booking.days)}</Row>
              <Row label="جمع اجاره" strong={false}>{toman(booking.rentAmount)}</Row>
              {booking.taxAmount > 0 && (
                <Row label={`مالیات (${toFaDigits(booking.taxRateSnapshot)}٪)`} strong={false}>
                  {toman(booking.taxAmount)}
                </Row>
              )}

              <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
                <span className="font-bold">قابل پرداخت</span>
                <span className="text-[19px] font-bold">{toman(booking.totalAmount)}</span>
              </div>
              <div className="text-left text-[11px] text-ink-3">تومان</div>

              {booking.depositAmountSnapshot ? (
                <div className="blk blk-info mt-4">
                  <div className="flex items-baseline justify-between">
                    <b className="text-[13px]">ودیعه</b>
                    <b className="text-[13px]">{toman(booking.depositAmountSnapshot)}</b>
                  </div>
                  <p className="mt-1.5 text-[12px] leading-6 text-ink-3">
                    امروز پرداخت نمی‌شود. هنگام تحویل خودرو دریافت و پس از بازگشت سالم خودرو
                    به حساب {booking.refundBankName} واریز می‌شود.
                  </p>
                </div>
              ) : null}

              <a href={`/payment/simulate?id=${booking.id}`} className="btn btn-primary btn-lg mt-4">
                ثبت رزرو
              </a>
              <p className="mt-2.5 text-[11px] leading-6 text-ink-3">
                با ثبت رزرو، شرایط اجاره را می‌پذیرید. جریمه تأخیر و کیلومتر اضافه در صورت وقوع،
                هنگام بازگشت خودرو محاسبه می‌شود.
              </p>
            </Section>
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}