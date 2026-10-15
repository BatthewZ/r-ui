/** Deterministic sample data for the charts sections: no Math.random, so every screenshot matches. */

/** A smooth daily wave with a weekend dip and a slow trend, seeded by `seed`. */
export function wave(points: number, base: number, seed: number, stepHours = 1): number[] {
  return Array.from({ length: points }, (_, i) => {
    const hour = (i * stepHours) % 24;
    const day = Math.floor((i * stepHours) / 24) % 7;
    const daily = 1 + 0.35 * Math.sin(((hour - 8 + seed) / 24) * Math.PI * 2);
    const weekend = day >= 5 ? 0.8 : 1;
    const jitter = 1 + 0.05 * Math.sin(i * 1.7 + seed * 3.1);
    return Math.round(base * daily * weekend * jitter * (0.92 + 0.1 * (i / points)));
  });
}

/** `count` timestamps `stepHours` apart, ending at a fixed "now" (UTC midnight, 15 Oct 2026). */
export function times(count: number, stepHours: number): Date[] {
  const end = Date.UTC(2026, 9, 15);
  return Array.from({ length: count }, (_, i) => new Date(end - (count - 1 - i) * stepHours * 3_600_000));
}

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const HOURS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);

/** 5xx errors by weekday × hour: a business-hours hump and one bad Thursday afternoon. */
export const HEAT: number[][] = WEEKDAYS.map((_, d) =>
  HOURS.map((__, h) => {
    const busy = Math.max(0, Math.sin(((h - 6) / 24) * Math.PI * 2));
    const weekend = d >= 5 ? 0.4 : 1;
    const incident = d === 3 && h >= 14 && h <= 16 ? 5 : 1;
    return Math.round((4 + 38 * busy) * weekend * incident + ((d * 7 + h * 3) % 5));
  }),
);
