import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import VehicleCard from "@/components/VehicleCard";
import { findAvailableVehicles, suggestAlternatives } from "@/lib/availability";
import { computeDays, quote } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";
import { logEvent } from "@/lib/events";
import { toFaDigits, TRANSMISSION_FA, VEHICLE_CLASS_FA } from "@/lib/format";
import { formatJalali, fromIso } from "@/lib/jalali";

export const dynamic = "force-dynamic";

type SP = Record<string, string | undefined>;

function parseRange(sp: SP) {
  const from = new Date(`${sp.from}T${sp.fromTime ?? "10:00"}`);
  const to = new Date(`${sp.to}T${sp.toTime ?? "10:00"}`);
  return { from, to };
}

export default async function SearchPage({ searchParams }: { searchParams: SP }) {
  const { from, to } = parseRange(searchParams);
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || to <= from) {
    return (
      <>
        <Header />
        <main className="p-10 text-center">
          <p className="text-ink-2">بازه‌ی زمانی نامعتبر است.</p>
          <Link href="/" className="btn btn-primary mt-4 inline-flex">بازگشت به جست‌وجو</Link>
        </main>
      </>
    );
  }

  const settings = await getSettings();
  const days = computeDays(from, to);

  const selectedClasses = searchParams.class?.split(",").filter(Boolean) ?? [];
  const selectedTransmissions = searchParams.gearbox?.split(",").filter(Boolean) ?? [];
  const sort = searchParams.sort === "price_desc" ? "price_desc" : "price_asc";

  const vehicles = await findAvailableVehicles(from, to, {
    vehicleClass: selectedClasses,
    transmission: selectedTransmissions,
    minSeats: searchParams.seats ? Number(searchParams.seats) : undefined,
    sort,
  });

  /**
   * گروه‌بندی در سطح مدل — نه در سطح تک‌تک دستگاه‌ها.
   * منطق موجودی دست‌نخورده در سطح خودرو کار می‌کند؛ این فقط نمایش است.
   * ارزان‌ترین دستگاه هر مدل نماینده گروه می‌شود و تعداد آزاد کنارش می‌آید.
   */
  const groups = new Map<string, { rep: (typeof vehicles)[number]; count: number }>();
  for (const v of vehicles) {
    const key = `${v.brand}|${v.model}`;
    const g = groups.get(key);
    if (!g) groups.set(key, { rep: v, count: 1 });
    else {
      g.count += 1;
      if (v.dailyRate < g.rep.dailyRate) g.rep = v;
    }
  }
  const grouped = [...groups.values()].sort((a, b) =>
    sort === "price_desc" ? b.rep.dailyRate - a.rep.dailyRate : a.rep.dailyRate - b.rep.dailyRate,
  );

  const all = await findAvailableVehicles(from, to, {});
  const countModels = (key: "vehicleClass" | "transmission", value: string) =>
    new Set(all.filter((v) => v[key] === value).map((v) => `${v.brand}|${v.model}`)).size;

  await logEvent("search_performed", {
    payload: { from: from.toISOString(), to: to.toISOString(), days, resultCount: vehicles.length },
  });

  const alternatives = vehicles.length === 0 ? await suggestAlternatives(from, to) : [];
  const qs = new URLSearchParams(searchParams as Record<string, string>);
  const withParam = (k: string, v: string) => {
    const n = new URLSearchParams(qs); n.set(k, v); return `/search?${n.toString()}`;
  };
  const toggle = (k: string, v: string, current: string[]) => {
    const next = current.includes(v) ? current.filter((x) => x !== v) : [...current, v];
    const n = new URLSearchParams(qs);
    next.length ? n.set(k, next.join(",")) : n.delete(k);
    return `/search?${n.toString()}`;
  };

  const filterCount = selectedClasses.length + selectedTransmissions.length;
  const baseHref = `/search?from=${searchParams.from}&fromTime=${searchParams.fromTime ?? "10:00"}&to=${searchParams.to}&toTime=${searchParams.toTime ?? "10:00"}`;

  return (
    <>
      <Header />

      <div className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-3 px-6 py-3 text-[13px]">
          <span className="font-semibold">شعبه تهران</span>
          <span className="text-ink-3">·</span>
          <span>{formatJalali(fromIso(searchParams.from!))} — {formatJalali(fromIso(searchParams.to!))}</span>
          <span className="text-ink-3">·</span>
          <span className="text-ink-2">
            {toFaDigits(searchParams.fromTime ?? "10:00")} تا {toFaDigits(searchParams.toTime ?? "10:00")}
          </span>
          <Link href="/" className="link mr-auto">تغییر جست‌وجو</Link>
        </div>
      </div>

      <main className="mx-auto grid max-w-[1200px] gap-6 px-6 py-6 md:grid-cols-[240px_1fr]">
        <aside>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-bold">
              فیلترها {filterCount > 0 && <span className="text-ink-3">({toFaDigits(filterCount)})</span>}
            </h2>
            {filterCount > 0 && <Link href={baseHref} className="link text-[12px]">پاک کردن</Link>}
          </div>

          <div className="card p-4">
            <div className="mb-2.5 text-[13px] font-semibold">کلاس خودرو</div>
            <div className="flex flex-col gap-2">
              {Object.entries(VEHICLE_CLASS_FA).map(([key, fa]) => {
                const on = selectedClasses.includes(key);
                return (
                  <Link key={key} href={toggle("class", key, selectedClasses)}
                    className={`flex items-center justify-between rounded border px-3 py-2 text-[13px] transition ${on ? "border-accent font-semibold" : "border-line hover:border-ink-3"}`}>
                    <span>{fa}</span>
                    <span className="text-[11px] text-ink-3">{toFaDigits(countModels("vehicleClass", key))}</span>
                  </Link>
                );
              })}
            </div>

            <div className="my-4 h-px bg-line-2" />

            <div className="mb-2.5 text-[13px] font-semibold">گیربکس</div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(TRANSMISSION_FA).map(([key, fa]) => {
                const on = selectedTransmissions.includes(key);
                return (
                  <Link key={key} href={toggle("gearbox", key, selectedTransmissions)} className={`chip ${on ? "chip-on" : ""}`}>
                    {fa} <span className="text-[11px] text-ink-3">{toFaDigits(countModels("transmission", key))}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </aside>

        <section>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div>
              <strong>{toFaDigits(grouped.length)} خودرو</strong>{" "}
              <span className="text-ink-3">برای {toFaDigits(days)} روز موجود است</span>
            </div>
            <div className="mr-auto flex items-center gap-2">
              <span className="text-[12px] text-ink-3">مرتب‌سازی</span>
              <Link href={withParam("sort", "price_asc")} className={`chip ${sort === "price_asc" ? "chip-on" : ""}`}>ارزان‌ترین</Link>
              <Link href={withParam("sort", "price_desc")} className={`chip ${sort === "price_desc" ? "chip-on" : ""}`}>گران‌ترین</Link>
            </div>
          </div>

          {grouped.length === 0 ? (
            <div className="card py-14 text-center">
              <h3 className="text-lg font-bold">در این بازه خودرویی آزاد نیست</h3>
              <p className="mb-5 mt-2 text-ink-3">یکی از این تاریخ‌ها را امتحان کنید:</p>
              <div className="flex flex-wrap justify-center gap-2.5">
                {alternatives.map((alt) => (
                  <Link
                    key={alt.from.toISOString()}
                    href={`/search?from=${alt.from.toISOString().slice(0, 10)}&fromTime=${searchParams.fromTime ?? "10:00"}&to=${alt.to.toISOString().slice(0, 10)}&toTime=${searchParams.toTime ?? "10:00"}`}
                    className="btn"
                  >
                    {formatJalali(alt.from)} تا {formatJalali(alt.to)} · {toFaDigits(alt.count)} خودرو
                  </Link>
                ))}
              </div>
              <Link href="/" className="btn btn-primary mt-6 inline-flex">تغییر تاریخ جست‌وجو</Link>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {grouped.map(({ rep, count }) => {
                const q = quote(rep.dailyRate, days, settings.tax_rate_percent);
                return (
                  <VehicleCard
                    key={`${rep.brand}-${rep.model}`}
                    vehicle={rep}
                    days={days}
                    total={q.totalAmount}
                    availableCount={count}
                    href={`/vehicles/${rep.id}?from=${searchParams.from}&fromTime=${searchParams.fromTime ?? "10:00"}&to=${searchParams.to}&toTime=${searchParams.toTime ?? "10:00"}`}
                  />
                );
              })}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </>
  );
}