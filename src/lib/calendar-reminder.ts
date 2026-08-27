import { analytics } from '@/lib/analytics';

/**
 * "Add a reminder" is a Google Calendar link, and calling it anything else
 * would repeat the error GH#108 recorded.
 *
 * It writes no `.ics` file: it builds a calendar.google.com/render URL and
 * opens it. So it helps a reader with an active Google session, does nothing
 * for Apple or Outlook, and needs an unblocked popup. The copy around it must
 * not promise more than that.
 *
 * @param title  Event title (`wizard:calendar.title`)
 * @param details Event body (`wizard:calendar.details`)
 */
export function openCalendarReminder(title: string, details: string): void {
  const startDate = new Date();
  startDate.setHours(startDate.getHours() + 1);
  const endDate = new Date(startDate);
  endDate.setMinutes(endDate.getMinutes() + 30);

  const stamp = (date: Date) => `${date.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;

  const calendarUrl =
    `https://calendar.google.com/calendar/render?action=TEMPLATE` +
    `&text=${encodeURIComponent(title)}` +
    `&dates=${stamp(startDate)}/${stamp(endDate)}` +
    `&details=${encodeURIComponent(details)}`;

  // Before window.open, not after: a popup blocker can cancel the open, but
  // the reader's intent happened either way. This counts intent, and it will
  // never be the denominator of a funnel.
  analytics.calendarReminderClick();
  window.open(calendarUrl, '_blank', 'noopener,noreferrer');
}
