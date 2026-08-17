import { expect, test } from '@playwright/test'
import microFrontendComponents from '../mockApis/microFrontendComponents'
import prisonerSearchApi from '../mockApis/prisonerSearchApi'
import { login, resetStubs } from '../testUtils'
import CreateScanPage from '../pages/createScanPage'

const prisonerNumber = 'A1234BC'

test.describe('Create scan page', () => {
  test.beforeEach(async () => {
    await Promise.all([microFrontendComponents.stubComponents(), prisonerSearchApi.stubGetPrisoner(prisonerNumber)])
  })

  test.afterEach(async () => {
    await resetStubs()
  })

  test('Page shows', async ({ page }) => {
    await login(page)

    const response = await page.goto(`/prisoner/${prisonerNumber}/record-scan`)
    expect(response?.status()).toBe(200)

    const createScanPage = await CreateScanPage.verifyOnPage(page, 'John Smith')
    expect(await createScanPage.getBreadcrumbs()).toEqual([
      { text: 'Digital Prison Services', href: 'http://localhost:9091/dpshomepage' },
      { text: 'Smith, John', href: `http://localhost:9091/profile/prisoner/${prisonerNumber}` },
      { text: 'X-ray body scans', href: `/prisoner/${prisonerNumber}/scans` },
    ])
  })
})
