import { prisma } from "./db";
import { isResponseDeadlinePassed } from "./settlement";

/**
 * پذیرش خودکار صورت‌حساب پس از انقضای مهلت — استوری ۵.۳ بند ۴.
 *
 * محاسبه تنبل: هر بار پرونده خوانده می‌شود این تابع صدا زده می‌شود.
 * زمان‌بند مستقل لازم نیست و برای این مقیاس کافی است.
 */
export async function settleExpiredEstimate(incidentId: number): Promise<boolean> {
  const incident = await prisma.incidentCase.findUnique({
    where: { id: incidentId },
    include: { invoice: true },
  });
  if (!incident || incident.status !== "estimate_issued" || !incident.invoice) return false;
  if (!isResponseDeadlinePassed(incident.invoice.responseDeadline, new Date())) return false;

  await prisma.$transaction(async (tx: any) => {
    await tx.damageInvoice.update({
      where: { id: incident.invoice!.id },
      data: { autoAcceptedAt: new Date() },
    });
    await tx.incidentCase.update({ where: { id: incident.id }, data: { status: "accepted" } });
    await tx.incidentEvent.create({
      data: {
        incidentId: incident.id,
        type: "auto_accepted",
        fromValue: "estimate_issued",
        toValue: "accepted",
      },
    });
  });
  return true;
}
