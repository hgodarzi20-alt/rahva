import { NextResponse } from "next/server";
import { BookingStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isVehicleFree } from "@/lib/availability";
import { logEvent } from "@/lib/events";

/** پرداخت شبیه‌سازی‌شده — استوری ۳.۱ */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "ابتدا وارد شوید." }, { status: 401 });

  const { outcome } = await req.json(); // "success" | "failure"
  const booking = await prisma.booking.findUnique({ where: { id: Number(params.id) } });

  if (!booking || booking.userId !== session.userId) {
    return NextResponse.json({ error: "رزرو پیدا نشد." }, { status: 404 });
  }
  if (booking.status !== BookingStatus.pending_payment) {
    return NextResponse.json({ error: "این رزرو در وضعیت پرداخت نیست." }, { status: 409 });
  }
  if (booking.lockExpiresAt && booking.lockExpiresAt < new Date()) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.failed, lockExpiresAt: null },
    });
    return NextResponse.json({ error: "مهلت نگهداری خودرو تمام شد.", expired: true }, { status: 409 });
  }

  await prisma.payment.create({
    data: { bookingId: booking.id, amount: booking.totalAmount, result: outcome === "success" ? "succeeded" : "failed" },
  });
  await logEvent("payment_attempted", {
    userId: session.userId, bookingId: booking.id, payload: { outcome },
  });

  if (outcome !== "success") {
    // قفل تا پایان مهلت باقی می‌ماند تا کاربر بتواند دوباره تلاش کند
    return NextResponse.json({ ok: false, code: booking.code, id: booking.id });
  }

  // بررسی دوباره‌ی آزاد بودن خودرو پیش از تأیید نهایی — استوری ۳.۱ بند ۳
  const free = await isVehicleFree(booking.vehicleId, booking.pickupAt, booking.dropoffAt, booking.id);
  if (!free) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.failed, lockExpiresAt: null },
    });
    return NextResponse.json({ error: "این خودرو هم‌زمان توسط کاربر دیگری رزرو شد.", conflict: true }, { status: 409 });
  }

  const confirmed = await prisma.booking.update({
    where: { id: booking.id },
    data: { status: BookingStatus.confirmed, confirmedAt: new Date(), lockExpiresAt: null },
  });
  await logEvent("booking_confirmed", { userId: session.userId, bookingId: booking.id, vehicleId: booking.vehicleId });

  return NextResponse.json({ ok: true, code: confirmed.code });
}
