import Link from "next/link";

/**
 * فوتر نسخه ۲. در نسخه ۱ وجود نداشت.
 * لینک «در صورت تصادف چه کنم؟» عمداً اینجاست: کاربر باید پیش از حادثه
 * فرایند را بداند، نه در لحظه‌ای که کنار جاده ایستاده.
 */
export default function Footer() {
  return (
    <footer className="mt-16 border-t border-line bg-line-2">
      <div className="mx-auto max-w-[1200px] px-6 py-10">
        <div className="grid gap-8 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div>
            <div className="mb-2.5 text-[18px] font-bold">رهوا</div>
            <p className="max-w-[34ch] text-[13px] text-ink-2">
              اجاره خودرو بدون راننده در تهران. تحویل و بازگشت در محل شعبه، با قرارداد رسمی و بیمه بدنه معتبر.
            </p>
            <div className="mt-4 text-[13px]">
              <b>پشتیبانی ۲۴ ساعته</b>
              <br />
              <a href="tel:02191000000" className="link">۰۲۱‑۹۱۰۰۰۰۰۰</a>
            </div>
          </div>

          <FooterCol title="خدمات" links={[
            ["اجاره خودرو", "/"],
            ["ناوگان خودرو", "/"],
          ]} />

          <FooterCol title="راهنما" links={[
            ["راهنمای اجاره", "/guide"],
            ["مدارک لازم", "/guide#documents"],
            ["سوالات متداول", "/faq"],
            ["در صورت تصادف چه کنم؟", "/guide/incident"],
          ]} />

          <FooterCol title="رهوا" links={[
            ["درباره ما", "/about"],
            ["تماس با ما", "/contact"],
            ["قوانین و شرایط", "/terms"],
            ["حریم خصوصی", "/privacy"],
          ]} />
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-line-2 pt-4">
          <span className="text-[11px] text-ink-3">© ۱۴۰۵ رهوا — تمام حقوق محفوظ است.</span>
          <div className="flex gap-2">
            <span className="badge">نماد اعتماد الکترونیکی</span>
            <span className="badge">بیمه بدنه معتبر</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <div className="mb-2.5 font-semibold">{title}</div>
      <div className="flex flex-col gap-2 text-[13px] text-ink-2">
        {links.map(([label, href]) => (
          <Link key={label} href={href} className="transition hover:text-ink">{label}</Link>
        ))}
      </div>
    </div>
  );
}
