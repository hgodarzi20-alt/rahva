import { NextResponse } from "next/server";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

/** حذف عکس — تا وقتی پرونده هنوز در مرحله مستندسازی است */
export async function DELETE(
  _req: Request,
  { params }: { params: { code: string; photoId: string } },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "ابتدا وارد شوید." }, { status: 401 });

  const photo = await prisma.incidentPhoto.findUnique({
    where: { id: Number(params.photoId) },
    include: { incident: true },
  });
  if (!photo || photo.incident.userId !== session.userId) {
    return NextResponse.json({ error: "عکس پیدا نشد." }, { status: 404 });
  }
  // پس از تکمیل مستندات، عکس‌ها بخشی از سند پرونده‌اند و حذف نمی‌شوند
  if (photo.incident.status !== "reported") {
    return NextResponse.json({ error: "پس از ثبت مستندات، عکس‌ها قابل حذف نیستند." }, { status: 409 });
  }

  await prisma.incidentPhoto.delete({ where: { id: photo.id } });
  await unlink(path.join(process.cwd(), "uploads", photo.storageKey)).catch(() => {});

  return NextResponse.json({ ok: true });
}