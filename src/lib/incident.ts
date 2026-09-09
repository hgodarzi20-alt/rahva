/**
 * منطق پرونده حادثه — ماشین وضعیت، کد پیگیری، و متن‌های فارسی.
 *
 * نکته معماری: وضعیت کروکی اینجا نیست. پرونده می‌تواند همزمان
 * under_assessment باشد و منتظر کروکی، پس آن یک محور مستقل است.
 */

export type IncidentStatus =
  | "reported_injury" | "reported" | "documented" | "assistance_dispatched"
  | "vehicle_recovered" | "under_assessment" | "estimate_issued"
  | "accepted" | "disputed" | "resolved" | "settled" | "closed";

const TRANSITIONS: Record<IncidentStatus, readonly IncidentStatus[]> = {
  reported_injury: [],
  reported: ["assistance_dispatched", "documented"],
  assistance_dispatched: ["documented", "vehicle_recovered"],
  documented: ["assistance_dispatched", "vehicle_recovered"],
  vehicle_recovered: ["under_assessment"],
  under_assessment: ["estimate_issued"],
  estimate_issued: ["accepted", "disputed"],
  accepted: ["settled"],
  disputed: ["resolved"],
  resolved: ["settled"],
  settled: ["closed"],
  closed: [],
};

export function canTransition(from: IncidentStatus, to: IncidentStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** وضعیت‌هایی که پرونده در آنها هنوز باز است */
export function isOpen(status: IncidentStatus): boolean {
  return status !== "closed" && status !== "reported_injury";
}

export const STATUS_FA: Record<IncidentStatus, string> = {
  reported_injury: "پیگیری تلفنی",
  reported: "ثبت شد",
  documented: "مستندات کامل شد",
  assistance_dispatched: "امداد در راه",
  vehicle_recovered: "خودرو منتقل شد",
  under_assessment: "در حال ارزیابی",
  estimate_issued: "صورت‌حساب صادر شد",
  accepted: "صورت‌حساب پذیرفته شد",
  disputed: "اعتراض ثبت شد",
  resolved: "نتیجه اعتراض صادر شد",
  settled: "تسویه شد",
  closed: "بسته شد",
};

export const POLICE_REPORT_FA = {
  uploaded: "کروکی دریافت شد",
  pending: "در انتظار کروکی",
  not_obtained: "کروکی تنظیم نشد",
} as const;

export const INCIDENT_TYPE_FA = {
  vehicle_collision: "برخورد با خودروی دیگر",
  obstacle_collision: "برخورد با مانع ثابت",
} as const;

/**
 * کد پیگیری. عمداً کوتاه و بدون نویسه مبهم، تا کاربر بتواند
 * تلفنی بخواند یا از پیامک رونویسی کند.
 */
export function makeTrackingCode(sequence: number): string {
  return `HD-${String(sequence).padStart(4, "0")}`;
}
