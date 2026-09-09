import { NextResponse } from "next/server";
import { BookingStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { computeReturnCharges } from "@/lib/pricing";
import { logEvent } from "@/lib/events";

/** ثبت بازگشت خودرو — استوری ۴.۳ */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== "operator") {
    return NextResponse.json({ error: "دسترسی ندارید." }, { status: 403 });
  }

  const body = await req.json();
  const settings = await getSettings();
  const booking = await prisma.booking.findUnique({
    where: { id: Number(params.id) },
    include: { rental: true },
  });

  if (!booking || !booking.rental) return NextResponse.json({ error: "رزرو یا رکورد تحویل پیدا نشد." }, { status: 404 });
  if (booking.status !== BookingStatus.active) {
    return NextResponse.json({ error: "فقط رزرو در حال اجاره قابل بازگشت است." }, { status: 409 });
  }

  const checkinOdometer = Number(body.checkinOdometer);
  if (!Number.isFinite(checkinOdometer) || checkinOdometer < booking.rental.checkoutOdometer) {
    return NextResponse.json(
      { error: "کیلومتر نهایی نمی‌تواند کمتر از کیلومتر اولیه باشد." },
      { status: 400 },
    );
  }

  const checkinAt = new Date();
  const charges = computeReturnCharges({
    days: booking.days,
    dailyRate: booking.dailyRateSnapshot,
    dailyKmLimit: booking.dailyKmLimitSnapshot,
    extraKmRate: booking.extraKmRateSnapshot,
    dropoffAt: booking.dropoffAt,
    checkinAt,
    checkoutOdometer: booking.rental.checkoutOdometer,
    checkinOdometer,
    lateGraceHours: settings.late_grace_hours,
    lateFeePercent: settings.late_fee_percent,
  });

  await prisma.$transaction([
    prisma.rental.update({
      where: { bookingId: booking.id },
      data: {
        checkinAt,
        checkinOdometer,
        checkinFuel: body.checkinFuel ?? "1/1",
        checkinById: session.userId,
        ...charges,
        chargesCollected: charges.chargesTotal === 0 ? true : Boolean(body.chargesCollected),
      },
    }),
    prisma.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.completed },
    }),
  ]);

  await logEvent("car_returned", { userId: session.userId, bookingId: booking.id, vehicleId: booking.vehicleId });
  return NextResponse.json({ ok: true, charges });
}
