import StaffHeader from "@/components/StaffHeader";
import VehicleForm from "@/components/VehicleForm";

export default function NewVehiclePage() {
  return (
    <>
      <StaffHeader panel="manager" active="/manager/fleet" />
      <main className="p-6">
        <h1 className="mb-4 text-[17px] font-bold">افزودن خودرو</h1>
        <VehicleForm />
      </main>
    </>
  );
}
