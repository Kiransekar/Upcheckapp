// Local reminder copy (see src/utils/notifications.ts / syncReminders).
//
// Kept as a nudge, never an accusation: the app schedules these from the last
// data it has, and a log made on another device won't silence this phone
// until it syncs — so the copy never claims the farmer skipped anything.
const notifications = {
  wq: {
    morning: {
      title: 'Morning water check',
      body: 'Log DO, pH, salinity and temperature so your feed and risk advice stay accurate.',
    },
    afternoon: {
      title: 'Afternoon water check',
      body: "A quick reading now keeps today's picture up to date.",
    },
    evening: {
      title: 'Evening water check',
      body: "One more reading and today's data loop is complete.",
    },
  },
  chemTitle: 'Weekly chemistry check',
  chemBody: 'Test ammonia, nitrite, nitrate, alkalinity and hardness — it keeps your feed and disease advice sharp.',
};
export default notifications;
