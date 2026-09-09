import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Row, Section } from "@/components/Row";
import PoliceReportUpload from "@/components/PoliceReportUpload";
import EstimateResponse from "@/components/EstimateResponse";
import { settleExpiredEstimate } from "@/lib/incident-deadline";
import { totals } from "@/lib/settlement";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { CUSTOMER_STATUS_FA, INCIDENT_TYPE_FA, POLICE_REPORT_FA, type IncidentStatus } from "@/lib/incident";
import { toman, vehicleName, toFaDigits } from "@/lib/format";
import { formatJalali } from "@/lib/jalali";

export const dynamic = "force-dynamic";

/** مراحلی که در تایم‌لاین نمایش داده می‌شوند، به ترتیب وقوع */
const TIMELINE: { key: string; label: string; statuses: IncidentStatus[] }[] = [
  { key: "reported", label: "پرونده ثبت شد", statuses: ["reported", "assistance_dispatched", "documented", "vehicle_recovered", "under_assessment", "estimate_issued", "accepted", "disputed", "resolved", "settled", "closed"] },
  { key: "documented", label: "مستندات تکمیل شد", statuses: ["documented", "vehicle_recovered", "under_assessment", "estimate_issued", "accepted", "disputed", "resolved", "settled", "closed"] },
  { key: "recovered", label: "خودرو منتقل شد", statuses: ["vehicle_recovered", "under_assessment", "estimate_issued", "accepted", "disputed", "resolved", "settled", "closed"] },
  { key: "assessment", label: "ارزیابی خسارت", statuses: ["under_assessment", "estimate_issued", "accepted", "disputed", "resolved", "settled", "closed"] },
  { key: "estimate", label: "صدور صورت‌حساب", statuses: ["estimate_issued", "accepted", "disputed", "resolved", "settled", "closed"] },
  { key: "response", label: "پاسخ شما", statuses: ["accepted", "disputed", "resolved", "settled", "closed"] },
  { key: "settled", label: "تسویه ودیعه", statuses: ["settled", "closed"] },
];

export default async function IncidentPage({ params }: { params: { code: string } }) {
  const session = await getSession();
  if (!session) redirect("/auth");

  const found = await prisma.incidentCase.findUnique({
    where: { trackingCode: params.code.toUpperCase() },
    select: { id: true },
  });
  if (!found) notFound();
  // پذیرش خودکار پس از انقضای مهلت — استوری ۵.۳ بند ۴
  await settleExpiredEstimate(found.id);

  const incident = await prisma.incidentCase.findUnique({
    where: { trackingCode: params.code.toUpperCase() },
    include: {
      booking: { include: { vehicle: true, deposit: true } },
      photos: true,
      invoice: { include: { items: true } },
    },
  });
  if (!incident || incident.userId !== session.userId) notFound();

  const status = incident.status as IncidentStatus;
  const currentIndex = TIMELINE.findIndex((t) => t.statuses.includes(status));

  return (
    <>
      <Header />
      <main className="mx-auto max-w-[720px] px-6 py-8">
        <Link href="/account/bookings" className="link text-[13px]">→ بازگشت به رزروها</Link>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="mono text-xl font-bold">{incident.trackingCode}</h1>
          <span className="badge badge-brand">{CUSTOMER_STATUS_FA[status]}</span>
        </div>
        <p className="mt-1.5 text-[13px] text-ink-3">
          {incident.type ? INCIDENT_TYPE_FA[incident.type as keyof typeof INCIDENT_TYPE_FA] : "در انتظار تعیین نوع"}
          {" · "}
          {vehicleName(incident.booking.vehicle)}
          {incident.occurredAt ? ` · ${formatJalali(incident.occurredAt)}` : ""}
        </p>

        <div className="mt-6 flex flex-col gap-4">
          {/* پرونده مصدوم از سیستم خارج می‌شود */}
          {status === "reported_injury" ? (
            <div className="blk blk-danger">
              <h4>پیگیری تلفنی</h4>
              <p>
                پشتیبانی رهوا مطلع شد و با شما تماس می‌گیرد. لازم نیست فرمی پر کنید.
                در صورت نیاز فوری با <a href="tel:02191000000" className="link">۰۲۱‑۹۱۰۰۰۰۰۰</a> تماس بگیرید.
              </p>
            </div>
          ) : (
            <>
              {/* کارهای ناتمام */}
              {status === "reported" && (
                <div className="blk blk-info">
                  <h4>مستندات را تکمیل کنید</h4>
                  <p>
                    عکس‌های صحنه، اطلاعات طرف مقابل و وضعیت کروکی هنوز ثبت نشده است.
                  </p>
                  <Link href={`/incident/${incident.trackingCode}/documents`} className="btn btn-primary btn-sm mt-3">
                    تکمیل مستندات
                  </Link>
                </div>
              )}

              {incident.policeReportStatus === "pending" && (
                <div className="blk blk-info">
                  <h4>در انتظار کروکی</h4>
                  <p>
                    تصویر کروکی هنوز آپلود نشده است.
                    {incident.policeReportDeadline
                      ? ` مهلت شما تا ${formatJalali(incident.policeReportDeadline)}.`
                      : ""}
                  </p>
                  <PoliceReportUpload code={incident.trackingCode} />
                </div>
              )}

              {incident.policeReportStatus === "uploaded" && incident.policeReportFileKey && (
                <div className="blk blk-ok">
                  <h4>کروکی دریافت شد</h4>
                  <p>سند کروکی در پرونده ثبت شده است.</p>
                  <a href={`/api/files?key=${incident.policeReportFileKey}`} target="_blank" rel="noreferrer"
                    className="link mt-2 inline-block text-[12px]">مشاهده سند</a>
                </div>
              )}

              {incident.policeReportStatus === "not_obtained" && (
                <div className="blk blk-danger">
                  <h4>کروکی تنظیم نشد</h4>
                  <p>
                    مطابق پذیرشی که ثبت کرده‌اید، بدون کروکی بیمه بدنه پرداختی ندارد و
                    جبران خسارت بر عهده شماست.
                  </p>
                </div>
              )}

              {status !== "reported" && incident.policeImpounded && (
                <div className="blk blk-warn">
                  <h4>خودرو در پارکینگ پلیس است</h4>
                  <p>
                    پرونده منتظر ترخیص خودرو از پارکینگ است؛ نیازی نیست خودرو را جایی ببرید.
                    شرکت پس از ترخیص با شما هماهنگ می‌کند.
                  </p>
                </div>
              )}

              {status !== "reported" && incident.policeImpounded === false && (
                <div className="blk blk-info">
                  <h4>بازگرداندن خودرو</h4>
                  <p>
                    {incident.recoveryMethod === "user_delivers"
                      ? "طبق هماهنگی با پشتیبانی، خودرو را خودتان به شعبه تحویل می‌دهید."
                      : incident.recoveryMethod === "agent_pickup"
                        ? "طبق هماهنگی با پشتیبانی، مأمور شرکت برای تحویل خودرو اعزام می‌شود."
                        : "برای هماهنگی روش بازگرداندن خودرو با پشتیبانی رهوا تماس بگیرید."}
                  </p>
                </div>
              )}

              {/* ودیعه */}
              {incident.booking.deposit && (
                <Section>
                  <div className="flex items-center justify-between">
                    <b className="text-[13px]">ودیعه</b>
                    <span className="badge badge-warn">
                      {incident.booking.deposit.status === "suspended" ? "معلق" : "نگهداری شده"}
                    </span>
                  </div>
                  <p className="mt-2 text-[13px] text-ink-2">
                    {toman(incident.booking.deposit.amount)} تومان — تا صدور صورت‌حساب هیچ کسری انجام نمی‌شود.
                  </p>
                </Section>
              )}

              {/* صورت‌حساب — استوری ۵.۲ و ۵.۳ */}
              {incident.invoice?.issuedAt && (
                <Section title="صورت‌حساب خسارت">
                  <div className="flex flex-col gap-2">
                    {incident.invoice.items.map((i: any) => (
                      <div key={i.id} className="flex items-baseline justify-between gap-2 text-[13px]">
                        <span>
                          {i.label}
                          {i.basis && <span className="mr-2 text-[11px] text-ink-3">{i.basis}</span>}
                        </span>
                        <span className={`mono ${i.amount < 0 ? "text-ok" : ""}`}>{toman(i.amount)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
                    <b>سهم شما از خسارت</b>
                    <b className="text-[17px]">{toman(totals(incident.invoice.items).damageTotal)}</b>
                  </div>
                  <div className="text-left text-[11px] text-ink-3">تومان</div>

                  {incident.invoice.responseDeadline && status === "estimate_issued" && (
                    <p className="mt-3 text-[12px] text-ink-3">
                      مهلت پاسخ تا {formatJalali(incident.invoice.responseDeadline)}. اگر پاسخ ندهید،
                      صورت‌حساب پذیرفته‌شده تلقی می‌شود.
                    </p>
                  )}

                  {status === "estimate_issued" && (
                    <EstimateResponse
                      code={incident.trackingCode}
                      items={incident.invoice.items.map((i: any) => ({
                        id: i.id, label: i.label, amount: i.amount,
                      }))}
                    />
                  )}

                  {status === "accepted" && (
                    <div className="blk blk-ok mt-4">
                      <h4>{incident.invoice.autoAcceptedAt ? "پذیرش خودکار پس از مهلت" : "صورت‌حساب را تأیید کردید"}</h4>
                      <p>تسویه ودیعه پس از این مرحله انجام می‌شود.</p>
                    </div>
                  )}

                  {status === "disputed" && (
                    <div className="blk blk-warn mt-4">
                      <h4>اعتراض شما ثبت شد</h4>
                      <p>مدیر در حال بررسی است و نتیجه به شما اعلام می‌شود.</p>
                    </div>
                  )}
                </Section>
              )}

              {/* تایم‌لاین عمودی */}
              <Section title="مراحل پرونده">
                <div className="relative mt-2 pr-6">
                  <span className="absolute right-[7px] top-2 bottom-5 w-px bg-line" />
                  {TIMELINE.map((t, i) => {
                    const done = i < currentIndex;
                    const active = i === currentIndex;
                    return (
                      <div key={t.key} className={`relative pb-5 ${!done && !active ? "opacity-50" : ""}`}>
                        <span className={`absolute -right-[23px] top-1 h-3.5 w-3.5 rounded-full border-[3px] border-white ${
                          done ? "bg-accent-dark"
                          : active ? "bg-white ring-[3px] ring-accent-dark"
                          : "border border-line bg-white"
                        }`} />
                        <b className="text-[13px]">{t.label}</b>
                        {active && (
                          <span className="mt-0.5 block text-[12px] text-ink-3">
                            {status === "under_assessment"
                              ? "معمولاً ۳ تا ۷ روز کاری طول می‌کشد."
                              : "در حال انجام"}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Section>

              {/* جزئیات ثبت‌شده */}
              <Section title="اطلاعات پرونده">
                <Row label="خودرو">{vehicleName(incident.booking.vehicle)}</Row>
                <Row label="کد رزرو"><span className="mono">{incident.booking.code}</span></Row>
                {incident.address && <Row label="موقعیت">{incident.address}</Row>}
                <Row label="قابلیت رانندگی">
                  {incident.isDrivable === null ? "—" : incident.isDrivable ? "قابل رانندگی" : "غیرقابل رانندگی"}
                </Row>
                {incident.policeReportStatus && (
                  <Row label="کروکی">{POLICE_REPORT_FA[incident.policeReportStatus as keyof typeof POLICE_REPORT_FA]}</Row>
                )}
                {incident.photos.length > 0 && (
                  <Row label="عکس‌های ثبت‌شده">{toFaDigits(incident.photos.length)} مورد</Row>
                )}
              </Section>
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}