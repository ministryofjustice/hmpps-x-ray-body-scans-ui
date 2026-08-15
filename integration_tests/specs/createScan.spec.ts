import { expect, test } from '@playwright/test'
import microFrontendComponents from '../mockApis/microFrontendComponents'
import prisonerSearchApi from '../mockApis/prisonerSearchApi'

import { login, resetStubs } from '../testUtils'

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
    await expect(page.getByRole('heading', { name: 'Record an x-ray body scan for', exact: false })).toBeVisible()
  })
})
