import { BOOKING_STATUS_FA } from "@/lib/format";

const STYLES: Record<string, string> = {
  pending_payment: "badge-warn",
  confirmed: "badge-brand",
  active: "badge-ok",
  completed: "",
  cancelled: "",
  failed: "badge-danger",
  no_show: "badge-danger",
  late: "badge-warn",
  closed_with_incident: "badge-warn",

  reported_injury: "badge-danger",
  reported: "badge-brand",
  documented: "badge-ok",
  assistance_dispatched: "badge-brand",
  vehicle_recovered: "badge-brand",
  under_assessment: "badge-brand",
  estimate_issued: "badge-warn",
  accepted: "badge-ok",
  disputed: "badge-warn",
  resolved: "badge-brand",
  settled: "badge-ok",
  closed: "",

  held: "badge-brand",
  suspended: "badge-warn",
  partially_refunded: "badge-ok",
  fully_refunded: "badge-ok",
  forfeited: "badge-danger",

  uploaded: "badge-ok",
  pending: "badge-warn",
  not_obtained: "badge-danger",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return (
    <span className={`badge ${STYLES[status] ?? ""}`}>
      {label ?? BOOKING_STATUS_FA[status] ?? status}
    </span>
  );
}
