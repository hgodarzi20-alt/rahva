import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createSession, verifyPassword } from "@/lib/auth";

export async function POST(req: Request) {
  const { mobile, password } = await req.json();
  const user = await prisma.user.findUnique({ where: { mobile: mobile ?? "" } });
  if (!user || !(await verifyPassword(password ?? "", user.passwordHash))) {
    return NextResponse.json({ error: "شماره موبایل یا رمز عبور درست نیست." }, { status: 401 });
  }
  await createSession({ userId: user.id, role: user.role, mobile: user.mobile });
  const home = user.role === "operator" ? "/staff" : user.role === "fleet_manager" ? "/manager" : null;
  return NextResponse.json({ ok: true, redirect: home });
}
