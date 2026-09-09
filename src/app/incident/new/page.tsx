import { redirect } from "next/navigation";
import IncidentWizard from "@/components/IncidentWizard";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { vehicleName } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function NewIncidentPage({
  searchParams,
}: {
  searchParams: { booking?: string };
}) {
  const session = await getSession();
  if (!session) redirect("/auth");

  const booking = await prisma.booking.findUnique({
    where: { id: Number(searchParams.booking) },
    include: { vehicle: true, incident: true },
  });

  if (!booking || booking.userId !== session.userId) redirect("/account/bookings");
  if (booking.status !== "active") redirect("/account/bookings");

  // هر رزرو یک پرونده — اگر از قبل هست، به همان می‌رویم
  if (booking.incident) redirect(`/incident/${booking.incident.trackingCode}`);

  return (
    <IncidentWizard
      bookingId={booking.id}
      vehicleLabel={`${vehicleName(booking.vehicle)} · ${booking.vehicle.plate}`}
    />
  );
}