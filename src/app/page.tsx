import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SearchForm from "@/components/SearchForm";
import { VehicleImage } from "@/components/VehicleCard";
import { IconPin, IconShield, IconMileage } from "@/components/SpecIcons";
import { prisma } from "@/lib/db";
import { toman, toFaDigits, VEHICLE_CLASS_FA } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const branch = await prisma.branch.findFirstOrThrow();
  const rows = await prisma.vehicle.findMany({
    where: { status: "available" },
    select: { vehicleClass: true, dailyRate: true, imageUrl: true },
    orderBy: { dailyRate: "asc" },
  });

  // ارزان‌ترین خودروی هر کلاس نماینده آن کلاس می‌شود
  const byClass = new Map<string, { count: number; min: number; imageUrl: string | null }>();
  for (const r of rows) {
    const g = byClass.get(r.vehicleClass);
    if (!g) byClass.set(r.vehicleClass, { count: 1, min: r.dailyRate, imageUrl: r.imageUrl });
    else g.count += 1;
  }
  const classes = [...byClass.entries()].map(([vehicleClass, v]) => ({ vehicleClass, ...v }));

  // تاریخ پیش‌فرض برای لینک کلاس‌ها: از فردا به مدت سه روز
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const defaultSearch = `/search?from=${iso(new Date(Date.now() + 86400000))}&fromTime=10:00&to=${iso(new Date(Date.now() + 4 * 86400000))}&toTime=10:00`;

  return (
    <>
      <Header />
      <main>
        {/* بخش جستجو */}
        <section className="border-b border-line bg-white">
          <div className="mx-auto max-w-[1200px] px-6 pb-8 pt-10">
            <h1 className="text-[30px] font-bold leading-tight">
              خودرو را آنلاین رزرو کنید، سرِ ساعت تحویل بگیرید.
            </h1>
            <div className="mt-6">
              <SearchForm branchName={branch.name} opensAt={branch.opensAt} closesAt={branch.closesAt} />
            </div>
          </div>
        </section>

        {/* سه سیگنال اعتماد */}
        <section className="mx-auto max-w-[1200px] px-6 py-8">
          <div className="grid gap-4 md:grid-cols-3">
            <Trust icon={<IconShield />} title="بیمه ثالث و بدنه">
              همه خودروها با بیمه معتبر تحویل داده می‌شوند.
            </Trust>
            <Trust icon={<IconMileage />} title="قیمت شفاف">
              مبلغ اجاره و شرایط کیلومتر پیش از پرداخت به‌صورت کامل نمایش داده می‌شود.
            </Trust>
            <Trust icon={<IconPin />} title="تحویل در شعبه تهران">
              تحویل و بازگشت در محل شعبه، با قرارداد رسمی.
            </Trust>
          </div>
        </section>

        {/* کلاس‌های موجود */}
        <section className="mx-auto max-w-[1200px] px-6 pb-12">
          <h2 className="mb-4 text-[17px] font-bold">کلاس‌های موجود</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {classes.map((c) => (
              <Link key={c.vehicleClass} href={`${defaultSearch}&class=${c.vehicleClass}`} className="card overflow-hidden transition hover:border-ink-3">
                                  <div className="flex h-32 items-center justify-center bg-white">
                  {c.imageUrl ? (
                    <img src={c.imageUrl} alt="" className="h-full w-full object-contain p-3" />
                  ) : (
                    <svg viewBox="0 0 120 48" className="w-[45%] stroke-line fill-none stroke-[2]">
                      <path d="M8 34h104M12 34V24l10-11h48l14 11h16c4 0 8 3 8 7v3" />
                    </svg>
                  )}
                </div>
      
                <div className="p-4">
                  <div className="font-semibold">{VEHICLE_CLASS_FA[c.vehicleClass]}</div>
                  <div className="mt-1 text-[12px] text-ink-3">
                    {toFaDigits(c.count)} خودرو موجود
                  </div>
                  <div className="mt-2 text-[13px]">
                    از <strong>{toman(c.min ?? 0)}</strong> تومان در روز
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

function Trust({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="card flex gap-3 p-4">
      <span className="mt-0.5">{icon}</span>
      <div>
        <div className="font-semibold">{title}</div>
        <p className="mt-1 text-[12px] leading-6 text-ink-2">{children}</p>
      </div>
    </div>
  );
}