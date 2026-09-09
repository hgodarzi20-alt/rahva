import { redirect } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Stepper from "@/components/Stepper";
import DriverForm from "@/components/DriverForm";
import { Row, Section } from "@/components/Row";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { computeDays, quote } from "@/lib/pricing";
import { toFaDigits, toman, vehicleName } from "@/lib/format";
import { formatJalali } from "@/lib/jalali";

export const dynamic = "force-dynamic";

export default async function DriverPage({ searchParams }: { searchParams: Record<string, string> }) {
  const qs = new URLSearchParams(searchParams).toString();
  const session = await getSession();
  if (!session) redirect(`/auth?next=${encodeURIComponent(`/booking/driver?${qs}`)}`);

  const vehicle = await prisma.vehicle.findUnique({ where: { id: Number(searchParams.vehicleId) } });
  if (!vehicle) redirect("/");

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  const settings = await getSettings();
  const pickupAt = new Date(`${searchParams.from}T${searchParams.fromTime ?? "10:00"}`);
  const dropoffAt = new Date(`${searchParams.to}T${searchParams.toTime ?? "10:00"}`);
  const days = computeDays(pickupAt, dropoffAt);
  const q = quote(vehicle.dailyRate, days, settings.tax_rate_percent);

  return (
    <>
      <Header />
      <main className="mx-auto max-w-[1200px] px-6 py-6">
        <Stepper current={2} />

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <DriverForm
            vehicleId={vehicle.id}
            pickupAt={pickupAt.toISOString()}
            dropoffAt={dropoffAt.toISOString()}
            minAge={settings.min_driver_age}
                        licenseMargin={6}
            initial={{
              fullName: user?.fullName ?? "",
              birthDate: user?.birthDate ? user.birthDate.toISOString().slice(0, 10) : "",
              licenseNumber: user?.licenseNumber ?? "",
              mobile: user?.mobile ?? "",
            }}
          />

          <aside className="self-start lg:sticky lg:top-[84px]">
            <Section>
              <div className="mb-2 font-semibold">{vehicleName(vehicle)}</div>
              <Row label="تحویل">{formatJalali(pickupAt)} · {toFaDigits(searchParams.fromTime ?? "10:00")}</Row>
              <Row label="بازگشت">{formatJalali(dropoffAt)} · {toFaDigits(searchParams.toTime ?? "10:00")}</Row>
              <Row label="مدت">{toFaDigits(days)} روز</Row>
              <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
                <span className="font-bold">مبلغ کل</span>
                <span className="text-[17px] font-bold">{toman(q.totalAmount)}</span>
              </div>
              <div className="text-left text-[11px] text-ink-3">تومان</div>
            </Section>
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}