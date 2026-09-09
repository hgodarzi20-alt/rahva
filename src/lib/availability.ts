import { BookingStatus, Prisma } from "@prisma/client";
import { prisma } from "./db";

/** وضعیت‌هایی که خودرو را در بازه اشغال می‌کنند. */
export const OCCUPYING: BookingStatus[] = [
  BookingStatus.pending_payment,
  BookingStatus.confirmed,
  BookingStatus.active,
];

/**
 * شرط هم‌پوشانی دو بازه: [aStart, aEnd) ∩ [bStart, bEnd) ≠ ∅
 * قفلِ منقضی‌شده اشغال‌کننده حساب نمی‌شود (گزینه ج — محاسبه در لحظه‌ی خواندن).
 */
function occupyingWhere(from: Date, to: Date): Prisma.BookingWhereInput {
  return {
    status: { in: OCCUPYING },
    pickupAt: { lt: to },
    dropoffAt: { gt: from },
    OR: [
      { status: { in: [BookingStatus.confirmed, BookingStatus.active] } },
      {
        status: BookingStatus.pending_payment,
        lockExpiresAt: { gt: new Date() },
      },
    ],
  };
}

export async function busyVehicleIds(from: Date, to: Date): Promise<number[]> {
  const rows = await prisma.booking.findMany({
    where: occupyingWhere(from, to),
    select: { vehicleId: true },
    distinct: ["vehicleId"],
  });
  return rows.map((r) => r.vehicleId);
}

export type SearchFilters = {
  vehicleClass?: string[];
  transmission?: string[];
  minPrice?: number;
  maxPrice?: number;
  minSeats?: number;
  sort?: "price_asc" | "price_desc";
};

export async function findAvailableVehicles(from: Date, to: Date, filters: SearchFilters = {}) {
  const busy = await busyVehicleIds(from, to);

  return prisma.vehicle.findMany({
    where: {
      status: "available", // خودروی تعمیرگاه نمایش داده نمی‌شود (استوری ۱.۲ بند ۲)
      id: { notIn: busy.length ? busy : [-1] },
      ...(filters.vehicleClass?.length
        ? { vehicleClass: { in: filters.vehicleClass as never[] } }
        : {}),
      ...(filters.transmission?.length
        ? { transmission: { in: filters.transmission as never[] } }
        : {}),
      ...(filters.minSeats ? { seats: { gte: filters.minSeats } } : {}),
      ...(filters.minPrice || filters.maxPrice
        ? {
            dailyRate: {
              ...(filters.minPrice ? { gte: filters.minPrice } : {}),
              ...(filters.maxPrice ? { lte: filters.maxPrice } : {}),
            },
          }
        : {}),
    },
    orderBy: { dailyRate: filters.sort === "price_desc" ? "desc" : "asc" },
  });
}

/** آیا این خودرو در این بازه آزاد است؟ برای بررسی دوباره پیش از تأیید پرداخت. */
export async function isVehicleFree(
  vehicleId: number,
  from: Date,
  to: Date,
  ignoreBookingId?: number,
): Promise<boolean> {
  const clash = await prisma.booking.findFirst({
    where: {
      vehicleId,
      ...(ignoreBookingId ? { id: { not: ignoreBookingId } } : {}),
      ...occupyingWhere(from, to),
    },
    select: { id: true },
  });
  return clash === null;
}

/**
 * بازه‌های جایگزین برای حالت بدون نتیجه (استوری ۱.۲ بند ۶).
 * سه بازه‌ی هم‌طول در روزهای پیش‌رو که موجودی دارند.
 */
export async function suggestAlternatives(from: Date, to: Date, limit = 3) {
  const spanMs = to.getTime() - from.getTime();
  const out: { from: Date; to: Date; count: number }[] = [];

  for (let shift = 1; shift <= 14 && out.length < limit; shift++) {
    const altFrom = new Date(from.getTime() + shift * 24 * 60 * 60 * 1000);
    const altTo = new Date(altFrom.getTime() + spanMs);
    const busy = await busyVehicleIds(altFrom, altTo);
    const count = await prisma.vehicle.count({
      where: { status: "available", id: { notIn: busy.length ? busy : [-1] } },
    });
    if (count > 0) out.push({ from: altFrom, to: altTo, count });
  }
  return out;
}
