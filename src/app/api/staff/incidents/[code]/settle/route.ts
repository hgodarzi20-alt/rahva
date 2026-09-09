import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isResponseDeadlinePassed, settleDeposit, totals } from "@/lib/settlement";
import { logEvent } from "@/lib/events";

/**
 * تسویه نهایی پرونده — استوری ۶.۱.
 *
 * دو منبع مالی، دو دستور واریز مستقل:
 *   ودیعه        → اقلام خسارت، مابقی مسترد می‌شود
 *   پرداخت اجاره → اعتبار روزهای استفاده‌نشده
 *
 * پذیرش خودکار پس از مهلت اینجا ارزیابی می‌شود، نه با زمان‌بند.
 * کاربری که پاسخ نداده، در لحظه تسویه پذیرفته تلقی می‌شود.
 */
export async function POST(req: Request, { params }: { params: { code: string } }) {
  const session = await getSession();
  if (!session || session.role !== "operator") {
    return NextResponse.json({ error: "دسترسی ندارید." }, { status: 403 });
  }

  const incident = await prisma.incidentCase.findUnique({
    where: { trackingCode: params.code.toUpperCase() },
    include: {
      invoice: { include: { items: true } },
      booking: { include: { deposit: true } },
    },
  });

  if (!incident || !incident.invoice) {
    return NextResponse.json({ error: "پرونده پیدا نشد." }, { status: 404 });
  }
  if (!incident.invoice.issuedAt) {
    return NextResponse.json({ error: "صورت‌حساب هنوز صادر نشده است." }, { status: 409 });
  }

  const now = new Date();

  /**
   * ارزیابی تنبل مهلت پاسخ. اگر مهلت گذشته و کاربر نه پذیرفته نه اعتراض کرده،
   * پرونده همین‌جا پذیرفته‌شده تلقی می‌شود — همان چیزی که به کاربر اعلام شده بود.
   */
  const autoAccept =
    incident.status === "estimate_issued" &&
    isResponseDeadlinePassed(incident.invoice.responseDeadline, now);

  const effectiveStatus = autoAccept ? "accepted" : incident.status;

  if (effectiveStatus !== "accepted" && effectiveStatus !== "resolved") {
    return NextResponse.json(
      { error: "این پرونده در مرحله تسویه نیست." },
      { status: 409 },
    );
  }

  const deposit = incident.booking.deposit;
  if (!deposit) {
    return NextResponse.json(
      { error: "ودیعه‌ای برای این رزرو ثبت نشده است." },
      { status: 409 },
    );
  }
  if (deposit.status !== "held" && deposit.status !== "suspended") {
    return NextResponse.json({ error: "ودیعه این پرونده قبلاً تسویه شده است." }, { status: 409 });
  }

  const t = totals(incident.invoice.items);
  const result = settleDeposit({
    damageTotal: t.damageTotal,
    rentalCreditTotal: t.rentalCreditTotal,
    depositAmount: deposit.amount,
  });

  // بدون شبا نمی‌توان دستور واریز صادر کرد
  const iban = incident.booking.refundIban;
  const needsPayout = result.depositRefund > 0 || result.rentalCreditPayout > 0;
  if (needsPayout && !iban) {
    return NextResponse.json(
      { error: "شماره شبای کاربر ثبت نشده و امکان صدور دستور واریز نیست." },
      { status: 409 },
    );
  }

  await prisma.$transaction(async (tx: any) => {
    if (autoAccept) {
      await tx.damageInvoice.update({
        where: { id: incident.invoice!.id },
        data: { autoAcceptedAt: now },
      });
      await tx.incidentEvent.create({
        data: {
          incidentId: incident.id,
          type: "status_changed",
          fromValue: "estimate_issued",
          toValue: "accepted",
          actorId: session.userId,
          meta: { reason: "auto_accepted_after_deadline" },
        },
      });
    }

    await tx.deposit.update({
      where: { id: deposit.id },
      data: { status: result.depositStatus, releasedAt: now },
    });

    if (result.depositRefund > 0) {
      await tx.payout.create({
        data: {
          bookingId: incident.bookingId,
          type: "deposit_refund",
          amount: result.depositRefund,
          iban: iban!,
        },
      });
    }

    if (result.rentalCreditPayout > 0) {
      await tx.payout.create({
        data: {
          bookingId: incident.bookingId,
          type: "rental_credit",
          amount: result.rentalCreditPayout,
          iban: iban!,
        },
      });
    }

    await tx.incidentCase.update({ where: { id: incident.id }, data: { status: "settled" } });

    await tx.incidentEvent.create({
      data: {
        incidentId: incident.id,
        type: "status_changed",
        fromValue: effectiveStatus,
        toValue: "settled",
        actorId: session.userId,
        meta: {
          damageTotal: t.damageTotal,
          deductedFromDeposit: result.deductedFromDeposit,
          depositRefund: result.depositRefund,
          rentalCreditPayout: result.rentalCreditPayout,
          shortfall: result.shortfall,
        },
      },
    });

    // رزروی که با حادثه پایان یافته، completed نیست
    if (incident.booking.status !== "closed_with_incident") {
      await tx.booking.update({
        where: { id: incident.bookingId },
        data: { status: "closed_with_incident" },
      });
    }

    const body =
      result.shortfall > 0
        ? `رهوا — پرونده ${incident.trackingCode} تسویه شد. ودیعه کسر شد و مبلغ ${result.shortfall.toLocaleString("fa-IR")} تومان بدهی باقی است.`
        : `رهوا — پرونده ${incident.trackingCode} تسویه شد. مبلغ ${(result.depositRefund + result.rentalCreditPayout).toLocaleString("fa-IR")} تومان به حساب شما واریز می‌شود.`;

    await tx.notificationLog.create({
      data: {
        kind: "settlement_done",
        recipient: String(incident.userId),
        body,
        bookingId: incident.bookingId,
        incidentId: incident.id,
      },
    });
  });

  await logEvent("incident_settled", {
    userId: session.userId,
    bookingId: incident.bookingId,
    vehicleId: incident.vehicleId,
  });

  return NextResponse.json({ ok: true, autoAccepted: autoAccept, ...result });
}
