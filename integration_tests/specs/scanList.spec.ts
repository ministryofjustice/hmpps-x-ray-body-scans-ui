import { expect, test } from '@playwright/test'
import { mockScanSummaryResponse } from '../../server/testutils/mocks/xrayBodyScansApi'
import { login, resetStubs } from '../testUtils'
import microFrontendComponents from '../mockApis/microFrontendComponents'
import prisonRegisterApi from '../mockApis/prisonRegisterApi'
import prisonerSearchApi from '../mockApis/prisonerSearchApi'
import xrayBodyScansApi from '../mockApis/xrayBodyScansApi'

const prisonerNumber = 'A1234BC'

test.describe('Scan list page', () => {
  test.beforeEach(async () => {
    await Promise.all([
      microFrontendComponents.stubComponents(),
      prisonRegisterApi.stubAllPrisons(),
      prisonerSearchApi.stubGetPrisoner(prisonerNumber),
      xrayBodyScansApi.stubGetScanSummary(
        prisonerNumber,
        mockScanSummaryResponse({ prisonerNumber, now: new Date(), relevantAlerts: [] }),
      ),
      xrayBodyScansApi.stubListScans(prisonerNumber),
    ])
  })

  test.afterEach(async () => {
    await resetStubs()
  })

  test('Page shows', async ({ page }) => {
    await login(page)

    const response = await page.goto(`/prisoner/${prisonerNumber}/scans`)

    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: 'X-ray body scans', exact: true })).toBeVisible()
  })

  test('404 page when prisoner not found', async ({ page }) => {
    await login(page)

    const response = await page.goto('/prisoner/B2222BB/scans')

    expect(response?.status()).toBe(404)
  })
})
