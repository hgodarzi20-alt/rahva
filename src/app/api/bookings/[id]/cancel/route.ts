import { NextResponse } from "next/server";
import { BookingStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { refundForCancellation } from "@/lib/pricing";
import { logEvent } from "@/lib/events";

/** لغو رزرو توسط مشتری — استوری ۳.۳ */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "ابتدا وارد شوید." }, { status: 401 });

  const settings = await getSettings();
  const booking = await prisma.booking.findUnique({ where: { id: Number(params.id) } });

  if (!booking || booking.userId !== session.userId) {
    return NextResponse.json({ error: "رزرو پیدا نشد." }, { status: 404 });
  }
  if (booking.status !== BookingStatus.confirmed) {
    return NextResponse.json({ error: "فقط رزرو تأییدشده قابل لغو است." }, { status: 409 });
  }

  const hoursLeft = (booking.pickupAt.getTime() - Date.now()) / 3_600_000;
  if (hoursLeft < settings.cancel_deadline_hours) {
    return NextResponse.json(
      { error: `لغو فقط تا ${settings.cancel_deadline_hours} ساعت پیش از زمان تحویل ممکن است.` },
      { status: 409 },
    );
  }

  const { refundAmount, penaltyAmount } = refundForCancellation(booking.totalAmount);
  await prisma.booking.update({
    where: { id: booking.id },
    data: { status: BookingStatus.cancelled, cancelledAt: new Date(), refundAmount, penaltyAmount },
  });
  await logEvent("booking_cancelled", { userId: session.userId, bookingId: booking.id, vehicleId: booking.vehicleId });

  return NextResponse.json({ ok: true, refundAmount });
}
