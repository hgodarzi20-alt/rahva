import { describe, it, expect } from "vitest";

import {
  grossRepairEstimate,
  buildDeductibleItem,
  canWaivePoliceReport,
  calculateRentalCredit,
  buildRentalCreditItem,
  totals,
  responseDeadlineFrom,
  isResponseDeadlinePassed,
  settleDeposit,
} from "../src/lib/settlement";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** ۱۴۰۳/۰۶/۱۰ ساعت ۱۰:۰۰ — تحویل خودرو */
const handoverAt = new Date("2024-09-01T10:00:00.000Z");

describe("grossRepairEstimate", () => {
  it("اقلام بدون مبلغ را صفر حساب می‌کند", () => {
    expect(grossRepairEstimate([1_000_000, null, 500_000])).toBe(1_500_000);
  });

  it("فهرست خالی صفر است", () => {
    expect(grossRepairEstimate([])).toBe(0);
  });
});

describe("buildDeductibleItem", () => {
  it("فرانشیز را با گرد کردن حساب می‌کند", () => {
    const item = buildDeductibleItem(45_000_000, 10);
    expect(item.amount).toBe(4_500_000);
    expect(item.type).toBe("repair_deductible");
    expect(item.isSystemGenerated).toBe(true);
  });

  it("کسر اعشاری گرد می‌شود و تومان صحیح می‌ماند", () => {
    const item = buildDeductibleItem(1_000_005, 10);
    expect(Number.isInteger(item.amount)).toBe(true);
    expect(item.amount).toBe(100_001);
  });
});

describe("canWaivePoliceReport", () => {
  const ceiling = 53_300_000;

  it("زیر سقف، چشم‌پوشی ممکن است", () => {
    expect(canWaivePoliceReport(ceiling - 1, ceiling)).toBe(true);
  });

  it("دقیقاً روی سقف، چشم‌پوشی ممکن نیست", () => {
    expect(canWaivePoliceReport(ceiling, ceiling)).toBe(false);
  });

  it("بالای سقف، چشم‌پوشی ممکن نیست", () => {
    expect(canWaivePoliceReport(ceiling + 1, ceiling)).toBe(false);
  });
});

describe("calculateRentalCredit", () => {
  const base = { handoverAt, totalDays: 5, dailyRate: 2_000_000 };

  it("حادثه در همان ساعت تحویل، یک روز مصرف‌شده است", () => {
    const r = calculateRentalCredit({ ...base, incidentAt: handoverAt });
    expect(r.consumedDays).toBe(1);
    expect(r.unusedDays).toBe(4);
    expect(r.amount).toBe(8_000_000);
  });

  it("هر بخشی از روز، یک روز کامل حساب می‌شود", () => {
    const r = calculateRentalCredit({
      ...base,
      incidentAt: new Date(handoverAt.getTime() + DAY + HOUR),
    });
    expect(r.consumedDays).toBe(2);
    expect(r.unusedDays).toBe(3);
  });

  it("مرز دقیق ۲۴ ساعت هنوز یک روز است", () => {
    const r = calculateRentalCredit({
      ...base,
      incidentAt: new Date(handoverAt.getTime() + DAY),
    });
    expect(r.consumedDays).toBe(1);
  });

  it("حادثه پس از پایان اجاره، مصرف را از کل روزها بیشتر نمی‌کند", () => {
    const r = calculateRentalCredit({
      ...base,
      incidentAt: new Date(handoverAt.getTime() + 10 * DAY),
    });
    expect(r.consumedDays).toBe(5);
    expect(r.unusedDays).toBe(0);
    expect(r.amount).toBe(0);
  });
});

describe("buildRentalCreditItem", () => {
  const base = { handoverAt, totalDays: 3, dailyRate: 1_500_000 };

  it("مبلغ منفی ثبت می‌شود", () => {
    const item = buildRentalCreditItem({ ...base, incidentAt: handoverAt });
    expect(item).not.toBeNull();
    expect(item!.amount).toBe(-3_000_000);
    expect(item!.type).toBe("rental_credit");
  });

  it("بدون روز استفاده‌نشده، قلمی ساخته نمی‌شود", () => {
    const item = buildRentalCreditItem({
      ...base,
      incidentAt: new Date(handoverAt.getTime() + 5 * DAY),
    });
    expect(item).toBeNull();
  });
});

describe("totals", () => {
  it("اعتبار اجاره از اقلام خسارت جدا می‌ماند", () => {
    const t = totals([
      { type: "repair_deductible", amount: 4_500_000 },
      { type: "parking", amount: 900_000 },
      { type: "rental_credit", amount: -3_000_000 },
    ]);
    expect(t.damageTotal).toBe(5_400_000);
    expect(t.rentalCreditTotal).toBe(3_000_000);
  });

  it("مجموع خسارت هیچ‌وقت منفی نمی‌شود", () => {
    const t = totals([{ type: "repair_deductible", amount: -1_000 }]);
    expect(t.damageTotal).toBe(0);
  });

  it("فهرست خالی هر دو را صفر می‌کند", () => {
    expect(totals([])).toEqual({ damageTotal: 0, rentalCreditTotal: 0 });
  });
});

describe("مهلت پاسخ", () => {
  const issuedAt = new Date("2024-09-01T10:00:00.000Z");

  it("مهلت بر حسب ساعت جلو می‌رود", () => {
    expect(responseDeadlineFrom(issuedAt, 72).toISOString()).toBe("2024-09-04T10:00:00.000Z");
  });

  it("بدون مهلت، هیچ‌وقت منقضی نیست", () => {
    expect(isResponseDeadlinePassed(null, new Date())).toBe(false);
  });

  it("دقیقاً روی مهلت هنوز منقضی نشده", () => {
    const deadline = responseDeadlineFrom(issuedAt, 72);
    expect(isResponseDeadlinePassed(deadline, deadline)).toBe(false);
  });

  it("یک میلی‌ثانیه بعد منقضی است", () => {
    const deadline = responseDeadlineFrom(issuedAt, 72);
    expect(isResponseDeadlinePassed(deadline, new Date(deadline.getTime() + 1))).toBe(true);
  });
});

describe("settleDeposit", () => {
  const deposit = 30_000_000;

  it("سهم کاربر صفر — استرداد کامل", () => {
    const r = settleDeposit({ damageTotal: 0, rentalCreditTotal: 0, depositAmount: deposit });
    expect(r.depositStatus).toBe("fully_refunded");
    expect(r.depositRefund).toBe(deposit);
    expect(r.deductedFromDeposit).toBe(0);
    expect(r.shortfall).toBe(0);
  });

  it("سهم کاربر کمتر از ودیعه — کسر و استرداد مابقی", () => {
    const r = settleDeposit({
      damageTotal: 12_000_000,
      rentalCreditTotal: 0,
      depositAmount: deposit,
    });
    expect(r.depositStatus).toBe("partially_refunded");
    expect(r.deductedFromDeposit).toBe(12_000_000);
    expect(r.depositRefund).toBe(18_000_000);
    expect(r.shortfall).toBe(0);
  });

  it("سهم کاربر دقیقاً برابر ودیعه — استرداد صفر ولی بدهی هم صفر", () => {
    const r = settleDeposit({
      damageTotal: deposit,
      rentalCreditTotal: 0,
      depositAmount: deposit,
    });
    expect(r.depositStatus).toBe("partially_refunded");
    expect(r.depositRefund).toBe(0);
    expect(r.shortfall).toBe(0);
  });

  it("سهم کاربر بیشتر از ودیعه — ودیعه سوخت و مازاد ثبت می‌شود", () => {
    const r = settleDeposit({
      damageTotal: 45_000_000,
      rentalCreditTotal: 0,
      depositAmount: deposit,
    });
    expect(r.depositStatus).toBe("forfeited");
    expect(r.deductedFromDeposit).toBe(deposit);
    expect(r.depositRefund).toBe(0);
    expect(r.shortfall).toBe(15_000_000);
  });

  it("اعتبار اجاره با ودیعه خالص نمی‌شود و جدا واریز می‌شود", () => {
    const r = settleDeposit({
      damageTotal: 45_000_000,
      rentalCreditTotal: 6_000_000,
      depositAmount: deposit,
    });
    expect(r.shortfall).toBe(15_000_000);
    expect(r.rentalCreditPayout).toBe(6_000_000);
    expect(r.depositRefund).toBe(0);
  });

  it("ودیعه صفر — همه خسارت بدهی می‌شود", () => {
    const r = settleDeposit({
      damageTotal: 5_000_000,
      rentalCreditTotal: 0,
      depositAmount: 0,
    });
    expect(r.depositStatus).toBe("forfeited");
    expect(r.shortfall).toBe(5_000_000);
    expect(r.depositRefund).toBe(0);
  });
});
