import { fixedClock, now, today, yesterday } from '../testutils/fixedClock'
import {
  formatDisplayDate,
  formatDisplayDateTime,
  formatIsoDate,
  formatDisplayShortDate,
  withinLast31Days,
} from './dates'

beforeAll(() => {
  fixedClock()
})

describe('formatIsoDate', () => {
  it.each([undefined, null])('should return undefined for nullish type %j', date => {
    expect(formatIsoDate(date)).toBeUndefined()
  })

  it.each([
    // UTC+0
    [new Date(2026, 0, 1, 12), '2026-01-01'],
    // UTC+1
    [new Date(2026, 6, 31, 12), '2026-07-31'],
    [new Date('2026-07-31T00:00:00+01:00'), '2026-07-31'],
    // near DST switch
    [new Date('2021-10-30T23:59:59Z'), '2021-10-31'],
    [new Date('2021-10-31T00:00:00Z'), '2021-10-31'],
    [new Date('2021-10-31T00:00:01Z'), '2021-10-31'],
    [new Date('2021-10-31T00:59:59Z'), '2021-10-31'],
    [new Date('2021-10-31T01:00:00Z'), '2021-10-31'],
    [new Date('2021-10-31T01:00:01Z'), '2021-10-31'],
  ])('should format %s to %s', (date, expected) => {
    expect(formatIsoDate(date)).toEqual(expected)
  })
})

describe('formatDisplayShortDate', () => {
  it.each([
    // UTC+0
    [new Date(2026, 0, 1, 12), '01/01/2026'],
    // UTC+1
    [new Date(2026, 6, 31, 12), '31/07/2026'],
    [new Date('2026-07-31T00:00:00+01:00'), '31/07/2026'],
    // near DST switch
    [new Date('2021-10-30T23:59:59Z'), '31/10/2021'],
    [new Date('2021-10-31T00:00:00Z'), '31/10/2021'],
    [new Date('2021-10-31T00:00:01Z'), '31/10/2021'],
    [new Date('2021-10-31T00:59:59Z'), '31/10/2021'],
    [new Date('2021-10-31T01:00:00Z'), '31/10/2021'],
    [new Date('2021-10-31T01:00:01Z'), '31/10/2021'],
  ])('should format %s to %s', (date, expected) => {
    expect(formatDisplayShortDate(date)).toEqual(expected)
  })
})

describe('formatDisplayDate', () => {
  it.each([
    // UTC+0
    [new Date(2026, 0, 1, 12), '1 January 2026'],
    // UTC+1
    [new Date(2026, 6, 31, 12), '31 July 2026'],
    [new Date('2026-07-31T00:00:00+01:00'), '31 July 2026'],
    // near DST switch
    [new Date('2021-10-30T23:59:59Z'), '31 October 2021'],
    [new Date('2021-10-31T00:00:00Z'), '31 October 2021'],
    [new Date('2021-10-31T00:00:01Z'), '31 October 2021'],
    [new Date('2021-10-31T00:59:59Z'), '31 October 2021'],
    [new Date('2021-10-31T01:00:00Z'), '31 October 2021'],
    [new Date('2021-10-31T01:00:01Z'), '31 October 2021'],
  ])('should format %s to %s', (date, expected) => {
    expect(formatDisplayDate(date)).toEqual(expected)
  })
})

describe('formatDisplayDateTime', () => {
  it.each([
    // UTC+0
    [new Date('2026-01-01T12:00:00Z'), '1 January 2026 at 12:00'],
    // UTC+1
    [new Date('2026-07-31T12:00:00+01:00'), '31 July 2026 at 12:00'],
    [new Date('2026-07-31T00:00:00+01:00'), '31 July 2026 at 00:00'],
    // near DST switch
    [new Date('2021-10-30T23:59:59Z'), '31 October 2021 at 00:59'],
    [new Date('2021-10-31T00:00:00Z'), '31 October 2021 at 01:00'],
    [new Date('2021-10-31T00:00:01Z'), '31 October 2021 at 01:00'],
    [new Date('2021-10-31T00:59:59Z'), '31 October 2021 at 01:59'],
    [new Date('2021-10-31T01:00:00Z'), '31 October 2021 at 01:00'],
    [new Date('2021-10-31T01:00:01Z'), '31 October 2021 at 01:00'],
  ])('should format %s to %s', (date, expected) => {
    expect(formatDisplayDateTime(date)).toEqual(expected)
  })
})

describe(`withinLast31Days when today is ${formatDisplayDate(today)}`, () => {
  it.each([
    new Date(),
    now,
    today,
    yesterday,
    new Date('2026-06-23T12:07:41+01:00'),
    new Date('2026-06-23T23:59:59+01:00'),
    new Date('2026-06-23T00:00:00+01:00'),
  ])('should return true for %s', date => {
    expect(withinLast31Days(date)).toBe(true)
  })

  it.each([
    new Date('2026-01-01T12:00:00+00:00'),
    new Date('2026-06-22T12:07:41+01:00'),
    new Date('2026-06-22T23:59:59+01:00'),
    new Date('2026-06-22T00:00:00+01:00'),
  ])('should return false for %s', date => {
    expect(withinLast31Days(date)).toBe(false)
  })
})
