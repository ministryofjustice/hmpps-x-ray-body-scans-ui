const shortDateFormatter = new Intl.DateTimeFormat('en-GB', {
  // NB: 'numeric' for day or month always produces leading zeroes so might as well make it explicit
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'Europe/London',
})

/**
 * Formats dates (ignoring time) in Europe/London ISO style, used when calling APIs.
 * NB: time zone is _not_ appended.
 *
 * Example: `2024-07-30`
 */
export function isoDate(dateTime: Date): string
export function isoDate(dateTime: null | undefined): undefined
export function isoDate(dateTime: Date | null | undefined): string | undefined
export function isoDate(dateTime: Date | null | undefined): string | undefined {
  if (!dateTime) {
    return undefined
  }
  // NB: cannot simply `dateTime.toISOString().split('T')[0]` because that returns the UTC date
  const { day, month, year } = Object.fromEntries(
    shortDateFormatter.formatToParts(dateTime).map(part => [part.type, part.value]),
  ) as Record<'day' | 'month' | 'year', string>
  return `${year}-${month}-${day}`
}
