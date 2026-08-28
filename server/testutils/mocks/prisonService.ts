import { mockPrisons } from './prisonRegister'

const mockPrisonNames = new Map(mockPrisons.map(({ prisonId, prisonName }) => [prisonId, prisonName]))

// eslint-disable-next-line import/prefer-default-export
export function mockPrisonNamesImpl(prisonIds: string[]): Promise<Map<string, string>> {
  return Promise.resolve(new Map(prisonIds.map(prisonId => [prisonId, mockPrisonNames.get(prisonId) ?? prisonId])))
}
