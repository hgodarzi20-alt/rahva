import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

/**
 * ثبت روش بازگرداندن خودرو توسط اپراتور — پس از هماهنگی تلفنی با مستأجر.
 * فقط وقتی معنا دارد که پلیس خودرو را توقیف نکرده باشد.
 */
export async function POST(req: Request, { params }: { params: { code: string } }) {
  const session = await getSession();
  if (!session || session.role !== "operator") {
    return NextResponse.json({ error: "دسترسی ندارید." }, { status: 403 });
  }

  const incident = await prisma.incidentCase.findUnique({
    where: { trackingCode: params.code.toUpperCase() },
  });
  if (!incident) return NextResponse.json({ error: "پرونده پیدا نشد." }, { status: 404 });
  if (incident.policeImpounded) {
    return NextResponse.json({ error: "خودرو در توقیف پلیس است؛ روش بازگرداندن معنا ندارد." }, { status: 409 });
  }

  const body = await req.json();
  const method = body.recoveryMethod;
  if (method !== "user_delivers" && method !== "agent_pickup") {
    return NextResponse.json({ error: "روش بازگرداندن نامعتبر است." }, { status: 400 });
  }

  await prisma.incidentCase.update({
    where: { id: incident.id },
    data: { recoveryMethod: method },
  });

  return NextResponse.json({ ok: true });
}
