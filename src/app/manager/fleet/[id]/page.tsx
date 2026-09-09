import { notFound } from "next/navigation";
import StaffHeader from "@/components/StaffHeader";
import VehicleForm from "@/components/VehicleForm";
import { prisma } from "@/lib/db";
import { vehicleName } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function EditVehiclePage({ params }: { params: { id: string } }) {
  const v = await prisma.vehicle.findUnique({ where: { id: Number(params.id) } });
  if (!v) notFound();

  return (
    <>
      <StaffHeader panel="manager" active="/manager/fleet" />
      <main className="p-6">
        <h1 className="mb-4 text-[17px] font-bold">ویرایش {vehicleName(v)}</h1>
        <VehicleForm
          initial={{
            id: v.id, plate: v.plate, brand: v.brand, model: v.model, year: String(v.year),
            vehicleClass: v.vehicleClass, transmission: v.transmission, fuelType: v.fuelType,
            seats: String(v.seats), dailyRate: String(v.dailyRate),
              dailyKmLimit: String(v.dailyKmLimit), extraKmRate: String(v.extraKmRate),
            marketValue: String(v.marketValue),
          }}
        />
      </main>
    </>
  );
}
