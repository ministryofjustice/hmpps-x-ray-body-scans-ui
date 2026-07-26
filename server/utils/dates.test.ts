import { isoDate } from './dates'

describe('isoDate', () => {
  it.each([undefined, null])('should return undefined for nullish type %j', date => {
    expect(isoDate(date)).toBeUndefined()
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
    expect(isoDate(date)).toEqual(expected)
  })
})
