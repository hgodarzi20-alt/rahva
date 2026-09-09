import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

/** ویرایش خودرو و تغییر وضعیت — استوری ۵.۲ و ۵.۳ */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== "fleet_manager") {
    return NextResponse.json({ error: "دسترسی ندارید." }, { status: 403 });
  }

  const id = Number(params.id);
  const b = await req.json();
  const vehicle = await prisma.vehicle.findUnique({ where: { id } });
  if (!vehicle) return NextResponse.json({ error: "خودرو پیدا نشد." }, { status: 404 });

  // خروج از دسترس: هشدار صریح اگر رزرو فعال یا آینده دارد (استوری ۵.۳ بند ۳)
  if (b.status === "maintenance" && vehicle.status !== "maintenance") {
    const active = await prisma.booking.count({ where: { vehicleId: id, status: "active" } });
    if (active > 0) {
      return NextResponse.json(
        { error: "این خودرو هم‌اکنون در اجاره است و تا ثبت بازگشت قابل خروج از دسترس نیست." },
        { status: 409 },
      );
    }
    const upcoming = await prisma.booking.count({
      where: { vehicleId: id, status: "confirmed", pickupAt: { gte: new Date() } },
    });
    if (upcoming > 0 && !b.force) {
      return NextResponse.json(
        { needsConfirm: true, upcoming, error: `این خودرو ${upcoming} رزرو آینده دارد. با خروج از دسترس، آن رزروها بدون خودرو می‌مانند.` },
        { status: 409 },
      );
    }
  }

  try {
    const updated = await prisma.vehicle.update({
      where: { id },
      data: {
        ...(b.plate !== undefined && { plate: String(b.plate).trim() }),
        ...(b.brand !== undefined && { brand: b.brand }),
        ...(b.model !== undefined && { model: b.model }),
        ...(b.year !== undefined && { year: Number(b.year) }),
        ...(b.vehicleClass !== undefined && { vehicleClass: b.vehicleClass }),
        ...(b.transmission !== undefined && { transmission: b.transmission }),
        ...(b.fuelType !== undefined && { fuelType: b.fuelType }),
        ...(b.seats !== undefined && { seats: Number(b.seats) }),
        ...(b.dailyRate !== undefined && { dailyRate: Number(b.dailyRate) }),
        ...(b.dailyKmLimit !== undefined && { dailyKmLimit: Number(b.dailyKmLimit) }),
        ...(b.extraKmRate !== undefined && { extraKmRate: Number(b.extraKmRate) }),
        ...(b.status !== undefined && { status: b.status }),
      },
    });
    return NextResponse.json({ ok: true, id: updated.id });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "خودروی دیگری با این پلاک ثبت شده است." }, { status: 409 });
    }
    throw e;
  }
}
