import Link from "next/link";
import { getSession } from "@/lib/auth";

/** پنل کارکنان تم تیره دارد تا با سایت مشتری اشتباه نشود. */
export default async function StaffHeader({
  panel,
  active,
}: {
  panel: "staff" | "manager";
  active: string;
}) {
  const session = await getSession();
  const links =
    panel === "staff"
      ? [
          { href: "/staff", label: "امروز" },
          { href: "/staff/incidents", label: "پرونده‌های حادثه" },
        ]
            : [
          { href: "/manager", label: "داشبورد" },
          { href: "/manager/disputes", label: "اعتراض‌ها" },
          { href: "/manager/metrics", label: "متریک" },
          { href: "/manager/fleet", label: "ناوگان" },
        ];

  return (
    <header className="flex items-center gap-7 bg-ink px-7 py-3.5">
      <Link href={panel === "staff" ? "/staff" : "/manager"} className="text-[17px] font-bold text-white">
        راهــ<span className="text-brandYellow">وا</span>{" "}
        <span className="text-[11px] font-normal text-ink-3">
          {panel === "staff" ? "پنل اپراتور" : "پنل مدیر"}
        </span>
      </Link>
      <nav className="flex gap-5 text-[13px] text-line">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={active === l.href ? "text-white" : ""}>
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="mr-auto flex items-center gap-3">
        <span className="mono text-[11px] text-ink-3">{session?.mobile}</span>
        <form action="/api/auth/logout" method="post">
          <button className="btn btn-sm">خروج</button>
        </form>
      </div>
    </header>
  );
}
