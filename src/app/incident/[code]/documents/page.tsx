import { notFound, redirect } from "next/navigation";
import IncidentDocuments from "@/components/IncidentDocuments";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { vehicleName } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DocumentsPage({ params }: { params: { code: string } }) {
  const session = await getSession();
  if (!session) redirect("/auth");

  const incident = await prisma.incidentCase.findUnique({
    where: { trackingCode: params.code.toUpperCase() },
    include: {
      booking: { include: { vehicle: true, rental: true } },
      photos: { orderBy: { id: "asc" } },
    },
  });
  if (!incident || incident.userId !== session.userId) notFound();

  // پرونده مصدوم فرم ندارد؛ پیگیری تلفنی است
  if (incident.status === "reported_injury") redirect(`/incident/${incident.trackingCode}`);
  // مستندات یک بار ثبت می‌شود؛ پس از آن پرونده فقط خواندنی است
  if (incident.status !== "reported") redirect(`/incident/${incident.trackingCode}`);

  return (
    <IncidentDocuments
      code={incident.trackingCode}
      type={incident.type ?? "vehicle_collision"}
      vehicleLabel={vehicleName(incident.booking.vehicle)}
      initialPhotos={incident.photos.map((p: { id: number; storageKey: string; hint: string | null }) => ({ id: p.id, key: p.storageKey, hint: p.hint }))}
          pickupAt={(incident.booking.rental?.checkoutAt ?? incident.booking.pickupAt).toISOString()}
      initialReportKey={incident.policeReportFileKey}
    />
  );
}
