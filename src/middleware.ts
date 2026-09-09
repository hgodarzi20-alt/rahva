import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(
  process.env.SESSION_SECRET ?? "dev-only-secret-change-me-in-production",
);

/** تفکیک دسترسی نقش‌ها — سناریوی ۱۱ پذیرش */
export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const needsOperator = path.startsWith("/staff");
  const needsManager = path.startsWith("/manager");
  if (!needsOperator && !needsManager) return NextResponse.next();

  const token = req.cookies.get("rahva_session")?.value;
  if (!token) return NextResponse.redirect(new URL(`/auth?next=${path}`, req.url));

  try {
    const { payload } = await jwtVerify(token, secret);
    const role = payload.role as string;
    if (needsOperator && role !== "operator") return NextResponse.redirect(new URL("/", req.url));
    if (needsManager && role !== "fleet_manager") return NextResponse.redirect(new URL("/", req.url));
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL(`/auth?next=${path}`, req.url));
  }
}

export const config = { matcher: ["/staff/:path*", "/manager/:path*"] };
