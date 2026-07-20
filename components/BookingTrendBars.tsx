import React from 'react';

export interface TrendPoint {
  date: string;
  count: number;
}

/** Lightweight CSS bar sparkline — no chart library. */
const BookingTrendBars: React.FC<{
  points: TrendPoint[];
  label?: string;
}> = ({ points, label = 'Bookings (last 14 days)' }) => {
  const max = Math.max(1, ...points.map((p) => p.count));
  const total = points.reduce((sum, p) => sum + p.count, 0);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-semibold text-forge-navy">{label}</h3>
        <span className="text-xs text-gray-500">{total} total</span>
      </div>
      {total === 0 ? (
        <p className="text-sm text-gray-500 py-4 text-center">No bookings in this period yet.</p>
      ) : (
        <div className="flex items-end gap-0.5 h-16" role="img" aria-label={label}>
          {points.map((p) => {
            const heightPct = Math.max(p.count > 0 ? 12 : 4, (p.count / max) * 100);
            return (
              <div
                key={p.date}
                className="flex-1 flex flex-col items-center justify-end h-full group"
                title={`${p.date}: ${p.count}`}
              >
                <div
                  className={`w-full max-w-[10px] rounded-t ${
                    p.count > 0 ? 'bg-forge-orange' : 'bg-gray-100'
                  }`}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BookingTrendBars;
