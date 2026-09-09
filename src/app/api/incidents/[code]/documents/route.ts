import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { logEvent } from "@/lib/events";

/** شش زاویه راهنمایی‌شده — استوری ۴.۱ بند ۱ */
const REQUIRED_PHOTOS = 6;

/**
 * ثبت مستندات حادثه — گام ۴ و ۵ جرنی.
 * وضعیت پرونده به documented می‌رود و وضعیت کروکی به‌عنوان
 * محوری مستقل ثبت می‌شود.
 */
export async function POST(req: Request, { params }: { params: { code: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "ابتدا وارد شوید." }, { status: 401 });

  const incident = await prisma.incidentCase.findUnique({
    where: { trackingCode: params.code.toUpperCase() },
       include: { photos: true, booking: { select: { pickupAt: true, rental: { select: { checkoutAt: true } } } } },
  });
  if (!incident || incident.userId !== session.userId) {
    return NextResponse.json({ error: "پرونده پیدا نشد." }, { status: 404 });
  }
  if (incident.status === "reported_injury") {
    return NextResponse.json({ error: "این پرونده به‌صورت تلفنی پیگیری می‌شود." }, { status: 409 });
  }
  if (incident.status !== "reported") {
    return NextResponse.json({ error: "مستندات این پرونده قبلاً ثبت شده است." }, { status: 409 });
  }
  if (incident.photos.length < REQUIRED_PHOTOS) {
    return NextResponse.json({ error: `حداقل ${REQUIRED_PHOTOS} عکس لازم است.` }, { status: 400 });
  }

  const body = await req.json();

  // تاریخ و ساعت حادثه — استوری ۴.۱ بند ۲
  const occurredAt = body.occurredAt ? new Date(body.occurredAt) : null;
  if (!occurredAt || Number.isNaN(occurredAt.getTime())) {
    return NextResponse.json({ error: "تاریخ و ساعت حادثه را وارد کنید." }, { status: 400 });
  }
  if (occurredAt.getTime() > Date.now() + 60_000) {
    return NextResponse.json({ error: "زمان حادثه نمی‌تواند در آینده باشد." }, { status: 400 });
  }
   // مبنا زمان واقعی تحویل است، نه زمان برنامه‌ریزی‌شده رزرو
  const handoverAt = incident.booking.rental?.checkoutAt ?? incident.booking.pickupAt;
  if (occurredAt.getTime() < handoverAt.getTime()) {
    return NextResponse.json({ error: "زمان حادثه نمی‌تواند پیش از تحویل خودرو باشد." }, { status: 400 });
  }

  const policeStatus = body.policeReportStatus as "uploaded" | "pending" | "not_obtained" | null;
  if (!policeStatus) {
    return NextResponse.json({ error: "وضعیت کروکی را مشخص کنید." }, { status: 400 });
  }
  // پذیرش ریسک برای حالت «تنظیم نشد» اجباری است — بند قرارداد
  if (policeStatus === "not_obtained" && !body.riskAccepted) {
    return NextResponse.json({ error: "پذیرش مسئولیت مالی الزامی است." }, { status: 400 });
  }
  // ادعای «کروکی را دارم» بدون سند پذیرفته نمی‌شود
  if (policeStatus === "uploaded" && !incident.policeReportFileKey) {
    return NextResponse.json({ error: "تصویر کروکی را آپلود کنید." }, { status: 400 });
  }

  const settings = await getSettings();
  const deadlineDays = settings["deadline.police_report_days"];

  await prisma.$transaction(async (tx) => {
    if (body.counterparty) {
      const c = body.counterparty;
      await tx.counterpartyInfo.upsert({
        where: { incidentId: incident.id },
        update: {
          fullName: c.fullName || null,
          phone: c.phone || null,
          plateNumber: c.plateNumber || null,
          insurerName: c.insurerName || null,
          policyNumber: c.policyNumber || null,
          policyValidTo: c.policyValidTo ? new Date(c.policyValidTo) : null,
        },
        create: {
          incidentId: incident.id,
          fullName: c.fullName || null,
          phone: c.phone || null,
          plateNumber: c.plateNumber || null,
          insurerName: c.insurerName || null,
          policyNumber: c.policyNumber || null,
          policyValidTo: c.policyValidTo ? new Date(c.policyValidTo) : null,
        },
      });
    }

    if (body.obstacle) {
      const o = body.obstacle;
      await tx.obstacleInfo.upsert({
        where: { incidentId: incident.id },
        update: {
          ownership: o.ownership,
          ownerNote: o.ownerNote || null,
          flaggedForFollowUp: o.ownership === "third_party",
        },
        create: {
          incidentId: incident.id,
          ownership: o.ownership,
          ownerNote: o.ownerNote || null,
          flaggedForFollowUp: o.ownership === "third_party",
        },
      });
    }

    await tx.incidentCase.update({
      where: { id: incident.id },
      data: {
        status: "documented",
        occurredAt,
        description: body.description || null,
        faultClaim: body.faultClaim ?? null,
        policeImpounded: body.policeImpounded === true,
        policeReportStatus: policeStatus,
        // مهلت فقط وقتی معنا دارد که کروکی تنظیم شده ولی نسخه‌اش نرسیده
        policeReportDeadline:
          policeStatus === "pending"
            ? new Date(Date.now() + deadlineDays * 86400000)
            : null,
        riskAcceptedAt: policeStatus === "not_obtained" ? new Date() : null,
      },
    });

    await tx.incidentEvent.create({
      data: {
        incidentId: incident.id,
        type: "status_changed",
        fromValue: incident.status,
        toValue: "documented",
        actorId: session.userId,
      },
    });
  });

  await logEvent("incident_documented", {
    userId: session.userId, bookingId: incident.bookingId, vehicleId: incident.vehicleId,
  });

  return NextResponse.json({ ok: true });
}