import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { makeTrackingCode } from "@/lib/incident";
import { logEvent } from "@/lib/events";

/**
 * ثبت اولیه پرونده حادثه — گام ۶ جرنی.
 * عمداً حداقلی است: کاربر ممکن است کنار جاده باشد و نباید
 * پیش از صدور کد پیگیری، فرم بلند پر کند.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "ابتدا وارد شوید." }, { status: 401 });

  const body = await req.json();
  const bookingId = Number(body.bookingId);

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { incident: true },
  });
  if (!booking || booking.userId !== session.userId) {
    return NextResponse.json({ error: "رزرو پیدا نشد." }, { status: 404 });
  }
  if (booking.status !== "active") {
    return NextResponse.json({ error: "فقط برای سفر فعال می‌توان حادثه ثبت کرد." }, { status: 409 });
  }
  // هر رزرو حداکثر یک پرونده — محدودیت PRD
  if (booking.incident) {
    return NextResponse.json(
      { error: "برای این سفر پرونده حادثه ثبت شده است.", trackingCode: booking.incident.trackingCode },
      { status: 409 },
    );
  }

  const hasInjury = body.hasInjury === true;
  const count = await prisma.incidentCase.count();

  const incident = await prisma.incidentCase.create({
    data: {
      trackingCode: makeTrackingCode(count + 1),
      bookingId: booking.id,
      vehicleId: booking.vehicleId,
      userId: session.userId,
      // مسیر مصدوم از سیستم خارج می‌شود و به پیگیری تلفنی می‌رود
      status: hasInjury ? "reported_injury" : "reported",
      type: hasInjury ? null : body.type ?? null,
      isDrivable: hasInjury ? null : body.isDrivable ?? null,
      latitude: body.latitude ?? null,
      longitude: body.longitude ?? null,
      address: body.address ?? null,
      occurredAt: new Date(),
    },
  });

  // ودیعه معلق می‌شود؛ تا صدور برآورد هیچ کسری انجام نمی‌شود
  await prisma.deposit.updateMany({
    where: { bookingId: booking.id, status: "held" },
    data: { status: "suspended" },
  });

  await prisma.incidentEvent.create({
    data: {
      incidentId: incident.id,
      type: "status_changed",
      toValue: incident.status,
      actorId: session.userId,
    },
  });

  await logEvent("incident_reported", {
    userId: session.userId, bookingId: booking.id, vehicleId: booking.vehicleId,
  });

  return NextResponse.json({ ok: true, trackingCode: incident.trackingCode, id: incident.id });
}