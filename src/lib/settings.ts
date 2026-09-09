import { prisma } from "./db";

/**
 * قواعد کسب‌وکار بخش ۱۵ سند.
 * مقادیر در جدول Setting نگهداری می‌شوند و در نسخه ۱ رابط کاربری ندارند.
 */
export const SETTING_DEFAULTS = {
  tax_rate_percent: "10",
  min_rental_days: "1",
  max_rental_days: "30",
  lock_minutes: "15",
  no_show_grace_hours: "2",
  cancel_deadline_hours: "24",
  late_grace_hours: "2",
  late_fee_percent: "150",
  min_driver_age: "21",
  // ─── نسخه ۲ — احراز هویت راننده ───
  "driver.license_validity_margin_months": "6",
  // ─── نسخه ۲ — ودیعه ───
  "deposit.percent_of_market_value": "10",
  // ─── نسخه ۲ — پرونده حادثه ───
  "deadline.initial_report_hours": "2",
  "deadline.documentation_hours": "24",
  "deadline.police_report_days": "7",
  "deadline.invoice_response_hours": "72",
  "deadline.debt_payment_days": "14",
  "franchise.percent": "10",
  "police_report.waiver_ceiling_toman": "53300000",
  "parking.daily_rate_toman": "450000",
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;

export const SETTING_NOTES: Record<SettingKey, string> = {
  tax_rate_percent: "مالیات بر ارزش افزوده — درصد",
  min_rental_days: "حداقل مدت اجاره — روز",
  max_rental_days: "حداکثر مدت اجاره — روز",
  lock_minutes: "مدت قفل خودرو پیش از پرداخت — دقیقه",
  no_show_grace_hours: "مهلت اعلام عدم مراجعه پس از زمان تحویل — ساعت",
  cancel_deadline_hours: "مهلت لغو با بازگشت کامل وجه، پیش از تحویل — ساعت",
  late_grace_hours: "مهلت تأخیر بدون جریمه — ساعت",
  late_fee_percent: "جریمه تأخیر — درصد نرخ روزانه به ازای هر روز",
  min_driver_age: "حداقل سن راننده — سال",
  "driver.license_validity_margin_months":
    "حاشیه اعتبار گواهینامه پس از تاریخ تحویل خودرو — ماه",
  "deposit.percent_of_market_value": "ودیعه — درصد ارزش روز خودرو",
  "deadline.initial_report_hours": "مهلت ثبت اولیه حادثه پس از وقوع — ساعت",
  "deadline.documentation_hours": "مهلت تکمیل مستندات پس از ثبت اولیه — ساعت",
  "deadline.police_report_days": "مهلت ارائه نسخه کروکی پس از ثبت مستندات — روز",
  "deadline.invoice_response_hours": "مهلت پاسخ مستأجر به صورت‌حساب — ساعت",
  "deadline.debt_payment_days": "مهلت پرداخت بدهی مازاد پس از تسویه — روز",
  "franchise.percent": "فرانشیز بیمه بدنه — درصد برآورد خسارت",
  "police_report.waiver_ceiling_toman": "سقف مصوب عدم‌نیاز به کروکی — تومان",
  "parking.daily_rate_toman": "نرخ روزانه پارکینگ — تومان",
};

let cache: Record<string, string> | null = null;

export async function getSettings(): Promise<Record<SettingKey, number>> {
  let values = cache;
  if (!values) {
    const rows = await prisma.setting.findMany();
    values = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, string>;
    cache = values;
  }
  const out: Record<string, number> = {};
  for (const key of Object.keys(SETTING_DEFAULTS) as SettingKey[]) {
    out[key] = Number(values[key] ?? SETTING_DEFAULTS[key]);
  }
  return out as Record<SettingKey, number>;
}

export function clearSettingsCache() {
  cache = null;
}
