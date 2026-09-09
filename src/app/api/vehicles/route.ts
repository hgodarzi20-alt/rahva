import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

/** افزودن خودرو — استوری ۵.۱ */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "fleet_manager") {
    return NextResponse.json({ error: "دسترسی ندارید." }, { status: 403 });
  }

  const b = await req.json();
  const required = ["plate", "brand", "model", "year", "vehicleClass", "transmission", "fuelType", "seats", "dailyRate", "dailyKmLimit", "extraKmRate", "marketValue"];
  for (const f of required) {
    if (b[f] === undefined || b[f] === null || b[f] === "") {
      return NextResponse.json({ error: "همه‌ی فیلدها الزامی است." }, { status: 400 });
    }
  }

  const branch = await prisma.branch.findFirstOrThrow();

  try {
    const vehicle = await prisma.vehicle.create({
      data: {
        plate: String(b.plate).trim(),
        brand: b.brand, model: b.model, year: Number(b.year),
        vehicleClass: b.vehicleClass, transmission: b.transmission, fuelType: b.fuelType,
        seats: Number(b.seats),
        dailyRate: Number(b.dailyRate),
        dailyKmLimit: Number(b.dailyKmLimit),
        extraKmRate: Number(b.extraKmRate),
        branchId: branch.id,
                 marketValue: Math.max(Number(b.marketValue) || 0, 0),
      },
    });
    return NextResponse.json({ ok: true, id: vehicle.id });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "خودرویی با این پلاک قبلا ثبت شده است." }, { status: 409 });
    }
    throw e;
  }
}
