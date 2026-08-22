import { formatDisplayDate, formatIsoDate } from './dates'

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

// describe('today', () => {
//   it.each([
//     { now: '', expected: '' },
//     { now: '', expected: '' },
//     { now: '', expected: '' },
//     { now: '', expected: '' },
//   ])('should ', ({ now, expected }) => {
//     jest.setSystemTime(new Date(now))
//     expect(today()).toEqual(new Date(expected))
//   })
// })
//
// describe('yesterday', () => {
//   it.each([
//     { now: '', expected: '' },
//     { now: '', expected: '' },
//     { now: '', expected: '' },
//     { now: '', expected: '' },
//   ])('should ', ({ now, expected }) => {
//     jest.setSystemTime(new Date(now))
//     expect(yesterday()).toEqual(new Date(expected))
//   })
// })
