/**
 * نشانگر مرحله فلوی رزرو — چهار گام، در هر چهار صفحه یکسان.
 * صفحه نتایج جستجو و صفحه تأیید نهایی بیرون از این جریان‌اند:
 * اولی هنوز انتخابی نشده، دومی بعد از پایان فرایند است.
 */
const STEPS = ["انتخاب خودرو", "اطلاعات راننده", "بازبینی", "پرداخت"];

export default function Stepper({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <nav className="mb-6 flex items-center gap-2" aria-label="مراحل رزرو">
      {STEPS.map((label, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        return (
          <div key={label} className="flex flex-1 items-center gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${
                  done
                    ? "bg-accent-dark text-white"
                    : active
                      ? "border-2 border-accent text-ink"
                      : "border border-line text-ink-3"
                }`}
              >
                {done ? "✓" : toFa(step)}
              </span>
              <span className={`truncate text-[13px] ${active ? "font-semibold" : "text-ink-3"}`}>
                {label}
              </span>
            </div>
            {step < STEPS.length && (
              <span className={`hidden h-px flex-1 sm:block ${done ? "bg-accent-dark" : "bg-line"}`} />
            )}
          </div>
        );
      })}
    </nav>
  );
}

const toFa = (n: number) => "۰۱۲۳۴۵۶۷۸۹"[n]!;