import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";

export async function POST(req: Request) {
  const { mobile, password } = await req.json();
  if (!/^09\d{9}$/.test(mobile ?? "")) {
    return NextResponse.json({ error: "شماره موبایل معتبر نیست." }, { status: 400 });
  }
  if ((password ?? "").length < 6) {
    return NextResponse.json({ error: "رمز عبور باید حداقل ۶ کاراکتر باشد." }, { status: 400 });
  }
  const existing = await prisma.user.findUnique({ where: { mobile } });
  if (existing) {
    return NextResponse.json({ error: "این شماره موبایل قبلا ثبت شده است." }, { status: 409 });
  }
  const user = await prisma.user.create({
    data: { mobile, passwordHash: await hashPassword(password), role: "customer" },
  });
  await createSession({ userId: user.id, role: user.role, mobile: user.mobile });
  return NextResponse.json({ ok: true });
}
