import { BookingStatus } from "@prisma/client";
import { prisma } from "./db";
import { getSettings } from "./settings";
import { refundForNoShow } from "./pricing";

/**
 * گذارهای زمان‌محور ماشین حالت — هیچ کاربری آن‌ها را شروع نمی‌کند.
 * طبق تصمیم مصوب (گزینه ج): موجودی در لحظه‌ی خواندن محاسبه می‌شود،
 * و این توابع وضعیت را در دیتابیس هم واقعی می‌کنند.
 *
 * نکته‌ی مهم: محدودیت سطح دیتابیس، رزروِ pending_payment را بدون توجه به
 * انقضای قفل اشغال‌کننده می‌داند. پس expireLocks باید پیش از هر درج
 * رزرو جدید اجرا شود، وگرنه قفل مرده جلوی رزرو تازه را می‌گیرد.
 */

/** pending_payment با قفل منقضی‌شده → failed */
export async function expireLocks(vehicleId?: number): Promise<number> {
  const res = await prisma.booking.updateMany({
    where: {
      status: BookingStatus.pending_payment,
      lockExpiresAt: { lt: new Date() },
      ...(vehicleId ? { vehicleId } : {}),
    },
    data: { status: BookingStatus.failed, lockExpiresAt: null },
  });
  return res.count;
}

/** confirmed که مهلت مراجعه‌اش گذشته → no_show، با کسر یک روز اجاره */
export async function markNoShows(): Promise<number> {
  const { no_show_grace_hours } = await getSettings();
  const cutoff = new Date(Date.now() - no_show_grace_hours * 60 * 60 * 1000);

  const stale = await prisma.booking.findMany({
    where: { status: BookingStatus.confirmed, pickupAt: { lt: cutoff } },
    select: { id: true, totalAmount: true, dailyRateSnapshot: true },
  });

  for (const b of stale) {
    const { refundAmount, penaltyAmount } = refundForNoShow(b.totalAmount, b.dailyRateSnapshot);
    await prisma.booking.update({
      where: { id: b.id },
      data: { status: BookingStatus.no_show, refundAmount, penaltyAmount },
    });
  }
  return stale.length;
}

export async function sweep() {
  const expired = await expireLocks();
  const noShows = await markNoShows();
  return { expired, noShows };
}

/**
 * آیا این رزرو تأییدشده از زمان تحویلش گذشته ولی هنوز در مهلت است؟
 * برای برچسب «تأخیر در مراجعه» در پنل اپراتور (استوری ۴.۱ بند ۳).
 */
export function isLateForPickup(pickupAt: Date, graceHours: number): boolean {
  const now = Date.now();
  return now > pickupAt.getTime() && now < pickupAt.getTime() + graceHours * 3600 * 1000;
}
