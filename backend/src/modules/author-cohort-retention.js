import { StatisticsEvent } from '../models/index.js';

// First observed view in the selected story/chapter scope, including history before the report.
export async function authorCohortRetention(scope, startDay, today) {
  const offsets = [1, 7];
  const facets = Object.fromEntries(
    offsets.map((day) => {
      // Only completed Vietnam calendar days are eligible, never today's partial observations.
      const cutoff = new Date(Date.parse(`${today}T00:00:00Z`) - (day + 1) * 86400000)
        .toISOString()
        .slice(0, 10);
      const returnDay = {
        $dateToString: {
          format: '%Y-%m-%d',
          timezone: 'UTC',
          date: {
            $dateAdd: {
              startDate: {
                $dateFromString: { dateString: '$firstDay', format: '%Y-%m-%d', timezone: 'UTC' },
              },
              unit: 'day',
              amount: day,
            },
          },
        },
      };
      return [
        `day${day}`,
        [
          { $match: { firstDay: { $gte: startDay, $lte: cutoff } } },
          {
            $group: {
              _id: null,
              eligible: { $sum: 1 },
              returned: { $sum: { $cond: [{ $in: [returnDay, '$days'] }, 1, 0] } },
            },
          },
        ],
      ];
    }),
  );
  const [result] = await StatisticsEvent.aggregate([
    { $match: { ...scope, day: { $lte: today } } },
    {
      $group: {
        _id: { type: '$viewerType', key: '$viewerKey' },
        firstDay: { $min: '$day' },
        days: { $addToSet: { $cond: [{ $gte: ['$day', startDay] }, '$day', null] } },
      },
    },
    { $facet: facets },
  ]);
  return offsets.map((day) => {
    const counts = result?.[`day${day}`]?.[0];
    const eligible = counts?.eligible ?? 0;
    const returned = counts?.returned ?? 0;
    return { day, eligible, returned, rate: eligible ? (returned / eligible) * 100 : null };
  });
}
