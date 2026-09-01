import { type Page, expect, test } from '@playwright/test'
import { mockScanResponse } from '../../server/testutils/mocks/xrayBodyScansApi'
import { login, resetStubs } from '../testUtils'
import microFrontendComponents from '../mockApis/microFrontendComponents'
import prisonerSearchApi from '../mockApis/prisonerSearchApi'
import xrayBodyScansApi from '../mockApis/xrayBodyScansApi'
import { stubFor } from '../mockApis/wiremock'
import AddScanCaseNotePage from '../pages/addScanCaseNotePage'

const prisonerNumber = 'A1234BC'
const scanId = '019f94a7-17cd-746f-b1df-5d4848da42e1'
const now = new Date()

const scan = mockScanResponse(prisonerNumber, now)

test.describe('Add scan case note page', () => {
  test.beforeEach(async () => {
    await Promise.all([microFrontendComponents.stubComponents(), prisonerSearchApi.stubGetPrisoner(prisonerNumber)])
  })

  test.afterEach(async () => {
    await resetStubs()
  })

  async function goToAddScanCaseNotePage(page: Page): Promise<AddScanCaseNotePage> {
    await xrayBodyScansApi.stubGetScan(scanId, scan)
    const response = await page.goto(`/prisoner/${prisonerNumber}/scan/${scanId}/add-a-scan-case-note`)
    expect(response?.status()).toBe(200)
    return AddScanCaseNotePage.verifyOnPage(page)
  }

  test('Page shows with expected content', async ({ page }) => {
    await login(page)
    const addScanCaseNotePage = await goToAddScanCaseNotePage(page)

    await expect(addScanCaseNotePage.getBreadcrumbs()).resolves.toEqual([
      { text: 'Digital Prison Services', href: 'http://localhost:9091/dpshomepage' },
      { text: 'Smith, John', href: `http://localhost:9091/profile/prisoner/${prisonerNumber}` },
      { text: 'X-ray body scans', href: `/prisoner/${prisonerNumber}/scan-overview` },
    ])

    await expect(addScanCaseNotePage.cancelLink).toHaveAttribute('href', `/prisoner/${prisonerNumber}/scan-overview`)
  })

  test('Saves case note and redirects to scan overview', async ({ page }) => {
    await login(page)
    const addScanCaseNotePage = await goToAddScanCaseNotePage(page)

    await xrayBodyScansApi.stubGetScan(scanId, scan)
    await xrayBodyScansApi.stubCreateScanCaseNote(scanId)
    await addScanCaseNotePage.saveButton.click()

    await expect(page).toHaveURL(`/prisoner/${prisonerNumber}/scan-overview`)
  })

  test('Saves case note with additional details', async ({ page }) => {
    await login(page)
    const addScanCaseNotePage = await goToAddScanCaseNotePage(page)

    await xrayBodyScansApi.stubGetScan(scanId, scan)
    await xrayBodyScansApi.stubCreateScanCaseNote(scanId)
    await addScanCaseNotePage.additionalDetailsInput.fill('Some extra details')
    await addScanCaseNotePage.saveButton.click()

    await expect(page).toHaveURL(`/prisoner/${prisonerNumber}/scan-overview`)
  })

  test('Shows validation error when additional details exceeds 3500 characters', async ({ page }) => {
    await login(page)
    const addScanCaseNotePage = await goToAddScanCaseNotePage(page)

    await addScanCaseNotePage.additionalDetailsInput.fill('a'.repeat(3501))
    await addScanCaseNotePage.saveButton.click()

    await expect(addScanCaseNotePage.getErrorSummary()).resolves.toEqual([
      { text: 'The additional details must be 3,500 characters or less', href: '#additionalDetails' },
    ])
    await expect(page.locator('#additionalDetails-error')).toContainText(
      'The additional details must be 3,500 characters or less',
    )
  })

  test('Shows error alert when case note save fails', async ({ page }) => {
    await login(page)
    const addScanCaseNotePage = await goToAddScanCaseNotePage(page)

    await xrayBodyScansApi.stubGetScan(scanId, scan)
    await stubFor({
      request: { method: 'POST', urlPath: `/xray-body-scans-api/scan/${scanId}/case-note` },
      response: {
        status: 500,
        headers: { 'Content-Type': 'application/json;charset=UTF-8' },
        jsonBody: { status: 500, userMessage: 'Internal Server Error' },
      },
    })
    await addScanCaseNotePage.saveButton.click()

    await expect(addScanCaseNotePage.alert).toContainText('The case note could not be saved')
  })
})
