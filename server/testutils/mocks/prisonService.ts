// eslint-disable-next-line import/prefer-default-export
export function mockPrisonNamesImpl(prisonIds: string[]): Promise<Map<string, string>> {
  return Promise.resolve(new Map(prisonIds.map(prisonId => [prisonId, prisonId])))
}
