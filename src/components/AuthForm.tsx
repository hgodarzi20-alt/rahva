"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AuthForm({ next }: { next?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError("");
    const res = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mobile, password }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error ?? "خطایی رخ داد.");
    router.push(data.redirect ?? next ?? "/");
    router.refresh();
  }

  return (
    <div className="w-[400px]">
      <div className="mb-5 flex overflow-hidden rounded border border-line">
        {(["login", "register"] as const).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setError(""); }}
            className={`flex-1 py-2.5 text-[13px] ${mode === m ? "bg-accent font-semibold text-white" : "text-ink-2"}`}
          >
            {m === "login" ? "ورود" : "ثبت‌نام"}
          </button>
        ))}
      </div>

      <h1 className="text-[17px] font-bold">
        {next ? "برای ادامه‌ی رزرو وارد شوید" : "به حساب خود وارد شوید"}
      </h1>
      <p className="mb-5 text-[11px] text-ink-3">
        {next ? "انتخاب شما نگه داشته شده است." : "برای رزرو خودرو نیاز به حساب کاربری دارید."}
      </p>

      <label className="label">شماره موبایل</label>
      <input className="input mono mb-3.5" placeholder="09120000000" value={mobile} onChange={(e) => setMobile(e.target.value)} />

      <label className="label">رمز عبور</label>
      <input type="password" className="input mb-4" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()} />

      {error && <p className="mb-3 text-xs text-danger">{error}</p>}

      <button onClick={submit} disabled={busy} className="btn btn-primary btn-lg">
        {busy ? "لطفا صبر کنید…" : mode === "login" ? "ورود و ادامه" : "ثبت‌نام و ادامه"}
      </button>
    </div>
  );
}
