import { redirect } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Stepper from "@/components/Stepper";
import PaymentButtons from "@/components/PaymentButtons";
import { Row, Section } from "@/components/Row";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { toFaDigits, toman, vehicleName } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SimulatePage({ searchParams }: { searchParams: { id?: string } }) {
  const session = await getSession();
  if (!session) redirect("/auth");

  const booking = await prisma.booking.findUnique({
    where: { id: Number(searchParams.id) },
    include: { vehicle: true },
  });
  if (!booking || booking.userId !== session.userId) redirect("/");
  if (booking.status !== "pending_payment") redirect(`/booking/review?id=${booking.id}`);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-[1200px] px-6 py-6">
        <Stepper current={4} />

        <div className="mx-auto max-w-[460px]">
          <Section>
            <div className="text-center">
              <span className="badge badge-warn">محیط آزمایشی</span>
              <h1 className="mt-3 text-[17px] font-bold">درگاه پرداخت شبیه‌سازی‌شده</h1>
              <p className="mt-1 text-[12px] text-ink-3">در این نسخه اتصال واقعی به بانک وجود ندارد.</p>
            </div>

            <div className="my-5 h-px bg-line-2" />

            <Row label="خودرو">{vehicleName(booking.vehicle)}</Row>
            <Row label="کد رزرو"><span className="mono">{booking.code}</span></Row>
            <Row label="مدت">{toFaDigits(booking.days)} روز</Row>

            <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
              <span className="font-bold">مبلغ قابل پرداخت</span>
              <span className="text-[22px] font-bold">{toman(booking.totalAmount)}</span>
            </div>
            <div className="mb-5 text-left text-[11px] text-ink-3">تومان</div>

            <PaymentButtons bookingId={booking.id} />
          </Section>
        </div>
      </main>
      <Footer />
    </>
  );
}