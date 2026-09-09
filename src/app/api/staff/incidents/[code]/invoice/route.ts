import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import {
  buildDeductibleItem, buildRentalCreditItem, canWaivePoliceReport,
  ITEM_LABEL_FA, MANUAL_ITEM_TYPES, responseDeadlineFrom, totals,
  type DraftItem, type InvoiceItemType,
} from "@/lib/settlement";
import { logEvent } from "@/lib/events";

/**
 * تشکیل و صدور صورت‌حساب — استوری ۵.۲.
 * فرانشیز و اعتبار روزهای استفاده‌نشده را سیستم می‌سازد؛
 * امداد، خواب خودرو و پارکینگ را اپراتور دستی وارد می‌کند.
 */
export async function POST(req: Request, { params }: { params: { code: string } }) {
  const session = await getSession();
  if (!session || session.role !== "operator") {
    return NextResponse.json({ error: "دسترسی ندارید." }, { status: 403 });
  }

  const incident = await prisma.incidentCase.findUnique({
    where: { trackingCode: params.code.toUpperCase() },
    include: {
      booking: { include: { rental: true } },
      invoice: { include: { items: true } },
    },
  });
  if (!incident || !incident.invoice) {
    return NextResponse.json({ error: "ابتدا بازرسی را ثبت کنید." }, { status: 409 });
  }
  if (incident.status !== "under_assessment") {
    return NextResponse.json({ error: "صورت‌حساب این پرونده قابل تغییر نیست." }, { status: 409 });
  }

  const body = await req.json();
  const settings = await getSettings();
  const gross = incident.invoice.grossRepairEstimate;

  const waived = Boolean(body.policeReportWaived);
  if (waived && !canWaivePoliceReport(gross, settings["police_report.waiver_ceiling_toman"])) {
    return NextResponse.json(
      { error: "برآورد از سقف مصوب بیشتر است و چشم‌پوشی از کروکی ممکن نیست." },
      { status: 400 },
    );
  }

  // ─── اقلام دستی اپراتور ───
  const manual: DraftItem[] = [];
  for (const type of MANUAL_ITEM_TYPES) {
    const raw = Number(body.manual?.[type]);
    if (!Number.isFinite(raw) || raw <= 0) continue;
    manual.push({
      type,
      label: ITEM_LABEL_FA[type],
      amount: Math.round(raw),
      basis: (body.basis?.[type] as string) || null,
      isSystemGenerated: false,
    });
  }

  // ─── اقلام سیستمی ───
  const items: DraftItem[] = [];

  /**
   * مسیر مالی بر اساس مقصر تأییدشده:
   *  مقصر طرف مقابل + کروکی موجود → سهم کاربر صفر
   *  مقصر کاربر + کروکی موجود      → فرانشیز
   *  بدون کروکی                    → کل خسارت بر عهده کاربر
   */
  const hasReport = incident.policeReportStatus === "uploaded" || waived;
  const otherAtFault = incident.confirmedFault === "other_party";

  if (!hasReport) {
    items.push({
      type: "repair_deductible",
      label: "خسارت تعمیر — بدون کروکی",
      amount: gross,
      basis: "بدون کروکی، بیمه بدنه پرداختی ندارد",
      isSystemGenerated: true,
    });
  } else if (!otherAtFault) {
    items.push(buildDeductibleItem(gross, settings["franchise.percent"]));
  }

  items.push(...manual);

  // اعتبار روزهای استفاده‌نشده — قلم منفی، منبعش پرداخت اجاره است
  const handoverAt = incident.booking.rental?.checkoutAt ?? null;
  const incidentAt = incident.occurredAt ?? incident.createdAt;
  if (handoverAt) {
    const credit = buildRentalCreditItem({
      handoverAt,
      incidentAt,
      totalDays: incident.booking.days,
      dailyRate: incident.booking.dailyRateSnapshot,
    });
    if (credit) items.push(credit);
  }

  const issue = Boolean(body.issue);
  const issuedAt = new Date();
  const deadline = responseDeadlineFrom(issuedAt, settings["deadline.invoice_response_hours"]);

  await prisma.$transaction(async (tx: any) => {
    await tx.invoiceItem.deleteMany({ where: { invoiceId: incident.invoice!.id } });
    await tx.invoiceItem.createMany({
      data: items.map((i) => ({ invoiceId: incident.invoice!.id, ...i })),
    });
    await tx.damageInvoice.update({
      where: { id: incident.invoice!.id },
      data: {
        policeReportWaived: waived,
        ...(issue ? { issuedAt, responseDeadline: deadline } : {}),
      },
    });
    if (issue) {
      await tx.incidentCase.update({
        where: { id: incident.id },
        data: { status: "estimate_issued" },
      });
      await tx.incidentEvent.create({
        data: {
          incidentId: incident.id,
          type: "status_changed",
          fromValue: "under_assessment",
          toValue: "estimate_issued",
          actorId: session.userId,
        },
      });
      // پیامک شبیه‌سازی‌شده — در پنل مدیر قابل مشاهده است
      await tx.notificationLog.create({
        data: {
          kind: "estimate_issued",
          recipient: String(incident.userId),
          body: `رهوا — صورت‌حساب پرونده ${incident.trackingCode} صادر شد.`,
          bookingId: incident.bookingId,
          incidentId: incident.id,
        },
      });
    }
  });

  if (issue) {
    await logEvent("estimate_issued", {
      userId: session.userId, bookingId: incident.bookingId, vehicleId: incident.vehicleId,
    });
  }

  return NextResponse.json({ ok: true, ...totals(items), issued: issue });
}
