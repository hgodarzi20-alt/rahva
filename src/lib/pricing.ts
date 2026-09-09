/**
 * تمام محاسبات پولی. تنها منبع حقیقت قیمت‌گذاری.
 * واحد همه‌جا تومان و عدد صحیح است — هیچ اعشاری ذخیره نمی‌شود.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** هر ۲۴ ساعت یک روز؛ کسر روز یک روز کامل حساب می‌شود. حداقل یک روز. */
export function computeDays(pickupAt: Date, dropoffAt: Date): number {
  const ms = dropoffAt.getTime() - pickupAt.getTime();
  if (ms <= 0) return 0;
  return Math.max(1, Math.ceil(ms / DAY_MS));
}

export type Quote = {
  days: number;
  dailyRate: number;
  rentAmount: number;
  taxAmount: number;
  totalAmount: number;
};

export function quote(dailyRate: number, days: number, taxPercent: number): Quote {
  const rentAmount = dailyRate * days;
  const taxAmount = Math.round((rentAmount * taxPercent) / 100);
  return {
    days,
    dailyRate,
    rentAmount,
    taxAmount,
    totalAmount: rentAmount + taxAmount,
  };
}

export type ReturnCharges = {
  kmDriven: number;
  kmOverLimit: number;
  extraKmFee: number;
  lateHours: number;
  lateDays: number;
  lateFee: number;
  chargesTotal: number;
};

/**
 * جریمه‌های هنگام بازگشت. مبالغ فقط‌خواندنی‌اند و اپراتور تغییرشان نمی‌دهد
 * (استوری ۴.۳ بند ۴). نرخ‌ها از snapshot رزرو می‌آیند نه از خودرو،
 * تا تغییر نرخ روی رزروهای قدیمی اثر نگذارد.
 */
export function computeReturnCharges(input: {
  checkoutOdometer: number;
  checkinOdometer: number;
  days: number;
  dailyKmLimit: number;
  extraKmRate: number;
  dailyRate: number;
  dropoffAt: Date;
  checkinAt: Date;
  lateGraceHours: number;
  lateFeePercent: number;
}): ReturnCharges {
  const kmDriven = Math.max(0, input.checkinOdometer - input.checkoutOdometer);
  const allowance = input.dailyKmLimit * input.days;
  const kmOverLimit = Math.max(0, kmDriven - allowance);
  const extraKmFee = kmOverLimit * input.extraKmRate;

  const lateMs = input.checkinAt.getTime() - input.dropoffAt.getTime();
  const lateHours = Math.max(0, Math.floor(lateMs / (60 * 60 * 1000)));

  let lateDays = 0;
  if (lateHours > input.lateGraceHours) {
    lateDays = Math.ceil((lateHours - input.lateGraceHours) / 24);
  }
  const lateFee = Math.round((input.dailyRate * input.lateFeePercent) / 100) * lateDays;

  return {
    kmDriven,
    kmOverLimit,
    extraKmFee,
    lateHours,
    lateDays,
    lateFee,
    chargesTotal: extraKmFee + lateFee,
  };
}

/** لغو در مهلت مجاز: بازگشت کامل وجه. */
export function refundForCancellation(totalAmount: number) {
  return { refundAmount: totalAmount, penaltyAmount: 0 };
}

/** عدم مراجعه: یک روز اجاره کسر و مابقی برمی‌گردد. */
export function refundForNoShow(totalAmount: number, dailyRate: number) {
  const penaltyAmount = Math.min(dailyRate, totalAmount);
  return { refundAmount: totalAmount - penaltyAmount, penaltyAmount };
}

/** سن کامل‌شده تا تاریخ مرجع. */
export function ageOn(birthDate: Date, at: Date = new Date()): number {
  let age = at.getFullYear() - birthDate.getFullYear();
  const m = at.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && at.getDate() < birthDate.getDate())) age--;
  return age;
}
