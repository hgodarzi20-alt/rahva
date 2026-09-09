import Link from "next/link";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Row, Section } from "@/components/Row";
import { VehicleImage } from "@/components/VehicleCard";
import { IconFuel, IconGearbox, IconMileage, IconSeats, IconShield, IconPin, Spec, SpecGrid } from "@/components/SpecIcons";
import { prisma } from "@/lib/db";
import { computeDays, quote } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";
import { logEvent } from "@/lib/events";
import { toFaDigits, toman, FUEL_FA, TRANSMISSION_FA, VEHICLE_CLASS_FA, vehicleName } from "@/lib/format";
import { formatJalali } from "@/lib/jalali";

export const dynamic = "force-dynamic";

export default async function VehiclePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Record<string, string | undefined>;
}) {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: Number(params.id) } });
  if (!vehicle) notFound();

  const settings = await getSettings();
  const from = new Date(`${searchParams.from}T${searchParams.fromTime ?? "10:00"}`);
  const to = new Date(`${searchParams.to}T${searchParams.toTime ?? "10:00"}`);
  const days = computeDays(from, to);
  const q = quote(vehicle.dailyRate, days, settings.tax_rate_percent);

  await logEvent("car_viewed", { vehicleId: vehicle.id });

  const bookingHref = `/booking/driver?vehicleId=${vehicle.id}&from=${searchParams.from}&fromTime=${searchParams.fromTime ?? "10:00"}&to=${searchParams.to}&toTime=${searchParams.toTime ?? "10:00"}`;

  return (
    <>
      <Header />

      <main className="mx-auto max-w-[1200px] px-6 py-6">
        <Link href="/search" className="link text-[13px]">→ بازگشت به نتایج</Link>

        <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="flex flex-col gap-4">

            {/* کارت خودرو */}
            <Section>
              <div className="grid gap-5 md:grid-cols-[1fr_260px] md:items-center">
                <div>
                  <h1 className="text-[22px] font-bold">{vehicleName(vehicle)}</h1>
                  <p className="mt-0.5 text-[12px] text-ink-3">
                    {VEHICLE_CLASS_FA[vehicle.vehicleClass]} · مدل {toFaDigits(vehicle.year)}
                  </p>

                  <SpecGrid className="mt-5">
                    <Spec icon={<IconSeats />}>{toFaDigits(vehicle.seats)} سرنشین</Spec>
                    <Spec icon={<IconGearbox />}>{TRANSMISSION_FA[vehicle.transmission]}</Spec>
                    <Spec icon={<IconFuel />}>{FUEL_FA[vehicle.fuelType]}</Spec>
                    <Spec icon={<IconMileage />}>{toFaDigits(vehicle.dailyKmLimit)} کیلومتر در روز</Spec>
                    <Spec icon={<IconPin />}>تحویل در شعبه تهران</Spec>
                    <Spec icon={<IconShield />}>بیمه ثالث و بدنه</Spec>
                  </SpecGrid>

                  <div className="mt-5 text-[12px] text-ink-3">
                    پلاک <span className="mono">{vehicle.plate}</span>
                  </div>
                </div>

                <div className="overflow-hidden rounded-card">
                  <VehicleImage vehicle={vehicle} tall />
                </div>
              </div>
            </Section>

            {/* کارت شرایط اجاره */}
            <Section title="شرایط اجاره">
              <Row label="حداقل سن راننده">{toFaDigits(settings.min_driver_age)} سال</Row>
              <Row label="گواهینامه">معتبر و همراه راننده</Row>
              <Row label="سقف کیلومتر روزانه">{toFaDigits(vehicle.dailyKmLimit)} کیلومتر</Row>
              <Row label="کیلومتر اضافه">{toman(vehicle.extraKmRate)} تومان</Row>
              <Row label="تأخیر در بازگشت">
                تا {toFaDigits(settings.late_grace_hours)} ساعت رایگان
              </Row>
              <Row label="لغو رزرو">
                رایگان تا {toFaDigits(settings.cancel_deadline_hours)} ساعت قبل
              </Row>
              <p className="mt-3 border-t border-line-2 pt-3 text-[12px] text-ink-3">
                پس از مهلت رایگان، جریمه تأخیر {toFaDigits(settings.late_fee_percent)}٪ اجاره روزانه برای هر روز محاسبه می‌شود.
              </p>
            </Section>
          </div>

          {/* خلاصه رزرو */}
          <aside className="self-start lg:sticky lg:top-[84px]">
            <Section>
              <Row label="تحویل">{formatJalali(from)} · {toFaDigits(searchParams.fromTime ?? "10:00")}</Row>
              <Row label="بازگشت">{formatJalali(to)} · {toFaDigits(searchParams.toTime ?? "10:00")}</Row>
              <Row label="مدت">{toFaDigits(days)} روز</Row>

              <div className="my-3 h-px bg-line-2" />

              <Row label={`${toFaDigits(days)} روز × ${toman(vehicle.dailyRate)}`} strong={false}>
                {toman(q.rentAmount)}
              </Row>
              {q.taxAmount > 0 && (
                <Row label={`مالیات (${toFaDigits(settings.tax_rate_percent)}٪)`} strong={false}>
                  {toman(q.taxAmount)}
                </Row>
              )}

              <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
                <span className="font-bold">مبلغ کل</span>
                <span className="text-[19px] font-bold">{toman(q.totalAmount)}</span>
              </div>
              <div className="text-left text-[11px] text-ink-3">تومان</div>

                           {vehicle.marketValue && (
                <div className="blk blk-info mt-4">
                  <div className="flex items-baseline justify-between">
                    <b className="text-[13px]">ودیعه قابل استرداد</b>
                    <b className="text-[13px]">{toman(Math.round(vehicle.marketValue / 10))}</b>
                  </div>
                  <p className="mt-1.5 text-[12px] leading-6 text-ink-3">
                    این مبلغ امروز پرداخت نمی‌شود. هنگام تحویل خودرو دریافت می‌شود و پس از
                    بازگشت سالم خودرو به حساب شما بازمی‌گردد.
                  </p>
                </div>
              )}
              <Link href={bookingHref} className="btn btn-primary btn-lg mt-4">رزرو</Link>
              <p className="mt-2 text-center text-[11px] text-ink-3">
                کل مبلغ هنگام رزرو پرداخت می‌شود
              </p>
            </Section>
          </aside>
        </div>
      </main>

      <Footer />
    </>
  );
}