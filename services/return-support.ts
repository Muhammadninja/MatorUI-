/**
 * Returns: the 10-day window for products in proper condition, and the support
 * message that carries the order's context. Pure — the return policy screen and
 * tests share it.
 *
 * Nothing here creates a return request: the backend stores none. The buyer is
 * sent to a human support channel with the order already identified, and
 * support registers the request outside the app (Refund & Returns Policy §6).
 */

/**
 * Refund & Returns Policy §3: requests for products in proper condition are
 * accepted within ten calendar days from the day the buyer receives them. It
 * only drives what the screen SAYS. It never hides the support channel: defect
 * claims run on warranty and statutory periods and stay open afterwards (§4).
 */
export const RETURN_WINDOW_DAYS = 10;

/**
 * Days are Tashkent days, whatever zone the phone is set to: Uzbekistan is
 * UTC+5 all year (no daylight saving since 1992), so a fixed offset is exact
 * and needs no time-zone database (which Hermes may lack).
 */
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;

/** A calendar day; `month` is 0-based, as in Date. */
export type CalendarDay = { year: number; month: number; day: number };

/** The Tashkent calendar day an instant falls on. */
export function tashkentDay(ms: number): CalendarDay {
  const d = new Date(ms + TASHKENT_OFFSET_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate() };
}

function addDays(day: CalendarDay, days: number): CalendarDay {
  const d = new Date(Date.UTC(day.year, day.month, day.day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth(), day: d.getUTCDate() };
}

/** The instant a Tashkent day ends (the next day's 00:00 in Tashkent). */
function endOfTashkentDay(day: CalendarDay): number {
  return Date.UTC(day.year, day.month, day.day + 1) - TASHKENT_OFFSET_MS;
}

/**
 * A day as a local-midnight Date, for formatting with the device's locale: the
 * formatted date is `day` in any device zone.
 */
export function calendarDayAsLocalDate(day: CalendarDay): Date {
  return new Date(day.year, day.month, day.day);
}

export type ReturnWindow = {
  /** Tashkent day the order was handed over. */
  receivedDay: CalendarDay;
  /** Last day (Tashkent, inclusive) of the proper-condition return window. */
  lastDay: CalendarDay;
  /** `now` is before the end of the last day in Tashkent. */
  open: boolean;
};

/**
 * The proper-condition return window for an order delivered at `deliveredAtIso`,
 * or null when the backend has not said when it was delivered. Days are counted
 * from the day after receipt, so a part received on the 12th can be returned
 * until the end of the 22nd, Tashkent time.
 */
export function returnWindow(
  deliveredAtIso: string | null | undefined,
  now: Date = new Date(),
): ReturnWindow | null {
  if (!deliveredAtIso) return null;
  const received = Date.parse(deliveredAtIso);
  if (Number.isNaN(received)) return null;
  const receivedDay = tashkentDay(received);
  const lastDay = addDays(receivedDay, RETURN_WINDOW_DAYS);
  return { receivedDay, lastDay, open: now.getTime() < endOfTashkentDay(lastDay) };
}

export type ReturnContext = {
  orderId: string;
  /** Short display form, e.g. "#A1B2C3". */
  orderNo: string;
  productId?: string | null;
  productName?: string | null;
};

/** Localized pieces of the message; the caller passes `t(...)` results in. */
export type ReturnMessageCopy = {
  /** Greeting + order lines, already interpolated. */
  head: string;
  /** Product lines, already interpolated; omitted when no product is chosen. */
  product?: string;
};

/** The text pre-filled into Telegram and the e-mail body. */
export function returnSupportMessage(copy: ReturnMessageCopy): string {
  return copy.product ? `${copy.head}\n${copy.product}` : copy.head;
}

/** A chat with `username`, with `text` in the input field (t.me `text` parameter). */
export function telegramUrl(username: string, text?: string): string {
  const base = `https://t.me/${encodeURIComponent(username)}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export function mailtoUrl(email: string, subject: string, body: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
