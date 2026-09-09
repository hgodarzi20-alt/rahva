import { EventType, Prisma } from "@prisma/client";
import { prisma } from "./db";

/**
 * جدول رویدادها — پایه‌ی متریک‌های قیف تبدیل.
 * طبق تصمیم مصوب هیچ شناسه‌ی ردیابی برای کاربران مهمان ذخیره نمی‌شود،
 * پس اعداد قیف تجمیعی‌اند و مسیر یک کاربر مشخص را دنبال نمی‌کنند.
 */
export async function logEvent(
  type: EventType,
  data: {
    userId?: number | null;
    bookingId?: number | null;
    vehicleId?: number | null;
    payload?: Prisma.InputJsonValue;
  } = {},
) {
  try {
    await prisma.event.create({
      data: {
        type,
        userId: data.userId ?? null,
        bookingId: data.bookingId ?? null,
        vehicleId: data.vehicleId ?? null,
        payload: data.payload,
      },
    });
  } catch (e) {
    // ثبت رویداد هرگز نباید مسیر اصلی کاربر را بشکند
    console.error("event log failed:", type, e);
  }
}
