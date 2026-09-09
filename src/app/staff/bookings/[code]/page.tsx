import { decryptField } from "@/lib/crypto";
import { formatJalali } from "@/lib/jalali";
import { notFound } from "next/navigation";
import StaffHeader from "@/components/StaffHeader";
import { StatusBadge } from "@/components/Badge";
import CheckoutForm from "@/components/CheckoutForm";
import CheckinForm from "@/components/CheckinForm";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { faDateTime, toFaDigits, toman, vehicleName } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function StaffBookingPage({ params }: { params: { code: string } }) {
  const booking = await prisma.booking.findUnique({
    where: { code: params.code.toUpperCase() },
    include: { vehicle: true, rental: true },
  });
  if (!booking) notFound();

  const settings = await getSettings();

  return (
    <>
      <StaffHeader panel="staff" active="/staff" />
      <main className="p-6">
        <div className="mb-5 flex items-center gap-3">
          <h1 className="mono text-lg font-bold">{booking.code}</h1>
          <StatusBadge status={booking.status} />
        </div>

        <div className="mb-6 grid gap-4 rounded border border-line p-4 text-[13px] sm:grid-cols-4">
          <div><div className="text-[11px] text-ink-3">مشتری</div><strong>{booking.driverName}</strong></div>
          <div><div className="text-[11px] text-ink-3">خودرو</div><strong>{vehicleName(booking.vehicle)}</strong><div className="mono text-[11px] text-ink-3">{booking.vehicle.plate}</div></div>
          <div><div className="text-[11px] text-ink-3">تحویل</div><strong>{faDateTime(booking.pickupAt)}</strong></div>
          <div><div className="text-[11px] text-ink-3">بازگشت</div><strong>{faDateTime(booking.dropoffAt)}</strong></div>
        </div>

        {booking.status === "confirmed" && (
                  <CheckoutForm
            bookingId={booking.id}
            depositAmount={booking.depositAmountSnapshot}
            driver={{
              name: booking.driverName,
              nationalId: booking.driverNationalIdEnc ? decryptField(booking.driverNationalIdEnc) : "—",
              licenseNumber: booking.driverLicenseNumber,
              licenseExpiry: booking.driverLicenseExpiry
                ? formatJalali(booking.driverLicenseExpiry)
                : null,
            }}
          />
        )}

        {booking.status === "active" && booking.rental && (
          <CheckinForm
            bookingId={booking.id}
            checkoutOdometer={booking.rental.checkoutOdometer}
            days={booking.days}
            dailyKmLimit={booking.dailyKmLimitSnapshot}
            extraKmRate={booking.extraKmRateSnapshot}
            dailyRate={booking.dailyRateSnapshot}
            dropoffAt={booking.dropoffAt.toISOString()}
            lateGraceHours={settings.late_grace_hours}
            lateFeePercent={settings.late_fee_percent}
          />
        )}

        {booking.status === "completed" && booking.rental && (
          <div className="rounded border border-line p-5">
            <h2 className="mb-3 border-b border-line-2 pb-2 text-[13px] font-bold">اجاره بسته شده است</h2>
            <div className="grid gap-3 text-[13px] sm:grid-cols-4">
              <div><div className="text-[11px] text-ink-3">کیلومتر پیموده‌شده</div><strong>{toFaDigits(booking.rental.kmDriven ?? 0)}</strong></div>
              <div><div className="text-[11px] text-ink-3">مازاد بر سقف</div><strong>{toFaDigits(booking.rental.kmOverLimit ?? 0)}</strong></div>
              <div><div className="text-[11px] text-ink-3">روز تأخیر</div><strong>{toFaDigits(booking.rental.lateDays ?? 0)}</strong></div>
              <div><div className="text-[11px] text-ink-3">دریافت‌شده</div><strong>{toman(booking.rental.chargesTotal ?? 0)} تومان</strong></div>
            </div>
          </div>
        )}

        {!["confirmed", "active", "completed"].includes(booking.status) && (
          <div className="rounded border border-line bg-line-2 p-5 text-ink-2">
            این رزرو در وضعیت <StatusBadge status={booking.status} /> است و اقدامی روی آن ممکن نیست.
          </div>
        )}
      </main>
    </>
  );
}
