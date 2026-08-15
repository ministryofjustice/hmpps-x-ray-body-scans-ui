import { expect, test } from '@playwright/test'
import { login, resetStubs } from '../testUtils'
import microFrontendComponents from '../mockApis/microFrontendComponents'
import prisonerSearchApi from '../mockApis/prisonerSearchApi'
import xrayBodyScansApi from '../mockApis/xrayBodyScansApi'

const prisonerNumber = 'A1234BC'

test.describe('Scan list page', () => {
  test.beforeEach(async () => {
    await microFrontendComponents.stubUnavailable()
    await prisonerSearchApi.stubGetPrisoner(prisonerNumber)
    await xrayBodyScansApi.stubGetScanSummary(prisonerNumber)
    await xrayBodyScansApi.stubListScans(prisonerNumber)
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
