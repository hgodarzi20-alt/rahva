import { NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

/** آپلود عکس حادثه — چند فایل در یک درخواست */
export async function POST(req: Request, { params }: { params: { code: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "ابتدا وارد شوید." }, { status: 401 });

  const incident = await prisma.incidentCase.findUnique({
    where: { trackingCode: params.code.toUpperCase() },
  });
  if (!incident || incident.userId !== session.userId) {
    return NextResponse.json({ error: "پرونده پیدا نشد." }, { status: 404 });
  }
  // پس از ثبت مستندات، مجموعه عکس‌ها سند پرونده است و تغییر نمی‌کند
  if (incident.status !== "reported") {
    return NextResponse.json(
      { error: "مستندات این پرونده ثبت شده و عکس جدید پذیرفته نمی‌شود." },
      { status: 409 },
    );
  }

  const form = await req.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (!files.length) return NextResponse.json({ error: "فایلی ارسال نشد." }, { status: 400 });

  const hint = (form.get("hint") as string) || null;

  await mkdir(UPLOAD_DIR, { recursive: true });
  const saved: { id: number; key: string; hint: string | null }[] = [];

  for (const file of files) {
    if (!ALLOWED.includes(file.type)) {
      return NextResponse.json({ error: "فقط تصویر JPG، PNG یا WebP پذیرفته می‌شود." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "حجم هر عکس باید کمتر از ۸ مگابایت باشد." }, { status: 400 });
    }

    // نام تصادفی: نام اصلی فایل هرگز به سیستم فایل راه نمی‌یابد
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const key = `${randomBytes(16).toString("hex")}.${ext}`;
    await writeFile(path.join(UPLOAD_DIR, key), Buffer.from(await file.arrayBuffer()));

    const photo = await prisma.incidentPhoto.create({
      data: {
        incidentId: incident.id,
        storageKey: key,
        mimeType: file.type,
        sizeBytes: file.size,
        hint,
      },
    });
    saved.push({ id: photo.id, key, hint });
  }

  return NextResponse.json({ ok: true, count: saved.length, photos: saved });
}
