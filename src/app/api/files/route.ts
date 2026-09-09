import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  pdf: "application/pdf",
};

/**
 * سرو فایل‌های پرونده با احراز هویت.
 * فایل‌ها عمداً در پوشه public نیستند: هر فایل فقط برای مالک پرونده،
 * اپراتور و مدیر قابل دسترسی است.
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return new NextResponse("unauthorized", { status: 401 });

  const key = new URL(req.url).searchParams.get("key");
  // جلوگیری از عبور از مسیر: کلید فقط نام فایل تصادفی است
  if (!key || !/^[a-f0-9]{32}\.(jpg|png|webp|pdf)$/.test(key)) {
    return new NextResponse("bad request", { status: 400 });
  }

  // فایل یا عکس حادثه است یا سند کروکی همان پرونده
  const photo = await prisma.incidentPhoto.findFirst({
    where: { storageKey: key },
    include: { incident: true },
  });
  const incident = photo
    ? photo.incident
    : await prisma.incidentCase.findFirst({ where: { policeReportFileKey: key } });

  if (!incident) return new NextResponse("not found", { status: 404 });

  const isOwner = incident.userId === session.userId;
  const isStaff = session.role === "operator" || session.role === "fleet_manager";
  if (!isOwner && !isStaff) return new NextResponse("forbidden", { status: 403 });

  const ext = key.split(".").pop() as string;
  const buf = await readFile(path.join(UPLOAD_DIR, key));
  return new NextResponse(buf, {
    headers: {
      "Content-Type": photo?.mimeType ?? MIME[ext] ?? "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
