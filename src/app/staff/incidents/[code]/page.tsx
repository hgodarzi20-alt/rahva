import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import StaffHeader from "@/components/StaffHeader";
import InspectionForm from "@/components/InspectionForm";
import InvoiceBuilder from "@/components/InvoiceBuilder";
import SettlementPanel from "@/components/SettlementPanel";
import RecoveryMethodPicker from "@/components/RecoveryMethodPicker";
import { Row, Section } from "@/components/Row";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { settleExpiredEstimate } from "@/lib/incident-deadline";
import { totals } from "@/lib/settlement";
import { STATUS_FA, INCIDENT_TYPE_FA, POLICE_REPORT_FA, type IncidentStatus } from "@/lib/incident";
import { faDateTime, toFaDigits, toman, vehicleName } from "@/lib/format";
import { formatJalali } from "@/lib/jalali";

export const dynamic = "force-dynamic";

const FAULT_FA: Record<string, string> = {
  self: "مستأجر", other_party: "طرف مقابل", unknown: "نامشخص",
};

export default async function StaffIncidentPage({ params }: { params: { code: string } }) {
  const session = await getSession();
  if (!session || session.role !== "operator") redirect("/auth");

  const settings = await getSettings();
  const code = params.code.toUpperCase();

  const first = await prisma.incidentCase.findUnique({ where: { trackingCode: code } });
  if (!first) notFound();
  // پذیرش خودکار پس از انقضای مهلت — محاسبه تنبل
  await settleExpiredEstimate(first.id);

  const incident = await prisma.incidentCase.findUnique({
    where: { trackingCode: code },
    include: {
      booking: { include: { vehicle: true, rental: { include: { damages: true } }, deposit: true } },
      counterparty: true,
      obstacle: true,
      photos: true,
      invoice: { include: { items: true } },
      dispute: true,
    },
  });
  if (!incident) notFound();

  const status = incident.status as IncidentStatus;
  const prior = (incident.booking.rental?.damages ?? []).filter((d: any) => d.phase === "checkout");
  const t = totals(incident.invoice?.items ?? []);

  return (
    <>
      <StaffHeader panel="staff" active="/staff/incidents" />
      <main className="p-6">
        <Link href="/staff/incidents" className="link text-[13px]">→ بازگشت به فهرست</Link>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="mono text-xl font-bold">{incident.trackingCode}</h1>
          <span className="badge">{STATUS_FA[status]}</span>
          {incident.policeReportStatus === "not_obtained" && (
            <span className="badge badge-danger">بدون کروکی</span>
          )}
        </div>
        <p className="mt-1.5 text-[13px] text-ink-3">
          {vehicleName(incident.booking.vehicle)} · {incident.booking.code} · {incident.booking.driverName}
          {incident.occurredAt ? ` · ${faDateTime(incident.occurredAt)}` : ""}
        </p>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Section title="گزارش کاربر">
            <Row label="نوع حادثه">
              {incident.type ? INCIDENT_TYPE_FA[incident.type as keyof typeof INCIDENT_TYPE_FA] : "—"}
            </Row>
            <Row label="قابلیت رانندگی">
              {incident.isDrivable === null ? "—" : incident.isDrivable ? "قابل رانندگی" : "غیرقابل رانندگی"}
            </Row>
            <Row label="موقعیت">{incident.address ?? "—"}</Row>
            <Row label="ادعای مقصر">{incident.faultClaim ? FAULT_FA[incident.faultClaim] : "—"}</Row>
            {incident.confirmedFault && (
              <Row label="مقصر تأییدشده">{FAULT_FA[incident.confirmedFault]}</Row>
            )}
            <Row label="کروکی">
              {incident.policeReportStatus ? POLICE_REPORT_FA[incident.policeReportStatus as keyof typeof POLICE_REPORT_FA] : "—"}
              {incident.policeReportDeadline
                ? ` · مهلت ${formatJalali(incident.policeReportDeadline)}`
                : ""}
            </Row>
            {incident.counterparty && (
              <>
                <Row label="طرف مقابل">{incident.counterparty.fullName ?? "—"}</Row>
                <Row label="پلاک طرف مقابل">{incident.counterparty.plateNumber ?? "—"}</Row>
                <Row label="بیمه‌نامه ثالث">
                  {incident.counterparty.insurerName ?? "—"}
                  {incident.counterparty.policyNumber ? ` · ${incident.counterparty.policyNumber}` : ""}
                </Row>
              </>
            )}
            {incident.obstacle && (
              <Row label="مانع">
                {incident.obstacle.ownership === "third_party" ? "متعلق به شخص یا نهاد دیگر" : "بدون مالک مشخص"}
              </Row>
            )}
            {incident.status !== "reported" && (
              <Row label="توقیف پلیس">
                {incident.policeImpounded ? "بله — منتظر ترخیص" : "خیر — خودرو در اختیار مستأجر است"}
              </Row>
            )}
            {incident.status !== "reported" && incident.policeImpounded === false && (
              <div className="mt-3 border-t border-line-2 pt-3">
                <label className="label">روش بازگرداندن خودرو — پس از هماهنگی تلفنی</label>
                <RecoveryMethodPicker code={incident.trackingCode} current={incident.recoveryMethod} />
              </div>
            )}

            {incident.description && (
              <p className="mt-3 border-t border-line-2 pt-3 text-[13px] text-ink-2">
                {incident.description}
              </p>
            )}

            {incident.photos.length > 0 && (
              <>
                <div className="my-4 h-px bg-line-2" />
                <b className="text-[13px]">عکس‌های کاربر — {toFaDigits(incident.photos.length)} مورد</b>
                <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {incident.photos.map((p: any) => (
                    <a key={p.id} href={`/api/files?key=${p.storageKey}`} target="_blank" rel="noreferrer"
                      className="aspect-square overflow-hidden rounded border border-line">
                      <img src={`/api/files?key=${p.storageKey}`} alt="" className="h-full w-full object-cover" />
                    </a>
                  ))}
                </div>
              </>
            )}
            {incident.policeReportFileKey && (
              <a href={`/api/files?key=${incident.policeReportFileKey}`} target="_blank" rel="noreferrer"
                className="link mt-3 inline-block text-[12px]">مشاهده سند کروکی</a>
            )}
          </Section>

          <Section title="ودیعه و اجاره" className="self-start">
            <Row label="ودیعه">
              {incident.booking.deposit ? toman(incident.booking.deposit.amount) : "—"}
            </Row>
            <Row label="وضعیت ودیعه">
              {incident.booking.deposit?.status === "suspended" ? "معلق" : incident.booking.deposit?.status ?? "—"}
            </Row>
            <Row label="اجاره روزانه">{toman(incident.booking.dailyRateSnapshot)}</Row>
            <Row label="مدت رزرو">{toFaDigits(incident.booking.days)} روز</Row>
            <Row label="تحویل خودرو">
              {incident.booking.rental ? faDateTime(incident.booking.rental.checkoutAt) : "—"}
            </Row>
          </Section>
        </div>

        {/* ─── بازرسی ─── */}
        {(status === "documented" || status === "vehicle_recovered") && (
          <>
            <h2 className="mb-3 mt-8 text-[15px] font-bold">بازرسی خسارت</h2>
            <InspectionForm
              code={incident.trackingCode}
              priorDamages={prior.map((d: any) => ({ title: d.title, location: d.location }))}
            />
          </>
        )}

        {/* ─── صورت‌حساب ─── */}
        {status === "under_assessment" && incident.invoice && (
          <>
            <h2 className="mb-3 mt-8 text-[15px] font-bold">صورت‌حساب خسارت</h2>
            <InvoiceBuilder
              code={incident.trackingCode}
              gross={incident.invoice.grossRepairEstimate}
              franchisePercent={settings["franchise.percent"]}
              waiverCeiling={settings["police_report.waiver_ceiling_toman"]}
              policeReportStatus={incident.policeReportStatus}
              confirmedFault={incident.confirmedFault}
              responseHours={settings["deadline.invoice_response_hours"]}
              parkingDailyRate={settings["parking.daily_rate_toman"]}
              preview={(incident.invoice.items ?? []).map((i: any) => ({
                type: i.type, label: i.label, amount: i.amount, basis: i.basis,
              }))}
            />
          </>
        )}

        {/* ─── صورت‌حساب صادرشده ─── */}
        {incident.invoice?.issuedAt && (
          <>
            <h2 className="mb-3 mt-8 text-[15px] font-bold">صورت‌حساب صادرشده</h2>
            <div className="card overflow-hidden">
              <table className="w-full text-[13px]">
                <tbody>
                  {incident.invoice.items.map((i: any) => (
                    <tr key={i.id} className="border-b border-line-2">
                      <td className="p-3">{i.label}
                        {i.basis && <span className="mr-2 text-[11px] text-ink-3">{i.basis}</span>}
                      </td>
                      <td className={`mono p-3 text-left ${i.amount < 0 ? "text-ok" : ""}`}>
                        {toman(i.amount)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-line-2">
                    <td className="p-3 font-bold">سهم مستأجر از خسارت</td>
                    <td className="mono p-3 text-left font-bold">{toman(t.damageTotal)}</td>
                  </tr>
                  {t.rentalCreditTotal > 0 && (
                    <tr>
                      <td className="p-3 text-ink-2">اعتبار اجاره — از پرداخت اولیه</td>
                      <td className="mono p-3 text-left text-ok">{toman(t.rentalCreditTotal)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[12px] text-ink-3">
              صادر شده در {faDateTime(incident.invoice.issuedAt)}
              {incident.invoice.responseDeadline
                ? ` · مهلت پاسخ تا ${faDateTime(incident.invoice.responseDeadline)}`
                : ""}
              {incident.invoice.autoAcceptedAt ? " · پذیرش خودکار پس از مهلت" : ""}
              {incident.invoice.acceptedAt ? " · مستأجر پذیرفت" : ""}
            </p>
          </>
        )}
                {(status === "accepted" || status === "resolved") &&
          incident.invoice?.issuedAt &&
          incident.booking.deposit && (
            <>
              <h2 className="mb-3 mt-8 text-[15px] font-bold">تسویه نهایی</h2>
              <SettlementPanel
                code={incident.trackingCode}
                damageTotal={t.damageTotal}
                rentalCreditTotal={t.rentalCreditTotal}
                depositAmount={incident.booking.deposit.amount}
                refundIban={incident.booking.refundIban}
                refundBankName={incident.booking.refundBankName}
              />
            </>
          )}

        {status === "settled" && incident.booking.deposit && (
          <div className="blk blk-info mt-8">
            <h4>پرونده تسویه شد</h4>
            <p>
              وضعیت ودیعه:{" "}
              {incident.booking.deposit.status === "fully_refunded"
                ? "استرداد کامل"
                : incident.booking.deposit.status === "partially_refunded"
                  ? "کسر و استرداد مابقی"
                  : "کسر کامل"}
              {incident.booking.deposit.releasedAt
                ? ` · ${faDateTime(incident.booking.deposit.releasedAt)}`
                : ""}
            </p>
          </div>
        )}

        {incident.dispute && (
          <div className="blk blk-warn mt-4">
            <h4>اعتراض مستأجر</h4>
            <p>{incident.dispute.reason}</p>
            <p className="mt-1.5 text-[11px]">
              ثبت‌شده در {faDateTime(incident.dispute.submittedAt)} · رسیدگی با مدیر است.
            </p>
          </div>
        )}
      </main>
    </>
  );
}
