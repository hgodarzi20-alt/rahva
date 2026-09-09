import { NextResponse } from "next/server";
import { BookingStatus, VehicleStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { logEvent } from "@/lib/events";

/** ثبت تحویل خودرو — استوری ۴.۲ نسخه ۱، و اپیک ۰ و ۱ نسخه ۲ */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || session.role !== "operator") {
    return NextResponse.json({ error: "دسترسی ندارید." }, { status: 403 });
  }

  const body = await req.json();
  const booking = await prisma.booking.findUnique({ where: { id: Number(params.id) } });
  if (!booking) return NextResponse.json({ error: "رزرو پیدا نشد." }, { status: 404 });

  if (booking.status !== BookingStatus.confirmed) {
    return NextResponse.json({ error: "فقط رزرو تأییدشده قابل تحویل است." }, { status: 409 });
  }
  if (!body.licenseChecked || !body.idChecked || !body.contractSigned) {
    return NextResponse.json({ error: "چک‌لیست کنترل مدارک باید کامل شود." }, { status: 400 });
  }
  const odometer = Number(body.checkoutOdometer);
  if (!Number.isFinite(odometer) || odometer < 0) {
    return NextResponse.json({ error: "کیلومتر اولیه معتبر نیست." }, { status: 400 });
  }

  // V2 — ودیعه باید وصول شده باشد، وگرنه پرونده خسارت پشتوانه مالی ندارد
  if (booking.depositAmountSnapshot && !body.depositCollected) {
    return NextResponse.json({ error: "ودیعه باید دریافت شود." }, { status: 400 });
  }

  const damages: { title: string; location?: string }[] = Array.isArray(body.damages) ? body.damages : [];

  await prisma.$transaction(async (tx) => {
    const rental = await tx.rental.create({
      data: {
        bookingId: booking.id,
        checkoutAt: new Date(),
        checkoutOdometer: odometer,
        checkoutFuel: body.checkoutFuel ?? "1/1",
        checkoutNotes: body.checkoutNotes ?? null,
        checkoutById: session.userId,
        licenseChecked: true,
        idChecked: true,
        contractSigned: true,
      },
    });

    // اقلام خسارت موجود — مبنای مقایسه در پایان سفر یا پس از حادثه
    if (damages.length) {
      await tx.damageItem.createMany({
        data: damages
          .filter((d) => d.title?.trim())
          .map((d) => ({
            rentalId: rental.id,
            phase: "checkout" as const,
            title: d.title.trim(),
            location: (d.location ?? "").trim(),
          })),
      });
    }

    // ودیعه
    if (booking.depositAmountSnapshot) {
      await tx.deposit.create({
        data: {
          bookingId: booking.id,
          amount: booking.depositAmountSnapshot,
          status: "held",
          collectedAt: new Date(),
        },
      });
    }

    await tx.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.active },
    });
  });

  await logEvent("car_picked_up", { userId: session.userId, bookingId: booking.id, vehicleId: booking.vehicleId });
  return NextResponse.json({ ok: true });
}