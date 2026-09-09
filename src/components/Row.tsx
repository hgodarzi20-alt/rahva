/**
 * ردیف برچسب و مقدار با خط راهنما بین‌شان — الگوی فهرست مطالب.
 * به‌جای خط جداکننده زیر هر ردیف استفاده می‌شود: چشم را از برچسب
 * به مقدار هدایت می‌کند بدون اینکه صفحه را با خطوط افقی پر کند.
 */
export function Row({
  label,
  children,
  strong = true,
}: {
  label: string;
  children: React.ReactNode;
  /** مقدار با وزن بیشتر نمایش داده شود */
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2 py-2 text-[13px]">
      <span className="shrink-0 text-ink-2">{label}</span>
      <span className="mt-1 h-px min-w-6 flex-1 border-b border-dotted border-line" />
      <span className={`shrink-0 text-left ${strong ? "font-semibold" : ""}`}>{children}</span>
    </div>
  );
}

/** کارت با عنوان — بخش‌بندی صفحات */
export function Section({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card p-5 ${className}`}>
      {title && <h2 className="mb-3 text-[15px] font-bold">{title}</h2>}
      {children}
    </section>
  );
}