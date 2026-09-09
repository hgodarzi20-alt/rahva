/**
 * ولیدیشن‌های احراز هویت راننده — اپیک ۰.
 * همه خالص‌اند و به دیتابیس یا شبکه وابسته نیستند.
 */

/** ارقام فارسی و عربی را به لاتین می‌برد. ورودی کاربر همیشه از این عبور می‌کند. */
export function toLatinDigits(input: string): string {
  const fa = "۰۱۲۳۴۵۶۷۸۹";
  const ar = "٠١٢٣٤٥٦٧٨٩";
  return input.replace(/[۰-۹٠-٩]/g, (ch) => {
    const i = fa.indexOf(ch);
    return String(i >= 0 ? i : ar.indexOf(ch));
  });
}

/**
 * اعتبارسنجی کد ملی با الگوریتم رقم کنترل.
 * کدهای با ارقام یکسان رد می‌شوند: از نظر ریاضی معتبرند ولی وجود ندارند.
 */
export function isValidNationalId(raw: string): boolean {
  const s = toLatinDigits(raw).replace(/\D/g, "");
  if (s.length !== 10) return false;
  if (/^(\d)\1{9}$/.test(s)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(s[i]) * (10 - i);
  const remainder = sum % 11;
  const check = Number(s[9]);

  return remainder < 2 ? check === remainder : check === 11 - remainder;
}

const IRAN_BANKS: Record<string, string> = {
  "010": "بانک مرکزی", "011": "بانک صنعت و معدن", "012": "بانک ملت",
  "013": "بانک رفاه کارگران", "014": "بانک مسکن", "015": "بانک سپه",
  "016": "بانک کشاورزی", "017": "بانک ملی ایران", "018": "بانک تجارت",
  "019": "بانک صادرات ایران", "020": "بانک توسعه صادرات",
  "021": "پست بانک ایران", "022": "بانک توسعه تعاون",
  "051": "مؤسسه اعتباری توسعه", "053": "بانک کارآفرین",
  "054": "بانک پارسیان", "055": "بانک اقتصاد نوین", "056": "بانک سامان",
  "057": "بانک پاسارگاد", "058": "بانک سرمایه", "059": "بانک سینا",
  "060": "بانک قرض‌الحسنه مهر ایران", "061": "بانک شهر",
  "062": "بانک آینده", "063": "بانک انصار", "064": "بانک گردشگری",
  "065": "بانک حکمت ایرانیان", "066": "بانک دی", "069": "بانک ایران زمین",
  "070": "بانک قرض‌الحسنه رسالت", "073": "بانک کوثر", "075": "بانک ملل",
  "078": "بانک خاورمیانه",
};

export type IbanResult =
  | { ok: true; normalized: string; bankName: string }
  | { ok: false; reason: "format" | "checksum" | "unknown_bank" };

/** اعتبارسنجی شبا با الگوریتم mod-97 استاندارد ISO 13616. */
export function validateIban(raw: string): IbanResult {
  const s = toLatinDigits(raw).replace(/\s/g, "").toUpperCase();
  if (!/^IR\d{24}$/.test(s)) return { ok: false, reason: "format" };

  // چهار نویسه اول به انتها منتقل و حروف به عدد تبدیل می‌شوند: I=18، R=27
  const rearranged = s.slice(4) + "1827" + s.slice(2, 4);
  let remainder = 0;
  for (const ch of rearranged) remainder = (remainder * 10 + Number(ch)) % 97;
  if (remainder !== 1) return { ok: false, reason: "checksum" };

  const bankName = IRAN_BANKS[s.slice(4, 7)];
  if (!bankName) return { ok: false, reason: "unknown_bank" };

  return { ok: true, normalized: s, bankName };
}

/** سن کامل در تاریخ مرجع */
export function ageAt(birthDate: Date, at: Date): number {
  let age = at.getFullYear() - birthDate.getFullYear();
  const m = at.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && at.getDate() < birthDate.getDate())) age--;
  return age;
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const targetDay = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < targetDay) d.setDate(0);
  return d;
}

/**
 * حداقل تاریخ انقضای قابل قبول گواهینامه.
 * تاریخ مرجع، روز تحویل خودرو است — نه پایان اجاره و نه لحظه ثبت رزرو.
 */
export function requiredLicenseValidity(referenceDate: Date, marginMonths: number): Date {
  return addMonths(referenceDate, marginMonths);
}

export type EligibilityError = "under_age" | "license_expiring_too_soon";

/**
 * دو شرط استوری ۰.۱ که واقعاً منطق دارند.
 * هر دو شرط نسبت به یک تاریخ مرجع واحد سنجیده می‌شوند: روز تحویل خودرو.
 * سن در همان روز محاسبه می‌شود، نه در لحظه ثبت رزرو — وگرنه کسی که تا زمان
 * تحویل به حد نصاب سنی می‌رسد، بی‌دلیل رد می‌شود.
 *
 * استعلام آنلاین راهور عمداً پیاده‌سازی نمی‌شود — بند محدودیت‌های PRD.
 */
export function checkDriverEligibility(input: {
  birthDate: Date;
  licenseExpiry: Date;
  referenceDate: Date;
  minAgeYears: number;
  licenseValidityMarginMonths: number;
}): EligibilityError[] {
  const errors: EligibilityError[] = [];

  if (ageAt(input.birthDate, input.referenceDate) < input.minAgeYears) {
    errors.push("under_age");
  }

  const minimumExpiry = requiredLicenseValidity(
    input.referenceDate,
    input.licenseValidityMarginMonths,
  );
  if (input.licenseExpiry.getTime() < minimumExpiry.getTime()) {
    errors.push("license_expiring_too_soon");
  }

  return errors;
}
