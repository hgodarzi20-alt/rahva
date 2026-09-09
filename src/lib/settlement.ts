/**
 * موتور مالی پرونده خسارت — اپیک ۵.
 *
 * دو منبع مالی داریم و عمداً از هم جدا می‌مانند:
 *   ودیعه        → اقلام خسارت
 *   پرداخت اجاره → اعتبار روزهای استفاده‌نشده
 * در نمایش یک عدد نهایی دیده می‌شود، ولی در حسابداری دو رکورد.
 *
 * همه مبالغ عدد صحیح و به تومان‌اند؛ هیچ‌جا ممیز شناور نداریم.
 */

export type InvoiceItemType =
  | "repair_deductible"
  | "assistance_towing"
  | "vehicle_downtime"
  | "parking"
  | "rental_credit";

export interface DraftItem {
  type: InvoiceItemType;
  label: string;
  /** منفی فقط برای rental_credit */
  amount: number;
  basis?: string | null;
  isSystemGenerated: boolean;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** اقلامی که اپراتور دستی وارد می‌کند؛ بقیه را سیستم می‌سازد */
export const MANUAL_ITEM_TYPES = ["assistance_towing", "vehicle_downtime", "parking"] as const;

export const ITEM_LABEL_FA: Record<InvoiceItemType, string> = {
  repair_deductible: "فرانشیز تعمیر",
  assistance_towing: "امداد و حمل",
  vehicle_downtime: "خواب خودرو",
  parking: "پارکینگ",
  rental_credit: "اعتبار روزهای استفاده‌نشده",
};

// ─────────────── برآورد خسارت ───────────────

/** مجموع اقلام خسارت جدید — مبنای فرانشیز، نه یک عدد دستی */
export function grossRepairEstimate(amounts: readonly (number | null)[]): number {
  return amounts.reduce<number>((sum, n) => sum + (n ?? 0), 0);
}

export function buildDeductibleItem(gross: number, franchisePercent: number): DraftItem {
  return {
    type: "repair_deductible",
    label: ITEM_LABEL_FA.repair_deductible,
    amount: Math.round((gross * franchisePercent) / 100),
    basis: `${franchisePercent}٪ از ${gross.toLocaleString("fa-IR")}`,
    isSystemGenerated: true,
  };
}

/**
 * چشم‌پوشی از الزام کروکی فقط زیر سقف مصوب ممکن است؛
 * در آن حالت شرکت خودش بدون کروکی از بیمه استفاده می‌کند.
 */
export function canWaivePoliceReport(gross: number, ceiling: number): boolean {
  return gross < ceiling;
}

// ─────────────── اعتبار روزهای استفاده‌نشده ───────────────

export interface RentalCreditInput {
  /** لحظه تحویل خودرو — مبنای شمارش روز، نه نیمه‌شب تقویمی */
  handoverAt: Date;
  incidentAt: Date;
  totalDays: number;
  dailyRate: number;
}

export interface RentalCreditResult {
  consumedDays: number;
  unusedDays: number;
  amount: number;
}

/**
 * روز مصرف‌شده = ceil((زمان حادثه − زمان تحویل) / ۲۴ ساعت)
 *
 * ceil چون هر بخشی از یک روز، یک روز کامل حساب می‌شود — همان قاعده
 * تأخیر در بازگشت. خودرو آن روز از چرخه خارج شده.
 * مبنا لحظه تحویل است نه نیمه‌شب: تحویل ساعت ۱۰ است، پس مرز روز هم ۱۰ است.
 */
export function calculateRentalCredit(input: RentalCreditInput): RentalCreditResult {
  const elapsed = input.incidentAt.getTime() - input.handoverAt.getTime();
  const raw = Math.ceil(elapsed / MS_PER_DAY);
  const consumedDays = Math.min(Math.max(raw, 1), input.totalDays);
  const unusedDays = Math.max(input.totalDays - consumedDays, 0);
  return { consumedDays, unusedDays, amount: unusedDays * input.dailyRate };
}

/** اگر روز استفاده‌نشده‌ای نباشد، هیچ قلمی ساخته نمی‌شود */
export function buildRentalCreditItem(input: RentalCreditInput): DraftItem | null {
  const { unusedDays, amount } = calculateRentalCredit(input);
  if (unusedDays <= 0) return null;
  return {
    type: "rental_credit",
    label: ITEM_LABEL_FA.rental_credit,
    amount: -amount,
    basis: `${unusedDays.toLocaleString("fa-IR")} روز × ${input.dailyRate.toLocaleString("fa-IR")}`,
    isSystemGenerated: true,
  };
}

// ─────────────── جمع‌بندی صورت‌حساب ───────────────

export interface InvoiceTotals {
  /** مجموع اقلامی که از ودیعه تسویه می‌شوند */
  damageTotal: number;
  /** مجموع اعتبار اجاره، به‌صورت مثبت */
  rentalCreditTotal: number;
}

export function totals(items: readonly { type: string; amount: number }[]): InvoiceTotals {
  let damageTotal = 0;
  let rentalCreditTotal = 0;
  for (const item of items) {
    if (item.type === "rental_credit") rentalCreditTotal += Math.abs(item.amount);
    else damageTotal += item.amount;
  }
  return { damageTotal: Math.max(damageTotal, 0), rentalCreditTotal };
}

// ─────────────── مهلت پاسخ ───────────────

export function responseDeadlineFrom(issuedAt: Date, hours: number): Date {
  return new Date(issuedAt.getTime() + hours * 60 * 60 * 1000);
}

/**
 * به‌جای زمان‌بند، هر بار پرونده خوانده می‌شود این بررسی می‌شود.
 * برای این مقیاس کافی است و وابستگی زیرساختی اضافه نمی‌کند.
 */
export function isResponseDeadlinePassed(deadline: Date | null, now: Date): boolean {
  return deadline !== null && now.getTime() > deadline.getTime();
}
// ─────────────── تسویه نهایی ودیعه ───────────────

export type DepositSettlementStatus = "fully_refunded" | "partially_refunded" | "forfeited";

export interface SettleDepositInput {
  damageTotal: number;
  rentalCreditTotal: number;
  depositAmount: number;
}

export interface SettleDepositResult {
  depositStatus: DepositSettlementStatus;
  /** مبلغی که واقعاً از ودیعه کسر می‌شود — هیچ‌وقت از خود ودیعه بیشتر نمی‌شود */
  deductedFromDeposit: number;
  /** مابقی ودیعه که به مستأجر برمی‌گردد */
  depositRefund: number;
  /** بخشی از خسارت که ودیعه کفایتش را نمی‌دهد — بدهی مستأجر */
  shortfall: number;
  /** اعتبار روزهای استفاده‌نشده — از منبع پرداخت اجاره، نه ودیعه؛ هرگز خالص نمی‌شود */
  rentalCreditPayout: number;
}

/**
 * تسویه نهایی — استوری ۶.۱.
 *
 * سه حالت:
 *   سهم کاربر = صفر    → استرداد کامل ودیعه
 *   سهم کاربر < ودیعه  → کسر و استرداد مابقی
 *   سهم کاربر ≥ ودیعه  → کسر کامل ودیعه، مابقی بدهی مستقل می‌شود
 *
 * اعتبار روزهای استفاده‌نشده از منبعی جدا (پرداخت اجاره) می‌آید و
 * هیچ‌وقت با ودیعه خالص نمی‌شود — حتی وقتی ودیعه کاملاً سوخته باشد.
 */
export function settleDeposit(input: SettleDepositInput): SettleDepositResult {
  const { damageTotal, rentalCreditTotal, depositAmount } = input;

  const deductedFromDeposit = damageTotal <= 0 ? 0 : Math.min(damageTotal, depositAmount);
  const depositRefund = Math.max(depositAmount - damageTotal, 0);
  const shortfall = Math.max(damageTotal - depositAmount, 0);

  const depositStatus: DepositSettlementStatus =
    damageTotal === 0
      ? "fully_refunded"
      : damageTotal > depositAmount
        ? "forfeited"
        : "partially_refunded";

  return {
    depositStatus,
    deductedFromDeposit,
    depositRefund,
    shortfall,
    rentalCreditPayout: rentalCreditTotal,
  };
}