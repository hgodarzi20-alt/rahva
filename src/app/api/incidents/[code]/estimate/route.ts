import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isResponseDeadlinePassed } from "@/lib/settlement";
import { logEvent } from "@/lib/events";

/**
 * پاسخ مستأجر به صورت‌حساب — استوری ۵.۳.
 * حق اعتراض یک بار است؛ پس از آن تصمیم مدیر نهایی است.
 */
export async function POST(req: Request, { params }: { params: { code: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "ابتدا وارد شوید." }, { status: 401 });

  const incident = await prisma.incidentCase.findUnique({
    where: { trackingCode: params.code.toUpperCase() },
    include: { invoice: true, dispute: true },
  });
  if (!incident || incident.userId !== session.userId) {
    return NextResponse.json({ error: "پرونده پیدا نشد." }, { status: 404 });
  }
  if (incident.status !== "estimate_issued" || !incident.invoice) {
    return NextResponse.json({ error: "در این مرحله پاسخی پذیرفته نمی‌شود." }, { status: 409 });
  }
  if (isResponseDeadlinePassed(incident.invoice.responseDeadline, new Date())) {
    return NextResponse.json(
      { error: "مهلت پاسخ گذشته و صورت‌حساب پذیرفته‌شده تلقی شده است." },
      { status: 409 },
    );
  }

  const body = await req.json();
  const action = body.action as "accept" | "dispute";

  if (action === "accept") {
    await prisma.$transaction(async (tx: any) => {
      await tx.damageInvoice.update({
        where: { id: incident.invoice!.id },
        data: { acceptedAt: new Date() },
      });
      await tx.incidentCase.update({ where: { id: incident.id }, data: { status: "accepted" } });
      await tx.incidentEvent.create({
        data: {
          incidentId: incident.id, type: "status_changed",
          fromValue: "estimate_issued", toValue: "accepted", actorId: session.userId,
        },
      });
    });
    await logEvent("estimate_accepted", {
      userId: session.userId, bookingId: incident.bookingId, vehicleId: incident.vehicleId,
    });
    return NextResponse.json({ ok: true, status: "accepted" });
  }

  if (action === "dispute") {
    if (incident.dispute) {
      return NextResponse.json({ error: "برای این پرونده یک بار اعتراض ثبت شده است." }, { status: 409 });
    }
    const reason = String(body.reason ?? "").trim();
    if (reason.length < 10) {
      return NextResponse.json({ error: "دلیل اعتراض را کامل‌تر بنویسید." }, { status: 400 });
    }
    const disputedItems: number[] = Array.isArray(body.disputedItems)
      ? body.disputedItems.map(Number).filter(Number.isFinite)
      : [];

    await prisma.$transaction(async (tx: any) => {
      await tx.dispute.create({
        data: { incidentId: incident.id, reason, disputedItems, evidenceKeys: [] },
      });
      await tx.incidentCase.update({ where: { id: incident.id }, data: { status: "disputed" } });
      await tx.incidentEvent.create({
        data: {
          incidentId: incident.id, type: "status_changed",
          fromValue: "estimate_issued", toValue: "disputed", actorId: session.userId,
        },
      });
    });
    await logEvent("estimate_disputed", {
      userId: session.userId, bookingId: incident.bookingId, vehicleId: incident.vehicleId,
    });
    return NextResponse.json({ ok: true, status: "disputed" });
  }

  return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
}
