import {
  PrismaClient,
  BookingStatus,
  EventType,
  FuelType,
  Role,
  Transmission,
  VehicleClass,
  VehicleStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { computeDays, quote, computeReturnCharges, refundForNoShow } from "../src/lib/pricing";
import { generateBookingCode } from "../src/lib/format";
import { SETTING_DEFAULTS, SETTING_NOTES, type SettingKey } from "../src/lib/settings";

const prisma = new PrismaClient();
const DAY = 24 * 60 * 60 * 1000;

const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T,>(arr: T[]): T => arr[rand(0, arr.length - 1)];

const MODELS: [string, string, VehicleClass, Transmission, FuelType, number, number][] = [
  ["پژو", "۲۰۷ اتوماتیک", "economy", "automatic", "petrol", 5, 2_400_000],
  ["پژو", "۲۰۶ تیپ ۲", "economy", "manual", "petrol", 5, 1_900_000],
  ["سایپا", "کوییک", "economy", "manual", "petrol", 5, 1_600_000],
  ["ایران‌خودرو", "سمند LX", "economy", "manual", "petrol", 5, 1_800_000],
  ["ایران‌خودرو", "دنا پلاس", "standard", "automatic", "petrol", 5, 2_900_000],
  ["کیا", "سراتو", "standard", "automatic", "petrol", 5, 4_200_000],
  ["هیوندای", "النترا", "standard", "automatic", "petrol", 5, 4_600_000],
  ["رنو", "ساندرو استپ‌وی", "standard", "automatic", "petrol", 5, 3_100_000],
  ["هایما", "S7", "suv", "automatic", "petrol", 5, 5_100_000],
  ["ام‌وی‌ام", "X33", "suv", "manual", "petrol", 5, 3_400_000],
  ["تویوتا", "راو۴", "suv", "automatic", "hybrid", 5, 7_800_000],
  ["هیوندای", "توسان", "suv", "automatic", "petrol", 5, 6_900_000],
  ["بی‌ام‌و", "سری ۳", "luxury", "automatic", "petrol", 5, 12_500_000],
  ["مرسدس بنز", "C200", "luxury", "automatic", "petrol", 5, 14_000_000],
  ["ولوو", "XC60", "luxury", "automatic", "hybrid", 5, 13_200_000],
];

const LETTERS = ["الف", "ب", "ج", "د", "س", "ص", "ط", "ق", "ل", "م", "ن", "و", "ه", "ی"];
const FIRST = ["علی", "زهرا", "محمد", "فاطمه", "رضا", "مریم", "حسین", "نرگس", "امیر", "سارا"];
const LAST = ["احمدی", "محمدی", "رضایی", "حسینی", "کریمی", "موسوی", "جعفری", "نوری", "صادقی", "قاسمی"];

async function main() {
  console.log("پاک‌سازی داده‌های قبلی…");
  await prisma.event.deleteMany();
  await prisma.rental.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.vehicle.deleteMany();
  await prisma.user.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.setting.deleteMany();

  // ─── تنظیمات (قواعد کسب‌وکار بخش ۱۵) ───
  await prisma.setting.createMany({
    data: (Object.keys(SETTING_DEFAULTS) as SettingKey[]).map((key) => ({
      key,
      value: SETTING_DEFAULTS[key],
      note: SETTING_NOTES[key],
    })),
  });
  const taxPercent = Number(SETTING_DEFAULTS.tax_rate_percent);
  const lateGraceHours = Number(SETTING_DEFAULTS.late_grace_hours);
  const lateFeePercent = Number(SETTING_DEFAULTS.late_fee_percent);

  // ─── شعبه ───
  const branch = await prisma.branch.create({
    data: { name: "شعبه تهران — سعادت‌آباد", city: "تهران" },
  });

  // ─── کاربران ───
  const pw = await bcrypt.hash("password123", 10);

  const operator = await prisma.user.create({
    data: { mobile: "09120000001", passwordHash: pw, fullName: "کاربر اپراتور", role: Role.operator },
  });
  const manager = await prisma.user.create({
    data: { mobile: "09120000002", passwordHash: pw, fullName: "مدیر ناوگان", role: Role.fleet_manager },
  });

  const customers = [];
  for (let i = 0; i < 20; i++) {
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    customers.push(
      await prisma.user.create({
        data: {
          mobile: `0912${String(1000000 + i).padStart(7, "0")}`,
          passwordHash: pw,
          fullName: name,
          birthDate: new Date(Date.UTC(rand(1360, 1382) + 621, rand(0, 11), rand(1, 28))),
          licenseNumber: String(rand(1000000000, 9999999999)),
          role: Role.customer,
        },
      }),
    );
  }
  console.log(`✓ ${customers.length + 2} کاربر`);

  // ─── ناوگان ───
  const vehicles = [];
  for (let i = 0; i < 30; i++) {
    const [brand, model, cls, trans, fuel, seats, baseRate] = MODELS[i % MODELS.length];
    vehicles.push(
      await prisma.vehicle.create({
        data: {
          plate: `${rand(10, 99)} ${pick(LETTERS)} ${rand(100, 999)} — ${rand(10, 99)}`,
          brand,
          model,
          year: rand(1398, 1403),
          vehicleClass: cls,
          transmission: trans,
          fuelType: fuel,
          seats,
          dailyRate: baseRate + rand(-2, 2) * 100_000,
          dailyKmLimit: 250,
          extraKmRate: 5_000,
          status: i % 15 === 14 ? VehicleStatus.maintenance : VehicleStatus.available,
          marketValue: baseRate * 200 + rand(-20, 20) * 1_000_000,
          branchId: branch.id,
        },
      }),
    );
  }
  console.log(`✓ ${vehicles.length} خودرو`);

  // ─── رزروها ───
  // برای هر خودرو یک زنجیره‌ی بدون هم‌پوشانی می‌سازیم تا محدودیت دیتابیس نقض نشود.
  const now = Date.now();
  let created = 0;
  const events: { type: EventType; bookingId?: number; vehicleId?: number; userId?: number; at: Date }[] = [];

  for (const v of vehicles) {
    let cursor = now - 90 * DAY;

    while (cursor < now + 25 * DAY) {
      const gap = rand(0, 6) * DAY + rand(2, 20) * 60 * 60 * 1000;
      const pickupAt = new Date(cursor + gap);
      const days = rand(1, 6);
      const dropoffAt = new Date(pickupAt.getTime() + days * DAY);
      cursor = dropoffAt.getTime();

      if (pickupAt.getTime() > now + 25 * DAY) break;

      const customer = pick(customers);
      const q = quote(v.dailyRate, computeDays(pickupAt, dropoffAt), taxPercent);

      // وضعیت بر اساس جایگاه بازه نسبت به امروز
      let status: BookingStatus;
      if (dropoffAt.getTime() < now) {
        const roll = Math.random();
        status = roll < 0.82 ? BookingStatus.completed
               : roll < 0.92 ? BookingStatus.cancelled
               : roll < 0.97 ? BookingStatus.no_show
               : BookingStatus.failed;
      } else if (pickupAt.getTime() < now) {
        status = BookingStatus.active;
      } else {
        const roll = Math.random();
        status = roll < 0.86 ? BookingStatus.confirmed
               : roll < 0.94 ? BookingStatus.cancelled
               : BookingStatus.pending_payment;
      }

      // وضعیت‌های غیراشغال‌کننده محدودیت را نقض نمی‌کنند، بقیه باید یکتا بمانند
      const refunds =
        status === BookingStatus.no_show
          ? refundForNoShow(q.totalAmount, v.dailyRate)
          : status === BookingStatus.cancelled
            ? { refundAmount: q.totalAmount, penaltyAmount: 0 }
            : { refundAmount: null, penaltyAmount: null };

      const booking = await prisma.booking.create({
        data: {
          code: generateBookingCode(),
          userId: customer.id,
          vehicleId: v.id,
          branchId: branch.id,
          pickupAt,
          dropoffAt,
          days: q.days,
          status,
          lockExpiresAt:
            status === BookingStatus.pending_payment
              ? new Date(now + rand(2, 14) * 60 * 1000)
              : null,
          dailyRateSnapshot: v.dailyRate,
          taxRateSnapshot: taxPercent,
          dailyKmLimitSnapshot: v.dailyKmLimit,
          extraKmRateSnapshot: v.extraKmRate,
          rentAmount: q.rentAmount,
          taxAmount: q.taxAmount,
          totalAmount: q.totalAmount,
          refundAmount: refunds.refundAmount,
          penaltyAmount: refunds.penaltyAmount,
          driverName: customer.fullName!,
          driverBirthDate: customer.birthDate!,
          driverLicenseNumber: customer.licenseNumber!,
          createdAt: new Date(pickupAt.getTime() - rand(1, 20) * DAY),
          confirmedAt:
            status === BookingStatus.pending_payment || status === BookingStatus.failed
              ? null
              : new Date(pickupAt.getTime() - rand(1, 20) * DAY),
          cancelledAt: status === BookingStatus.cancelled ? new Date(pickupAt.getTime() - 2 * DAY) : null,
        },
      });
      created++;

      // پرداخت
      if (status !== BookingStatus.pending_payment) {
        await prisma.payment.create({
          data: {
            bookingId: booking.id,
            amount: q.totalAmount,
            result: status === BookingStatus.failed ? "failed" : "succeeded",
            attemptedAt: booking.createdAt,
          },
        });
      }

      // رکورد تحویل و بازگشت
      if (status === BookingStatus.active || status === BookingStatus.completed) {
        const startOdo = rand(20_000, 180_000);
        const checkoutAt = new Date(pickupAt.getTime() + rand(0, 90) * 60 * 1000);

        if (status === BookingStatus.completed) {
          const checkinAt = new Date(dropoffAt.getTime() + (Math.random() < 0.15 ? rand(3, 30) : rand(-40, 60)) * 60 * 60 * 1000 / 10);
          const kmDriven = rand(80, 340) * q.days;
          const charges = computeReturnCharges({
            checkoutOdometer: startOdo,
            checkinOdometer: startOdo + kmDriven,
            days: q.days,
            dailyKmLimit: v.dailyKmLimit,
            extraKmRate: v.extraKmRate,
            dailyRate: v.dailyRate,
            dropoffAt,
            checkinAt,
            lateGraceHours,
            lateFeePercent,
          });
          await prisma.rental.create({
            data: {
              bookingId: booking.id,
              checkoutAt,
              checkoutOdometer: startOdo,
              checkoutFuel: "1/1",
              checkoutById: operator.id,
              licenseChecked: true,
              idChecked: true,
              contractSigned: true,
              checkinAt,
              checkinOdometer: startOdo + kmDriven,
              checkinFuel: pick(["1/1", "3/4", "1/2"]),
              checkinById: operator.id,
              ...charges,
              chargesCollected: charges.chargesTotal > 0,
            },
          });
          events.push({ type: EventType.car_returned, bookingId: booking.id, vehicleId: v.id, at: checkinAt });
        } else {
          await prisma.rental.create({
            data: {
              bookingId: booking.id,
              checkoutAt,
              checkoutOdometer: startOdo,
              checkoutFuel: "1/1",
              checkoutById: operator.id,
              licenseChecked: true,
              idChecked: true,
              contractSigned: true,
            },
          });
        }
        events.push({ type: EventType.car_picked_up, bookingId: booking.id, vehicleId: v.id, at: checkoutAt });
      }

      // رویدادهای قیف
      events.push({ type: EventType.booking_started, bookingId: booking.id, vehicleId: v.id, userId: customer.id, at: booking.createdAt });
      events.push({ type: EventType.payment_attempted, bookingId: booking.id, userId: customer.id, at: booking.createdAt });
      if (booking.confirmedAt) {
        events.push({ type: EventType.booking_confirmed, bookingId: booking.id, vehicleId: v.id, userId: customer.id, at: booking.confirmedAt });
      }
      if (booking.cancelledAt) {
        events.push({ type: EventType.booking_cancelled, bookingId: booking.id, userId: customer.id, at: booking.cancelledAt });
      }
    }
  }
  console.log(`✓ ${created} رزرو`);

  // ─── رویدادهای جست‌وجو و مشاهده (قیف را واقعی می‌کند) ───
  for (let d = 90; d >= 0; d--) {
    const dayStart = now - d * DAY;
    const searches = rand(8, 22);
    for (let i = 0; i < searches; i++) {
      const at = new Date(dayStart + rand(0, 23) * 3600_000 + rand(0, 59) * 60_000);
      const results = Math.random() < 0.18 ? 0 : rand(3, 18);
      events.push({ type: EventType.search_performed, at });
      // بار اضافه: نتیجه در payload ذخیره می‌شود
      if (results > 0) {
        const views = rand(1, 3);
        for (let k = 0; k < views; k++) {
          events.push({
            type: EventType.car_viewed,
            vehicleId: pick(vehicles).id,
            at: new Date(at.getTime() + rand(10, 300) * 1000),
          });
        }
      }
    }
  }

  // درج رویدادها به‌صورت دسته‌ای
  const CHUNK = 500;
  for (let i = 0; i < events.length; i += CHUNK) {
    await prisma.event.createMany({
      data: events.slice(i, i + CHUNK).map((e) => ({
        type: e.type,
        userId: e.userId ?? null,
        bookingId: e.bookingId ?? null,
        vehicleId: e.vehicleId ?? null,
        payload:
          e.type === EventType.search_performed
            ? { resultCount: Math.random() < 0.18 ? 0 : rand(3, 18) }
            : undefined,
        createdAt: e.at,
      })),
    });
  }
  console.log(`✓ ${events.length} رویداد`);
  // ─── تنظیمات نسخه ۲ ───
  const v2Settings = [
    { key: "deposit.percent_of_market_value",       value: "10",       note: "درصد ارزش روز خودرو" },
    { key: "franchise.percent",                     value: "10",       note: "فرانشیز بیمه بدنه" },
    { key: "police_report.waiver_ceiling_toman",    value: "53300000", note: "سقف مصوب ۱۴۰۵ — سالانه تغییر می‌کند" },
    { key: "parking.daily_rate_toman",              value: "450000",   note: "" },
    { key: "deadline.initial_report_hours",         value: "2",        note: "" },
    { key: "deadline.documentation_hours",          value: "24",       note: "" },
    { key: "deadline.police_report_days",           value: "7",        note: "" },
    { key: "deadline.invoice_response_hours",       value: "72",       note: "پس از آن پذیرش خودکار" },
    { key: "driver.min_age_years",                  value: "20",       note: "" },
    { key: "driver.license_validity_margin_months", value: "6",        note: "پس از پایان اجاره" },
  ];
  for (const s of v2Settings) {
    await prisma.setting.upsert({ where: { key: s.key }, update: {}, create: s });
  }
  console.log(`✓ ${v2Settings.length} تنظیم نسخه ۲`);
  console.log("\nحساب‌های آزمایشی — رمز همه: password123");
  console.log(`  اپراتور     ${operator.mobile}`);
  console.log(`  مدیر ناوگان ${manager.mobile}`);
  console.log(`  مشتری       ${customers[0].mobile}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
