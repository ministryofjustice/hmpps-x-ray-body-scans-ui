// TODO: move to Temporal.PlainDate once on node26?

const shortDateFormatter = new Intl.DateTimeFormat('en-GB', {
  // NB: 'numeric' for day or month always produces leading zeroes so might as well make it explicit
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'Europe/London',
})

const longDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/London',
})

/**
 * Formats dates (ignoring time) in Europe/London ISO style, used when calling APIs.
 * NB: time zone is _not_ appended.
 *
 * Example: `2024-07-30`
 */
export function formatIsoDate(dateTime: Date): string
export function formatIsoDate(dateTime: null | undefined): undefined
export function formatIsoDate(dateTime: Date | null | undefined): string | undefined
export function formatIsoDate(dateTime: Date | null | undefined): string | undefined {
  if (!dateTime) {
    return undefined
  }
  // NB: cannot simply `dateTime.toISOString().split('T')[0]` because that returns the UTC date
  const { day, month, year } = Object.fromEntries(
    shortDateFormatter.formatToParts(dateTime).map(part => [part.type, part.value]),
  ) as Record<'day' | 'month' | 'year', string>
  return `${year}-${month}-${day}`
}

/**
 * Formats dates (ignoring time) in Europe/London for display to users.
 *
 * Example: `01 January 2026`
 */
export function formatDisplayDate(dateTime: Date): string {
  return longDateFormatter.format(dateTime)
}

// /** Today at midday (could be in the future); midday to avoid clock changes/DST when formatting */
// export function today(): Date {
//   const date = new Date()
//   date.setHours(12, 0, 0, 0)
//   return date
// }
//
// /** Yesterday at midday; midday to avoid clock changes/DST when formatting */
// export function yesterday(): Date {
//   const date = new Date()
//   date.setDate(date.getDate() - 1)
//   date.setHours(12, 0, 0, 0)
//   return date
// }
