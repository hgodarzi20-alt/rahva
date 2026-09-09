import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";

/**
 * رسیدگی مدیر به اعتراض — استوری ۶.۲.
 *
 * دو تصمیم بیشتر وجود ندارد: رد یا قبول.
 * در حالت قبول، اقلامی که کاربر به آنها اعتراض کرده از صورت‌حساب حذف
 * می‌شوند. مدیر نمی‌تواند مبلغ را دستی تغییر دهد؛ یا قلم می‌ماند یا نمی‌ماند.
 * این هم ساده‌تر است هم در ممیزی قابل دفاع، چون هر حذف به یک قلم مشخص
 * و به همان اقلامی که کاربر نام برده گره خورده است.
 *
 * تصمیم مدیر نهایی است. پرونده به resolved می‌رود و آماده تسویه می‌شود.
 */
export async function POST(req: Request, { params }: { params: { code: string } }) {
  const session = await getSession();
  if (!session || session.role !== "fleet_manager") {
    return NextResponse.json({ error: "دسترسی ندارید." }, { status: 403 });
  }

  const incident = await prisma.incidentCase.findUnique({
    where: { trackingCode: params.code.toUpperCase() },
    include: { invoice: { include: { items: true } }, dispute: true },
  });

  if (!incident || !incident.dispute || !incident.invoice) {
    return NextResponse.json({ error: "پرونده پیدا نشد." }, { status: 404 });
  }
  if (incident.status !== "disputed") {
    return NextResponse.json({ error: "این پرونده در مرحله رسیدگی نیست." }, { status: 409 });
  }
  if (incident.dispute.resolvedAt) {
    return NextResponse.json({ error: "به این اعتراض قبلاً رسیدگی شده است." }, { status: 409 });
  }

  const body = await req.json();
  const action = body.action as "accept" | "reject";
  if (action !== "accept" && action !== "reject") {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }

  const managerNote = String(body.managerNote ?? "").trim();
  if (managerNote.length < 10) {
    return NextResponse.json({ error: "دلیل تصمیم را کامل‌تر بنویسید." }, { status: 400 });
  }

  /**
   * فقط اقلامی حذف می‌شوند که هم کاربر به آنها اعتراض کرده باشد و هم
   * واقعاً در همین صورت‌حساب باشند. اگر مدیر فهرست نداده، همه اقلام
   * مورد اعتراض حذف می‌شوند.
   */
  const invoiceItemIds = new Set(incident.invoice.items.map((i: any) => i.id));
  const disputed = incident.dispute.disputedItems.filter((id: number) => invoiceItemIds.has(id));

  const requested: number[] = Array.isArray(body.removeItemIds)
    ? body.removeItemIds.map(Number).filter(Number.isFinite)
    : disputed;

  const toRemove = action === "accept" ? requested.filter((id) => disputed.includes(id)) : [];

  const now = new Date();

  await prisma.$transaction(async (tx: any) => {
    if (toRemove.length > 0) {
      await tx.invoiceItem.deleteMany({
        where: { id: { in: toRemove }, invoiceId: incident.invoice!.id },
      });
    }

    await tx.dispute.update({
      where: { id: incident.dispute!.id },
      data: { resolvedAt: now, resolvedById: session.userId, managerNote },
    });

    await tx.incidentCase.update({ where: { id: incident.id }, data: { status: "resolved" } });

    await tx.incidentEvent.create({
      data: {
        incidentId: incident.id,
        type: "dispute_resolved",
        fromValue: "disputed",
        toValue: "resolved",
        actorId: session.userId,
        meta: { action, removedItemIds: toRemove, managerNote },
      },
    });
  });

  return NextResponse.json({ ok: true, action, removedCount: toRemove.length });
}
