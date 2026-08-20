import { expect, test } from '@playwright/test'
import { login, resetStubs } from '../testUtils'
import microFrontendComponents from '../mockApis/microFrontendComponents'
import prisonerSearchApi from '../mockApis/prisonerSearchApi'
import CreateScanSuccessPage from '../pages/createScanSuccessPage'

const prisonerNumber = 'A1234BC'

test.describe('Create scan success page', () => {
  test.beforeEach(async () => {
    await Promise.all([microFrontendComponents.stubComponents(), prisonerSearchApi.stubGetPrisoner(prisonerNumber)])
  })

  test.afterEach(async () => {
    await resetStubs()
  })

  test('Page shows', async ({ page }) => {
    await login(page)

    const response = await page.goto(`/prisoner/${prisonerNumber}/record-scan/success`)
    expect(response?.status()).toBe(200)

    await CreateScanSuccessPage.verifyOnPage(page)
  })
})
