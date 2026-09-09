/**
 * آیکون‌های مشخصات خودرو — خطی، ضخامت ۱٫۵، رنگ خنثی.
 * الگو از کارت خودروی اکسپدیا: آیکون کنار متن کوتاه،
 * در گرید که در عرض کم به یک ستون می‌افتد.
 */

const base = "h-[22px] w-[22px] shrink-0 stroke-ink fill-none stroke-[1.5] [stroke-linecap:round] [stroke-linejoin:round]";

export const IconSeats = () => (
  <svg className={base} viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6" /></svg>
);

export const IconGearbox = () => (
  <svg className={base} viewBox="0 0 24 24"><path d="M7 7v10M17 7v10M7 12h10" /><circle cx="7" cy="5" r="1.6" /><circle cx="17" cy="5" r="1.6" /><circle cx="17" cy="19" r="1.6" /></svg>
);

export const IconFuel = () => (
  <svg className={base} viewBox="0 0 24 24"><path d="M4 20V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v14M3 20h13M6 10h6" /><path d="M17 9l2 2v7a1.5 1.5 0 0 0 3 0v-9l-3-3" /></svg>
);

export const IconMileage = () => (
  <svg className={base} viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" /><path d="M12 12l4-3" /></svg>
);

export const IconDoors = () => (
  <svg className={base} viewBox="0 0 24 24"><path d="M4 17V9l6-4h8a2 2 0 0 1 2 2v10z" /><path d="M4 13h9" /><circle cx="9" cy="15" r="1" /></svg>
);

export const IconPin = () => (
  <svg className={base} viewBox="0 0 24 24"><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>
);

export const IconShield = () => (
  <svg className={base} viewBox="0 0 24 24"><path d="M12 3l7 3v6c0 4.4-3 7.9-7 9-4-1.1-7-4.6-7-9V6z" /><path d="M9 12l2 2 4-4" /></svg>
);

/** یک قلم مشخصات: آیکون + متن، بدون شکستن روی آیکون */
export function Spec({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 text-[13px]">
      {icon}
      <span className="truncate">{children}</span>
    </div>
  );
}

/** گرید مشخصات — در عرض کم خودش به یک ستون می‌افتد */
export function SpecGrid({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))] ${className}`}>
      {children}
    </div>
  );
}