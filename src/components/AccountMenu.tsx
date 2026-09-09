"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export default function AccountMenu({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-line bg-white px-4 py-1.5 text-[13px] transition hover:border-ink-3"
      >
        <span className="max-w-[10rem] truncate">{name}</span>
        <span className="text-[10px] text-ink-3">▾</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-60 overflow-hidden rounded-card border border-line bg-white shadow-sh2">
          <Link href="/account/bookings" className="block border-b border-line-2 px-4 py-2.5 text-[13px] hover:bg-line-2">
            رزروهای من
          </Link>
          <Link href="/account/incidents" className="block border-b border-line-2 px-4 py-2.5 text-[13px] hover:bg-line-2">
            پرونده‌های حادثه
          </Link>
          <form action="/api/auth/logout" method="post">
            <button className="block w-full px-4 py-2.5 text-right text-[13px] text-danger hover:bg-line-2">
              خروج از حساب
            </button>
          </form>
        </div>
      )}
    </div>
  );
}