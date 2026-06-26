// Business-timezone helpers. The team operates in one timezone (default US Pacific);
// "today" and date-bucketing are computed against that wall clock, not UTC, so evening
// activity doesn't roll into the next calendar day. Override with BUSINESS_TZ env var.
const TZ = process.env.BUSINESS_TZ || 'America/Los_Angeles';

// Current calendar date (YYYY-MM-DD) in the business timezone, DST-correct.
function businessToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

// Current UTC offset of the business timezone, as a SQLite datetime modifier (e.g. '-480 minutes').
// Computed for "now", so it tracks the active DST rule. Recomputed per process start.
function tzModifier() {
  const now = new Date();
  const dtf = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const p = Object.fromEntries(dtf.formatToParts(now).map(x => [x.type, x.value]));
  const hour = p.hour === '24' ? 0 : parseInt(p.hour, 10);
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, hour, +p.minute, +p.second);
  const offsetMin = Math.round((asUTC - now.getTime()) / 60000);
  return `${offsetMin} minutes`;
}

// SQL fragment: the business-local calendar date of a datetime column/expression.
// e.g. localDate('i.created_at') -> "date(i.created_at, '-480 minutes')"
function localDate(expr) { return `date(${expr}, '${tzModifier()}')`; }

module.exports = { BUSINESS_TZ: TZ, businessToday, tzModifier, localDate };
