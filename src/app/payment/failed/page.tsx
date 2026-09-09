import Link from "next/link";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import LockCountdown from "@/components/LockCountdown";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { faDateShort, toFaDigits, toman, vehicleName } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function FailedPage({ searchParams }: { searchParams: { id?: string } }) {
  const session = await getSession();
  if (!session) redirect("/auth");

  const booking = await prisma.booking.findUnique({
    where: { id: Number(searchParams.id) },
    include: { vehicle: true },
  });
  if (!booking || booking.userId !== session.userId) redirect("/");

  return (
    <>
      <Header />
      <main className="flex justify-center px-7 py-12">
        <div className="w-[440px] text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-danger-soft text-2xl text-danger">!</div>
          <h1 className="mt-4 text-lg font-bold">پرداخت انجام نشد</h1>
          <p className="mt-2 text-ink-2">مبلغی از حساب شما کسر نشده است.</p>

          <div className="mt-4 text-right">
            <LockCountdown expiresAt={booking.lockExpiresAt?.toISOString() ?? null} />
          </div>

          <div className="mb-5 rounded border border-line p-4 text-right">
            <div className="flex justify-between">
              <span className="text-ink-2">{vehicleName(booking.vehicle)}</span>
              <span className="rounded-full bg-danger-soft px-2.5 py-0.5 text-[11px] font-semibold text-danger">پرداخت ناموفق</span>
            </div>
            <div className="mt-1.5 text-[11px] text-ink-3">
              {faDateShort(booking.pickupAt)} تا {faDateShort(booking.dropoffAt)} · {toFaDigits(booking.days)} روز · {toman(booking.totalAmount)} تومان
            </div>
          </div>

          <Link href={`/payment/simulate?id=${booking.id}`} className="btn btn-primary btn-lg">تلاش دوباره برای پرداخت</Link>
          <Link href="/" className="btn mt-2.5 w-full">انصراف و بازگشت به نتایج</Link>
        </div>
      </main>
    </>
  );
}
