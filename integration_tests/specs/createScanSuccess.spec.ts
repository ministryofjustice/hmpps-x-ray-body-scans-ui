import { expect, test } from '@playwright/test'
import microFrontendComponents from '../mockApis/microFrontendComponents'

import { login, resetStubs } from '../testUtils'

const prisonerNumber = 'A1234BC'

test.describe('Create scan success page', () => {
  test.beforeEach(async () => {
    await microFrontendComponents.stubUnavailable()
  })

  test.afterEach(async () => {
    await resetStubs()
  })

  test('Page shows', async ({ page }) => {
    await login(page)

    const response = await page.goto(`/prisoner/${prisonerNumber}/record-scan/success`)

    expect(response?.status()).toBe(200)
    await expect(page.getByRole('heading', { name: 'Scan recorded for', exact: false })).toBeVisible()
  })
})
