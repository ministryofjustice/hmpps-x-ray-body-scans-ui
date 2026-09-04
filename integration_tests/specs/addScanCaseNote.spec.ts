import { type Page, expect, test } from '@playwright/test'
import type { ScanResponse } from '../../server/data/interfaces/xrayBodyScansApi'
import { internalServerErrorResponse, notFoundErrorResponse } from '../../server/testutils/mocks/errorResponse'
import { pageResponse } from '../../server/testutils/pagination'
import {
  mockScanCaseNoteResponse,
  mockScanResponse,
  mockScanSummaryResponse,
} from '../../server/testutils/mocks/xrayBodyScansApi'
import { login, resetStubs } from '../testUtils'
import microFrontendComponents from '../mockApis/microFrontendComponents'
import prisonerSearchApi from '../mockApis/prisonerSearchApi'
import xrayBodyScansApi from '../mockApis/xrayBodyScansApi'
import AddScanCaseNotePage from '../pages/addScanCaseNotePage'
import ScanListPage from '../pages/scanListPage'

const prisonerNumber = 'A1234BC'
const scanId = '019f94a7-17cd-746f-b1df-5d4848da42e1'
const now = new Date()

const scan = mockScanResponse(prisonerNumber, now)
const caseNote = mockScanCaseNoteResponse(scan)

test.describe('Add scan case note page', () => {
  test.beforeEach(async () => {
    await Promise.all([microFrontendComponents.stubComponents(), prisonerSearchApi.stubGetPrisoner(prisonerNumber)])
  })

  test.afterEach(async () => {
    await resetStubs()
  })

  test('404 page when prisoner not found', async ({ page }) => {
    await Promise.all([prisonerSearchApi.stubGetPrisoner('B2222BB', notFoundErrorResponse), login(page)])

    const response = await page.goto(`/prisoner/B2222BB/scan/${scanId}/add-a-scan-case-note`)

    expect(response?.status()).toBe(404)
  })

  test('404 page when scan not found', async ({ page }) => {
    await Promise.all([xrayBodyScansApi.stubGetScan(scanId, { ...scan, prisonerNumber: 'B2222BB' }), login(page)])

    const response = await page.goto(`/prisoner/${prisonerNumber}/scan/${scanId}/add-a-scan-case-note`)

    expect(response?.status()).toBe(404)
  })

  test('404 page when scan already has a case note', async ({ page }) => {
    await Promise.all([
      xrayBodyScansApi.stubGetScan(scanId, { ...scan, caseNoteId: '341c845e-fadc-4ec8-9330-81c83968c1a8' }),
      login(page),
    ])

    const response = await page.goto(`/prisoner/${prisonerNumber}/scan/${scanId}/add-a-scan-case-note`)

    expect(response?.status()).toBe(404)
  })

  async function goToAddScanCaseNotePage(page: Page, stubScan: ScanResponse = scan): Promise<AddScanCaseNotePage> {
    await Promise.all([login(page), xrayBodyScansApi.stubGetScan(stubScan.id, stubScan)])
    const response = await page.goto(`/prisoner/${prisonerNumber}/scan/${stubScan.id}/add-a-scan-case-note`)
    expect(response?.status()).toBe(200)
    return AddScanCaseNotePage.verifyOnPage(page)
  }

  const scanScenarios: { scenario: string; stubScan: ScanResponse; expectedDescription: string[] }[] = [
    {
      scenario: 'negative scan',
      stubScan: {
        ...scan,
        outcome: 'NEGATIVE',
        outcomeDescription: 'No item detected',
        typeOfFind: null,
        typeOfFindDescription: null,
      },
      expectedDescription: ['Reason: Reasonable suspicion', 'Result: No item detected', 'Items found: None'],
    },
    {
      scenario: 'positive scan',
      stubScan: {
        ...scan,
        justification: 'INTELLIGENCE',
        justificationDescription: 'Intelligence-led',
      },
      expectedDescription: ['Reason: Intelligence-led', 'Result: Item detected', 'Items found: Inorganic'],
    },
  ]
  for (const { scenario, stubScan, expectedDescription } of scanScenarios) {
    test(`Page shows for a ${scenario} with expected content`, async ({ page }) => {
      const addScanCaseNotePage = await goToAddScanCaseNotePage(page, stubScan)

      await expect(addScanCaseNotePage.getBreadcrumbs()).resolves.toEqual([
        { text: 'Digital Prison Services', href: 'http://localhost:9091/dpshomepage' },
        { text: 'Smith, John', href: `http://localhost:9091/profile/prisoner/${prisonerNumber}` },
        { text: 'X-ray body scans', href: `/prisoner/${prisonerNumber}/scan-overview` },
      ])

      await expect(addScanCaseNotePage.getSummaryList()).resolves.toEqual([
        { key: 'Type', value: 'General' },
        { key: 'Sub-type', value: 'X-ray body scan' },
        { key: 'What happened', value: expect.stringMatching(expectedDescription.join('\\s+')) },
        { key: 'Happened', value: expect.stringContaining('at 00:00') },
      ])

      await expect(addScanCaseNotePage.cancelLink).toHaveAttribute('href', `/prisoner/${prisonerNumber}/scan-overview`)
    })
  }

  async function stubScanListPage() {
    return Promise.all([
      xrayBodyScansApi.stubGetScanSummary(
        prisonerNumber,
        mockScanSummaryResponse({ prisonerNumber, now, relevantAlerts: [] }),
      ),
      xrayBodyScansApi.stubListScans(
        prisonerNumber,
        pageResponse([{ ...mockScanResponse(prisonerNumber, now), id: '019fc832-0000-7000-0000-000000000001' }, scan]),
      ),
    ])
  }

  async function expectCaseNoteSaved(page: Page, queryString = '') {
    await expect(page).toHaveURL(`/prisoner/${prisonerNumber}/scan-overview${queryString}#scan-history`)
    const scanListPage = await ScanListPage.verifyOnPage(page)
    await expect(scanListPage.flashMessage).toContainText('Case note added')
    await expect(scanListPage.getScanTableHighlightedRows()).resolves.toEqual([false, true])
    return scanListPage
  }

  test('Saves case note and redirects to scan overview', async ({ page }) => {
    const addScanCaseNotePage = await goToAddScanCaseNotePage(page)

    await xrayBodyScansApi.stubCreateScanCaseNote(
      scanId,
      {
        text: `
Reason: Reasonable suspicion
Result: Item detected
Items found: Inorganic
        `.trim(),
      },
      caseNote,
    )
    await stubScanListPage()
    await addScanCaseNotePage.saveButton.click()

    await expectCaseNoteSaved(page)
  })

  test('Saves case note with additional details', async ({ page }) => {
    const addScanCaseNotePage = await goToAddScanCaseNotePage(page)

    await xrayBodyScansApi.stubCreateScanCaseNote(
      scanId,
      {
        text: `
Reason: Reasonable suspicion
Result: Item detected
Items found: Inorganic
--
Some extra details
        `.trim(),
      },
      caseNote,
    )
    await stubScanListPage()
    await addScanCaseNotePage.additionalDetailsInput.fill('Some extra details')
    await addScanCaseNotePage.saveButton.click()

    await expectCaseNoteSaved(page)
  })

  test('Returns the user to the list page preserving filters', async ({ page }) => {
    const addScanCaseNotePage = await goToAddScanCaseNotePage(page)
    await page.goto(`/prisoner/${prisonerNumber}/scan/${scan.id}/add-a-scan-case-note?year=all&sort=scanDate`)

    await xrayBodyScansApi.stubCreateScanCaseNote(scanId, undefined, caseNote)

    await stubScanListPage()
    await addScanCaseNotePage.saveButton.click()

    const scanListPage = await expectCaseNoteSaved(page, '?year=all&sort=scanDate')
    await expect(
      scanListPage.historySection.getByRole('heading', { name: 'All scans recorded', level: 3 }),
    ).toBeVisible()
  })

  test('Shows validation error when additional details exceeds 3500 characters', async ({ page }) => {
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
    const addScanCaseNotePage = await goToAddScanCaseNotePage(page)

    await xrayBodyScansApi.stubCreateScanCaseNote(scanId, undefined, internalServerErrorResponse)
    await addScanCaseNotePage.saveButton.click()

    await expect(addScanCaseNotePage.alert).toContainText('The case note could not be saved')
  })
})
