import { capacityBarColor, capacityPercent } from "@/lib/format";

export function CapacityBar({
  enrolled,
  capacity,
}: {
  enrolled: number;
  capacity: number;
}) {
  const pct = capacityPercent(enrolled, capacity);
  const full = capacity > 0 && enrolled >= capacity;
  const fillClass = capacityBarColor(pct, full);

  return (
    <div className="min-w-[140px]">
      <div className="flex items-center justify-between text-xs text-[#2d3748]">
        <span>{pct}%</span>
        <span className="tabular-nums">
          {enrolled}/{capacity}
        </span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[#e2e8f0]">
        <div className={`h-full rounded-full transition-all ${fillClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
