import { NextResponse } from "next/server";
import { BookingStatus, Prisma } from "@prisma/client";

import {
  isValidNationalId,
  validateIban,
  checkDriverEligibility,
  type EligibilityError,
} from "@/lib/identity";
import { blindIndex, encryptField } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { computeDays, quote } from "@/lib/pricing";
import { generateBookingCode } from "@/lib/format";
import { expireLocks } from "@/lib/sweep";
import { logEvent } from "@/lib/events";
import { findAvailableVehicles } from "@/lib/availability";

const IBAN_MESSAGES: Record<"format" | "checksum" | "unknown_bank", string> = {
  format: "شماره شبا باید با IR شروع شود و پس از آن ۲۴ رقم داشته باشد.",
  checksum: "شماره شبا معتبر نیست. ارقام را بازبینی کنید.",
  unknown_bank: "بانک این شماره شبا شناسایی نشد. شبای حساب دیگری وارد کنید.",
};

const CONFLICT_MESSAGE =
  "این خودرو در بازه‌ی انتخابی شما رزرو شد. لطفا خودروی دیگری انتخاب کنید.";

/** ایجاد رزرو + قفل خودرو — استوری ۲.۳ و اپیک ۰ */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "ابتدا وارد شوید." }, { status: 401 });
  }

  const body = await req.json();

  const vehicleId = Number(body.vehicleId);
  const pickupAt = new Date(body.pickupAt);
  const dropoffAt = new Date(body.dropoffAt);

  const { driverName, driverLicenseNumber, driverNationalId, refundIban } = body;
  const driverBirthDate = new Date(body.driverBirthDate);
  const driverLicenseExpiry = new Date(body.driverLicenseExpiry);

  if (
    !vehicleId ||
    isNaN(pickupAt.getTime()) ||
    isNaN(dropoffAt.getTime()) ||
    dropoffAt <= pickupAt
  ) {
    return NextResponse.json({ error: "اطلاعات رزرو نامعتبر است." }, { status: 400 });
  }

  const settings = await getSettings();

  /**
   * V2 — مسدودسازی رزرو تا تسویه بدهی.
   * مازاد خسارت بر ودیعه به بدهی تبدیل می‌شود و تا پرداخت آن،
   * کاربر رزرو جدید نمی‌گیرد.
   */
  const outstanding = await prisma.debt.findFirst({
    where: { userId: session.userId, status: "outstanding" },
    select: { amount: true },
  });
  if (outstanding) {
    return NextResponse.json(
      {
        error: `تا تسویه بدهی ${outstanding.amount.toLocaleString("fa-IR")} تومانی، امکان رزرو جدید وجود ندارد.`,
        debt: true,
      },
      { status: 409 },
    );
  }

  // ─── V2 — اپیک ۰: احراز هویت راننده ───

  if (typeof driverName !== "string" || driverName.trim().length < 3) {
    return NextResponse.json({ error: "نام و نام خانوادگی راننده الزامی است." }, { status: 400 });
  }

  if (typeof driverLicenseNumber !== "string" || driverLicenseNumber.trim() === "") {
    return NextResponse.json({ error: "شماره گواهینامه الزامی است." }, { status: 400 });
  }

  if (!isValidNationalId(driverNationalId ?? "")) {
    return NextResponse.json({ error: "کد ملی معتبر نیست." }, { status: 400 });
  }

  const ibanCheck = validateIban(refundIban ?? "");
  if (!ibanCheck.ok) {
    return NextResponse.json({ error: IBAN_MESSAGES[ibanCheck.reason] }, { status: 400 });
  }

  // این دو تاریخ برخلاف pickup و dropoff اعتبارسنجی نداشتند. تاریخ نامعتبر
  // در ageAt به NaN می‌رسید و چون NaN < 21 برابر false است، شرط سن بی‌صدا رد می‌شد.
  if (isNaN(driverBirthDate.getTime())) {
    return NextResponse.json({ error: "تاریخ تولد راننده الزامی است." }, { status: 400 });
  }
  if (isNaN(driverLicenseExpiry.getTime())) {
    return NextResponse.json({ error: "تاریخ انقضای گواهینامه الزامی است." }, { status: 400 });
  }

  const marginMonths = settings["driver.license_validity_margin_months"];
  const eligibilityErrors = checkDriverEligibility({
    birthDate: driverBirthDate,
    licenseExpiry: driverLicenseExpiry,
    referenceDate: pickupAt,
    minAgeYears: settings.min_driver_age,
    licenseValidityMarginMonths: marginMonths,
  });

  if (eligibilityErrors.length > 0) {
    const messages: Record<EligibilityError, string> = {
      under_age: `حداقل سن مجاز برای اجاره ${settings.min_driver_age} سال است.`,
      license_expiring_too_soon: `اعتبار گواهینامه باید حداقل تا ${marginMonths} ماه پس از تاریخ تحویل خودرو باقی باشد.`,
    };
    return NextResponse.json(
      { error: messages[eligibilityErrors[0]], eligibility: true },
      { status: 422 },
    );
  }

  // ─── مدت اجاره ───

  const days = computeDays(pickupAt, dropoffAt);
  if (days < settings.min_rental_days || days > settings.max_rental_days) {
    return NextResponse.json(
      {
        error: `مدت اجاره باید بین ${settings.min_rental_days} تا ${settings.max_rental_days} روز باشد.`,
      },
      { status: 400 },
    );
  }

  // ─── انتخاب خودرو ───

  const requested = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!requested || requested.status !== "available") {
    return NextResponse.json({ error: "این خودرو در دسترس نیست." }, { status: 409 });
  }

  // قفل‌های منقضی را آزاد می‌کنیم، وگرنه محدودیت دیتابیس آن‌ها را اشغال‌کننده می‌بیند
  await expireLocks(vehicleId);

  /**
   * از هر مدل چند دستگاه داریم و نتایج در سطح مدل نمایش داده می‌شود.
   * اگر بین دیدن و رزرو کردن، دستگاه انتخابی گرفته شده باشد، به‌جای خطا
   * دستگاه آزاد دیگری از همان مدل جایگزین می‌شود.
   */
  const available = await findAvailableVehicles(pickupAt, dropoffAt, {});
  let picked = available.find((v) => v.id === requested.id) ?? null;

  if (!picked) {
    picked =
      available.find((v) => v.brand === requested.brand && v.model === requested.model) ?? null;
  }

  if (!picked) {
    return NextResponse.json({ error: CONFLICT_MESSAGE, conflict: true }, { status: 409 });
  }

  /**
   * مقادیر اسنپ‌شات مستقیم از دیتابیس خوانده می‌شوند، نه از خروجی
   * findAvailableVehicles — تا به شکل select آن تابع وابسته نباشیم.
   */
  const vehicle = await prisma.vehicle.findUniqueOrThrow({
    where: { id: picked.id },
    select: {
      id: true,
      branchId: true,
      dailyRate: true,
      dailyKmLimit: true,
      extraKmRate: true,
      marketValue: true,
    },
  });

  if (vehicle.marketValue == null) {
    return NextResponse.json(
      { error: "ارزش روز این خودرو ثبت نشده است. لطفا خودروی دیگری انتخاب کنید." },
      { status: 409 },
    );
  }

  // ودیعه: درصد مصوب از ارزش روز خودرو، قفل‌شده در لحظه رزرو.
  // رکورد Deposit اینجا ساخته نمی‌شود — طبق استوری ۱.۱ در تحویل خودرو وصول می‌شود.
  const depositAmountSnapshot = Math.round(
    (vehicle.marketValue * settings["deposit.percent_of_market_value"]) / 100,
  );

  const q = quote(vehicle.dailyRate, days, settings.tax_rate_percent);
  const lockExpiresAt = new Date(Date.now() + settings.lock_minutes * 60 * 1000);

  try {
    const booking = await prisma.$transaction(async (tx) => {
      const created = await tx.booking.create({
        data: {
          code: generateBookingCode(),
          userId: session.userId,
          vehicleId: vehicle.id,
          branchId: vehicle.branchId,
          pickupAt,
          dropoffAt,
          days,
          status: BookingStatus.pending_payment,
          lockExpiresAt,

          dailyRateSnapshot: vehicle.dailyRate,
          taxRateSnapshot: settings.tax_rate_percent,
          dailyKmLimitSnapshot: vehicle.dailyKmLimit,
          extraKmRateSnapshot: vehicle.extraKmRate,

          rentAmount: q.rentAmount,
          taxAmount: q.taxAmount,
          totalAmount: q.totalAmount,

          driverName: driverName.trim(),
          driverBirthDate,
          driverLicenseNumber: driverLicenseNumber.trim(),

          driverNationalIdHash: blindIndex(driverNationalId),
          driverNationalIdEnc: encryptField(driverNationalId),
          driverLicenseExpiry,
          refundIban: ibanCheck.normalized,
          refundBankName: ibanCheck.bankName,

          depositAmountSnapshot,
        },
      });

      await tx.user.update({
        where: { id: session.userId },
        data: {
          fullName: driverName.trim(),
          birthDate: driverBirthDate,
          licenseNumber: driverLicenseNumber.trim(),
        },
      });

      return created;
    });

    await logEvent("booking_started", {
      userId: session.userId,
      bookingId: booking.id,
      vehicleId: vehicle.id,
    });

    return NextResponse.json({
      ok: true,
      id: booking.id,
      code: booking.code,
      lockExpiresAt,
      depositAmount: depositAmountSnapshot,
    });
  } catch (e) {
    // محدودیت سطح دیتابیس: خودرو در این بازه گرفته شده است
    if (String((e as Error)?.message ?? "").includes("no_overlapping_bookings")) {
      return NextResponse.json({ error: CONFLICT_MESSAGE, conflict: true }, { status: 409 });
    }

    // برخورد کد رزرو تکراری — نادر، ولی پیام «خودرو رزرو شد» برایش گمراه‌کننده است
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { error: "خطای موقت در ثبت رزرو. لطفا دوباره تلاش کنید." },
        { status: 409 },
      );
    }

    throw e;
  }
}
