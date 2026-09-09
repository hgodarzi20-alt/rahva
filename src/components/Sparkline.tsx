export default function Sparkline({ data }: { data: number[] }) {
  if (!data.length) return <p className="text-[11px] text-ink-3">داده‌ای نیست.</p>;

  const max = Math.max(...data, 1);
  const w = 100;
  const h = 30;
  const points = data
    .map((v, i) => `${(i / (data.length - 1 || 1)) * w},${h - (v / max) * h}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-24 w-full">
      <polyline points={points} fill="none" stroke="#424BED" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
