import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { grossRepairEstimate } from "@/lib/settlement";
import { logEvent } from "@/lib/events";

/**
 * ثبت بازرسی خسارت — استوری ۵.۱.
 * اقلام خسارت جدید با مبلغ برآوردی ثبت می‌شوند و gross_repair_estimate
 * از مجموعشان محاسبه می‌شود، نه با ورود دستی.
 */
export async function POST(req: Request, { params }: { params: { code: string } }) {
  const session = await getSession();
  if (!session || session.role !== "operator") {
    return NextResponse.json({ error: "دسترسی ندارید." }, { status: 403 });
  }

  const incident = await prisma.incidentCase.findUnique({
    where: { trackingCode: params.code.toUpperCase() },
    include: { booking: { include: { rental: true } }, invoice: true },
  });
  if (!incident) return NextResponse.json({ error: "پرونده پیدا نشد." }, { status: 404 });
  if (incident.status !== "documented" && incident.status !== "vehicle_recovered") {
    return NextResponse.json(
      { error: "بازرسی فقط پس از تکمیل مستندات و تحویل خودرو ممکن است." },
      { status: 409 },
    );
  }
  if (!incident.booking.rental) {
    return NextResponse.json({ error: "رکورد تحویل خودرو پیدا نشد." }, { status: 409 });
  }

  const body = await req.json();
  const damages: { title?: string; location?: string; estimateAmount?: number }[] =
    Array.isArray(body.damages) ? body.damages : [];

  const clean = damages
    .filter((d) => d.title?.trim())
    .map((d) => ({
      title: d.title!.trim(),
      location: (d.location ?? "").trim(),
      estimateAmount: Math.max(0, Math.round(Number(d.estimateAmount) || 0)),
    }));

  if (!clean.length) {
    return NextResponse.json({ error: "حداقل یک قلم خسارت با مبلغ برآوردی ثبت کنید." }, { status: 400 });
  }

  const confirmedFault = body.confirmedFault as "self" | "other_party" | "unknown" | undefined;
  if (!confirmedFault) {
    return NextResponse.json({ error: "مقصر حادثه را تعیین کنید." }, { status: 400 });
  }

  const gross = grossRepairEstimate(clean.map((d) => d.estimateAmount));
  const rentalId = incident.booking.rental.id;

  await prisma.$transaction(async (tx: any) => {
    // بازرسی یک بار ثبت می‌شود؛ اجرای دوباره اقلام قبلی را جایگزین می‌کند
    await tx.damageItem.deleteMany({ where: { rentalId, phase: "checkin" } });
    await tx.damageItem.createMany({
      data: clean.map((d) => ({ rentalId, phase: "checkin" as const, ...d })),
    });

    // صورت‌حساب در این مرحله ساخته می‌شود ولی هنوز صادر نشده
    await tx.damageInvoice.upsert({
      where: { incidentId: incident.id },
      update: { grossRepairEstimate: gross },
      create: { incidentId: incident.id, grossRepairEstimate: gross, createdById: session.userId },
    });

    await tx.incidentCase.update({
      where: { id: incident.id },
      data: { status: "under_assessment", confirmedFault },
    });

    // خودرو تا پایان تعمیر از موجودی رزرو خارج می‌شود — استوری ۵.۴
    await tx.vehicle.update({
      where: { id: incident.vehicleId },
      data: { status: "under_repair" },
    });

    await tx.incidentEvent.create({
      data: {
        incidentId: incident.id,
        type: "status_changed",
        fromValue: incident.status,
        toValue: "under_assessment",
        actorId: session.userId,
        meta: { gross, items: clean.length, confirmedFault },
      },
    });
  });

  return NextResponse.json({ ok: true, gross });
}
