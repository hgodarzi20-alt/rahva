import { computeDays, quote, computeReturnCharges, refundForNoShow, ageOn } from "../src/lib/pricing";
const D = (s: string) => new Date(s);
let pass = 0, fail = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? "✓" : "✗"} ${name}${ok ? "" : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`);
};

// قاعده: هر ۲۴ ساعت یک روز، کسر روز یک روز کامل
eq("۳ روز کامل", computeDays(D("2026-06-12T10:00:00Z"), D("2026-06-15T10:00:00Z")), 3);
eq("۲ روز و ۱ ساعت → ۳ روز", computeDays(D("2026-06-12T10:00:00Z"), D("2026-06-14T11:00:00Z")), 3);
eq("۱۶ ساعت → ۱ روز", computeDays(D("2026-06-12T10:00:00Z"), D("2026-06-13T02:00:00Z")), 1);

// قیمت: اجاره + ۱۰٪ مالیات
eq("قیمت ۳ روزه", quote(2_400_000, 3, 10), {
  days: 3, dailyRate: 2_400_000, rentAmount: 7_200_000, taxAmount: 720_000, totalAmount: 7_920_000 });

// کیلومتر اضافه: سقف ۲۵۰×۳=۷۵۰ ، پیموده ۹۰۰ ، مازاد ۱۵۰ × ۵۰۰۰
const c1 = computeReturnCharges({ checkoutOdometer: 10_000, checkinOdometer: 10_900, days: 3,
  dailyKmLimit: 250, extraKmRate: 5_000, dailyRate: 2_400_000,
  dropoffAt: D("2026-06-15T10:00:00Z"), checkinAt: D("2026-06-15T10:00:00Z"),
  lateGraceHours: 2, lateFeePercent: 150 });
eq("مازاد کیلومتر", [c1.kmOverLimit, c1.extraKmFee], [150, 750_000]);

// تأخیر ۱ ساعت → داخل مهلت، بدون جریمه
const c2 = computeReturnCharges({ ...{ checkoutOdometer: 0, checkinOdometer: 100, days: 1,
  dailyKmLimit: 250, extraKmRate: 5_000, dailyRate: 2_000_000, lateGraceHours: 2, lateFeePercent: 150 },
  dropoffAt: D("2026-06-15T10:00:00Z"), checkinAt: D("2026-06-15T11:00:00Z") });
eq("تأخیر ۱ ساعت بدون جریمه", [c2.lateDays, c2.lateFee], [0, 0]);

// تأخیر ۵ ساعت → یک روز جریمه ۱۵۰٪
const c3 = computeReturnCharges({ checkoutOdometer: 0, checkinOdometer: 100, days: 1,
  dailyKmLimit: 250, extraKmRate: 5_000, dailyRate: 2_000_000, lateGraceHours: 2, lateFeePercent: 150,
  dropoffAt: D("2026-06-15T10:00:00Z"), checkinAt: D("2026-06-15T15:00:00Z") });
eq("تأخیر ۵ ساعت = ۱ روز × ۱۵۰٪", [c3.lateDays, c3.lateFee], [1, 3_000_000]);

// عدم مراجعه: یک روز اجاره کسر
eq("بازگشت وجه عدم مراجعه", refundForNoShow(7_920_000, 2_400_000), { refundAmount: 5_520_000, penaltyAmount: 2_400_000 });

// سن
eq("سن ۲۰ سال و ۱۱ ماه", ageOn(D("2005-08-01"), D("2026-07-01")), 20);
eq("سن ۲۱ سال", ageOn(D("2005-06-01"), D("2026-07-01")), 21);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
