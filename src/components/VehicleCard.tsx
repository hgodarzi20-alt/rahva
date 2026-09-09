import Link from "next/link";
import { IconFuel, IconGearbox, IconMileage, IconSeats, Spec, SpecGrid } from "./SpecIcons";
import { toman, TRANSMISSION_FA, FUEL_FA, VEHICLE_CLASS_FA, toFaDigits, vehicleName } from "@/lib/format";

export interface VehicleCardData {
  id: number;
  brand: string;
  model: string;
  year: number;
  vehicleClass: string;
  transmission: string;
  fuelType: string;
  seats: number;
  dailyRate: number;
  dailyKmLimit: number;
  imageUrl: string | null;
}

/**
 * کارت خودرو در نتایج جستجو.
 * چیدمان سه‌ستونی مثل اکسپدیا: تصویر، مشخصات، و ستون قیمت جدا.
 * در عرض کم به یک ستون می‌افتد.
 */
export default function VehicleCard({
  vehicle,
  days,
  total,
  href,
  availableCount = 1,
}: {
  vehicle: VehicleCardData;
  days: number;
  total: number;
  href: string;
  availableCount?: number;
}) {
  return (
    <article className="card overflow-hidden">
      <div className="grid md:grid-cols-[220px_1fr_220px]">
        <VehicleImage vehicle={vehicle} />

        <div className="p-5">
          <h3 className="text-[17px] font-bold">{vehicleName(vehicle)}</h3>
          <div className="mt-0.5 text-[12px] text-ink-3">
            {VEHICLE_CLASS_FA[vehicle.vehicleClass]} · مدل {toFaDigits(vehicle.year)}
          </div>

          <SpecGrid className="mt-4 max-w-[420px]">
            <Spec icon={<IconSeats />}>{toFaDigits(vehicle.seats)} سرنشین</Spec>
            <Spec icon={<IconGearbox />}>{TRANSMISSION_FA[vehicle.transmission]}</Spec>
            <Spec icon={<IconFuel />}>{FUEL_FA[vehicle.fuelType]}</Spec>
            <Spec icon={<IconMileage />}>{toFaDigits(vehicle.dailyKmLimit)} کیلومتر در روز</Spec>
          </SpecGrid>

           <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line-2 pt-3 text-[12px] text-ink-2">
            <span>لغو رایگان تا ۲۴ ساعت پیش از تحویل</span>
            <span className="text-ink-3">·</span>
            <span>شعبه تهران</span>
            {availableCount > 1 && (
              <span className="badge badge-brand mr-auto">
                {toFaDigits(availableCount)} دستگاه موجود
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col justify-between border-t border-line p-5 md:border-r md:border-t-0">
          <div>
            <div className="text-[11px] text-ink-3">قیمت هر روز</div>
            <div className="text-[15px] font-semibold">{toman(vehicle.dailyRate)}</div>
            <div className="mt-3 text-[11px] text-ink-3">مجموع {toFaDigits(days)} روز</div>
            <div className="text-[20px] font-bold leading-tight">{toman(total)}</div>
            <div className="text-[11px] text-ink-3">تومان</div>
          </div>
          <Link href={href} className="btn btn-primary mt-4 w-full">انتخاب خودرو</Link>
        </div>
      </div>
    </article>
  );
}

/** تصویر خودرو؛ تا وقتی داده واقعی نیامده، جانگهدار با آیکون خودرو */
export function VehicleImage({ vehicle, tall = false }: { vehicle: { imageUrl: string | null; brand: string }; tall?: boolean }) {
  if (vehicle.imageUrl) {
    return (
      <div className={`bg-white ${tall ? "h-64" : "h-full min-h-[160px]"}`}>
        <img src={vehicle.imageUrl} alt={vehicle.brand} className="h-full w-full object-contain p-3" />
      </div>
    );
  }
  return (
    <div className={`flex items-center justify-center bg-white ${tall ? "h-64" : "h-full min-h-[160px]"}`}>
      <svg viewBox="0 0 120 48" className="w-[55%] stroke-line fill-none stroke-[2] [stroke-linecap:round] [stroke-linejoin:round]">
        <path d="M8 34h104M18 34c0-4 3-7 7-7s7 3 7 7M88 34c0-4 3-7 7-7s7 3 7 7" />
        <path d="M12 34V24l10-11h48l14 11h16c4 0 8 3 8 7v3" />
        <path d="M40 13v11M12 24h74" />
      </svg>
    </div>
  );
}
