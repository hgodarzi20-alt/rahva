import Image from "next/image";
import Link from "next/link";
import AccountMenu from "./AccountMenu";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function Header() {
  const session = await getSession();
  const user = session
    ? await prisma.user.findUnique({
        where: { id: session.userId },
        select: { fullName: true, mobile: true, role: true },
      })
    : null;

  const name = user?.fullName ?? user?.mobile ?? "";

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-white">
      <div className="mx-auto flex h-[68px] max-w-[1200px] items-center gap-7 px-6">
        <Link href="/" className="flex items-center">
          <Image src="/logo.png" alt="رهوا" width={168} height={72} priority className="h-8 w-auto" />
        </Link>

        <nav className="hidden gap-6 text-[13px] text-ink-2 md:flex">
          <Link href="/" className="transition hover:text-ink">اجاره خودرو</Link>
          <Link href="/guide" className="transition hover:text-ink">راهنمای اجاره</Link>
          <Link href="/terms" className="transition hover:text-ink">قوانین و شرایط</Link>
        </nav>

        <div className="mr-auto flex items-center gap-2.5">
          {user && user.role !== "customer" && (
            <Link href={user.role === "operator" ? "/staff" : "/manager"} className="btn btn-sm">
              {user.role === "operator" ? "پنل اپراتور" : "پنل مدیر"}
            </Link>
          )}
          {user ? <AccountMenu name={name} /> : <Link href="/auth" className="btn btn-sm">ورود</Link>}
        </div>
      </div>
    </header>
  );
}