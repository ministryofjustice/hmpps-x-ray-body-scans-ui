import { expect, test } from '@playwright/test'
import { login, resetStubs } from '../testUtils'
import microFrontendComponents from '../mockApis/microFrontendComponents'
import xrayBodyScansApi from '../mockApis/xrayBodyScansApi'

const prisonerNumber = 'A1234BC'

test.describe('Scan list page', () => {
  test.beforeEach(async () => {
    await microFrontendComponents.stubUnavailable()
    await xrayBodyScansApi.stubGetScanSummary(prisonerNumber)
    await xrayBodyScansApi.stubListScans(prisonerNumber)
  })

  test.afterEach(async () => {
    await resetStubs()
  })

  test('Page shows', async ({ page }) => {
    await login(page, { roles: ['ROLE_DPS_APPLICATION_DEVELOPER'] })

    const response = await page.goto(`/prisoner/${prisonerNumber}/scans`)

    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: 'X-ray body scans', exact: true })).toBeVisible()
  })
})
