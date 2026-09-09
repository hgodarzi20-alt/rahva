const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export function toFaDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

/** مبلغ به تومان با جداکننده هزارگان و ارقام فارسی */
export function toman(amount: number): string {
  return toFaDigits(amount.toLocaleString("en-US"));
}

const jalali = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "Asia/Tehran",
});

const jalaliShort = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  month: "long",
  day: "numeric",
  timeZone: "Asia/Tehran",
});

const clock = new Intl.DateTimeFormat("fa-IR", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Tehran",
});

export const faDate = (d: Date | string) => jalali.format(new Date(d));
export const faDateShort = (d: Date | string) => jalaliShort.format(new Date(d));
export const faTime = (d: Date | string) => clock.format(new Date(d));
export const faDateTime = (d: Date | string) => `${faDate(d)} · ${faTime(d)}`;

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // بدون حروف و ارقام شبیه به هم

/** کد رزرو یکتا مثل RH-2K4F9A */
export function generateBookingCode(): string {
  let s = "";
  for (let i = 0; i < 6; i++) {
    s += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return `RH-${s}`;
}

export const BOOKING_STATUS_FA: Record<string, string> = {
  pending_payment: "در انتظار پرداخت",
  confirmed: "تأییدشده",
  active: "در حال اجاره",
  completed: "تکمیل‌شده",
  cancelled: "لغوشده",
  failed: "پرداخت ناموفق",
  no_show: "عدم مراجعه",
};

export const VEHICLE_CLASS_FA: Record<string, string> = {
  economy: "اقتصادی",
  standard: "استاندارد",
  suv: "شاسی‌بلند",
  luxury: "لوکس",
};

export const TRANSMISSION_FA: Record<string, string> = {
  manual: "دنده‌ای",
  automatic: "اتوماتیک",
};

export const FUEL_FA: Record<string, string> = {
  petrol: "بنزینی",
  diesel: "دیزلی",
  hybrid: "هیبریدی",
};
/** نام نمایشی خودرو — برند خالی (خودروهای ایرانی) فاصله اضافه نمی‌سازد */
export function vehicleName(v: { brand: string; model: string }) {
  return [v.brand, v.model].filter(Boolean).join(" ");
}