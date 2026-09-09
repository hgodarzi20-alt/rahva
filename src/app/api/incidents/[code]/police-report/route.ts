import { NextResponse } from "next/server";
import { writeFile, mkdir, unlink } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

/**
 * آپلود تصویر کروکی یا گزارش انتظامی — استوری ۴.۲.
 * دو حالت آن را صدا می‌زند: هنگام تکمیل مستندات، و بعداً از صفحه پرونده
 * وقتی کاربر نسخه کروکی را از راهور گرفته است.
 */
export async function POST(req: Request, { params }: { params: { code: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "ابتدا وارد شوید." }, { status: 401 });

  const incident = await prisma.incidentCase.findUnique({
    where: { trackingCode: params.code.toUpperCase() },
  });
  if (!incident || incident.userId !== session.userId) {
    return NextResponse.json({ error: "پرونده پیدا نشد." }, { status: 404 });
  }
  if (incident.status === "reported_injury") {
    return NextResponse.json({ error: "این پرونده به‌صورت تلفنی پیگیری می‌شود." }, { status: 409 });
  }
  // پس از صدور صورت‌حساب، سند پرونده بسته است
  if (["estimate_issued", "accepted", "disputed", "resolved", "settled", "closed"].includes(incident.status)) {
    return NextResponse.json({ error: "پرونده در مرحله‌ای است که سند جدید پذیرفته نمی‌شود." }, { status: 409 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "فایلی ارسال نشد." }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: "فقط تصویر یا فایل PDF پذیرفته می‌شود." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "حجم فایل باید کمتر از ۸ مگابایت باشد." }, { status: 400 });
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext =
    file.type === "application/pdf" ? "pdf"
    : file.type === "image/png" ? "png"
    : file.type === "image/webp" ? "webp"
    : "jpg";
  const key = `${randomBytes(16).toString("hex")}.${ext}`;
  await writeFile(path.join(UPLOAD_DIR, key), Buffer.from(await file.arrayBuffer()));

  // فایل قبلی جایگزین می‌شود تا پرونده دو سند متناقض نداشته باشد
  if (incident.policeReportFileKey) {
    await unlink(path.join(UPLOAD_DIR, incident.policeReportFileKey)).catch(() => {});
  }

  await prisma.incidentCase.update({
    where: { id: incident.id },
    data: {
      policeReportFileKey: key,
      // اگر پرونده در انتظار نسخه کروکی بود، با رسیدن فایل تکمیل می‌شود
      ...(incident.policeReportStatus === "pending"
        ? { policeReportStatus: "uploaded", policeReportDeadline: null }
        : {}),
    },
  });

  if (incident.policeReportStatus === "pending") {
    await prisma.incidentEvent.create({
      data: {
        incidentId: incident.id,
        type: "police_report_uploaded",
        fromValue: "pending",
        toValue: "uploaded",
        actorId: session.userId,
      },
    });
  }

  return NextResponse.json({ ok: true, key });
}
