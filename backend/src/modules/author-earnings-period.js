// Calendar windows use Vietnam time, shared by earnings charts and ledger history.
export function authorEarningsPeriod(period, now) {
  const shifted = new Date(now.getTime() + 7 * 3600000);
  const today = shifted.toISOString().slice(0, 10);
  const dayStart = Date.parse(`${today}T00:00:00Z`);
  const startDay =
    period === 'day'
      ? dayStart
      : period === 'week'
        ? dayStart - ((shifted.getUTCDay() + 6) % 7) * 86400000
        : Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1);
  return {
    start: new Date(startDay - 7 * 3600000),
    labels: Array.from({ length: Math.round((dayStart - startDay) / 86400000) + 1 }, (_, index) =>
      new Date(startDay + index * 86400000).toISOString().slice(0, 10),
    ),
  };
}
