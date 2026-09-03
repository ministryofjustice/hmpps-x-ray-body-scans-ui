import { type Page, expect, test } from '@playwright/test'
import { formatDisplayDate } from '../../server/utils/dates'
import type { ScanResponse } from '../../server/data/interfaces/xrayBodyScansApi'
import { internalServerErrorResponse, notFoundErrorResponse } from '../../server/testutils/mocks/errorResponse'
import { emptyPageResponse, pageResponse } from '../../server/testutils/pagination'
import {
  mockDoNotScanAlert,
  mockInternalSecretorAlert,
  mockLegacyScanResponse,
  mockScanCaseNoteResponse,
  mockScanResponse,
  mockScanSummaryResponse,
} from '../../server/testutils/mocks/xrayBodyScansApi'
import { login, resetStubs } from '../testUtils'
import microFrontendComponents from '../mockApis/microFrontendComponents'
import prisonRegisterApi from '../mockApis/prisonRegisterApi'
import prisonerSearchApi from '../mockApis/prisonerSearchApi'
import xrayBodyScansApi from '../mockApis/xrayBodyScansApi'
import ScanListPage from '../pages/scanListPage'

const now = new Date() // cannot fix clock since backend runs in separate process with no mocking
const prisonerNumber = 'A1234BC'

test.describe('Scan list page', () => {
  test.beforeEach(async () => {
    await Promise.all([
      microFrontendComponents.stubComponents(),
      prisonRegisterApi.stubAllPrisons(),
      prisonerSearchApi.stubGetPrisoner(prisonerNumber),
    ])
  })

  test.afterEach(async () => {
    await resetStubs()
  })

  async function goToScanListPage(page: Page): Promise<ScanListPage> {
    const response = await page.goto(`/prisoner/${prisonerNumber}/scan-overview`)
    expect(response?.status()).toBe(200)
    return ScanListPage.verifyOnPage(page)
  }

  test.describe('Page display', () => {
    test('404 page when prisoner not found', async ({ page }) => {
      await prisonerSearchApi.stubGetPrisoner('B2222BB', notFoundErrorResponse)
      await login(page)

      const response = await page.goto('/prisoner/B2222BB/scan-overview')

      expect(response?.status()).toBe(404)
    })

    test('Page shows', async ({ page }) => {
      await Promise.all([
        xrayBodyScansApi.stubGetScanSummary(
          prisonerNumber,
          mockScanSummaryResponse({ prisonerNumber, now, relevantAlerts: [] }),
        ),
        xrayBodyScansApi.stubListScans(prisonerNumber),
        login(page),
      ])

      const scanListPage = await goToScanListPage(page)

      await expect(scanListPage.getBreadcrumbs()).resolves.toEqual([
        { text: 'Digital Prison Services', href: 'http://localhost:9091/dpshomepage' },
        { text: 'Smith, John', href: `http://localhost:9091/profile/prisoner/${prisonerNumber}` },
      ])

      // TODO: profile banner

      await expect(page.getByRole('button', { name: 'Record a new scan' })).toHaveAttribute(
        'href',
        `/prisoner/${prisonerNumber}/record-scan`,
      )
      // TODO: record button hidden sometimes?

      // summary headings
      const currentYear = now.getFullYear()
      await Promise.all([
        expect(
          scanListPage.summarySection.getByRole('heading', { name: 'X-ray body scans recorded in', level: 2 }),
        ).toContainText(currentYear.toString()),
        expect(scanListPage.countSection.getByRole('heading', { name: 'Scans in', level: 3 })).toContainText(
          currentYear.toString(),
        ),
      ])

      // year filter tabs
      await expect(scanListPage.yearTabs).toContainText([
        'This year’s scans',
        `${currentYear - 1} scans`,
        `${currentYear - 2} scans`,
        'All scans',
      ])

      // return link
      await expect(scanListPage.returnLink).toHaveAttribute(
        'href',
        `http://localhost:9091/profile/prisoner/${prisonerNumber}`,
      )
    })
  })

  test.describe('Scan summary', () => {
    const summaryScenarios = [
      {
        scenario: 'with no scans',
        scanSummary: mockScanSummaryResponse({ prisonerNumber, now, relevantAlerts: [] }),
        expectedInfoBoxText: null,
        expectedCurrentYearCount: {
          count: 0,
          ariaLabel: 'No scans recorded',
        },
        expectedCountText: 'No scans recorded',
        expectedCountWarningText: null,
        expectedOutcomes: [0, 0, 0],
      },
      {
        scenario: 'with only 1 NOMIS scan',
        scanSummary: mockScanSummaryResponse({ prisonerNumber, now, nomisCount: 1, relevantAlerts: [] }),
        expectedInfoBoxText: '1 scan does not have a result available',
        expectedCurrentYearCount: {
          count: 1,
          ariaLabel: '1 scan this year',
        },
        expectedCountText: null,
        expectedCountWarningText: null,
        expectedOutcomes: [0, 0, 0],
      },
      {
        scenario: 'with NOMIS and DPS scans',
        scanSummary: mockScanSummaryResponse({
          prisonerNumber,
          now,
          dpsCount: 6,
          nomisCount: 3,
          positiveCount: 1,
          negativeCount: 3,
          relevantAlerts: [],
        }),
        expectedInfoBoxText: '3 scans do not have a result available',
        expectedCurrentYearCount: {
          count: 9,
          ariaLabel: '9 scans this year',
        },
        expectedCountText: null,
        expectedCountWarningText: null,
        expectedOutcomes: [1, 2, 3],
      },
      {
        scenario: 'nearing the scan limit',
        scanSummary: mockScanSummaryResponse({
          prisonerNumber,
          now,
          dpsCount: 101,
          positiveCount: 1,
          negativeCount: 100,
          relevantAlerts: [],
        }),
        expectedInfoBoxText: null,
        expectedCurrentYearCount: {
          count: 101,
          ariaLabel: '101 scans this year',
        },
        expectedCountText: '15 scans left this year',
        expectedCountWarningText: 'Near scan limit',
        expectedOutcomes: [1, 0, 100],
      },
      {
        scenario: 'at the scan limit',
        scanSummary: mockScanSummaryResponse({
          prisonerNumber,
          now,
          dpsCount: 106,
          nomisCount: 10,
          negativeCount: 100,
          relevantAlerts: [],
        }),
        expectedInfoBoxText: '10 scans do not have a result available',
        expectedCurrentYearCount: {
          count: 116,
          ariaLabel: '116 scans this year',
        },
        expectedCountText: 'No more scans allowed this year',
        expectedCountWarningText: 'Scan limit reached',
        expectedOutcomes: [0, 6, 100],
      },
    ]
    for (const {
      scenario,
      scanSummary,
      expectedInfoBoxText,
      expectedCurrentYearCount,
      expectedCountText,
      expectedCountWarningText,
      expectedOutcomes,
    } of summaryScenarios) {
      test(`Shows summary for a person ${scenario}`, async ({ page }) => {
        await Promise.all([
          xrayBodyScansApi.stubGetScanSummary(prisonerNumber, scanSummary),
          xrayBodyScansApi.stubListScans(prisonerNumber),
          login(page),
        ])

        const scanListPage = await goToScanListPage(page)

        if (expectedInfoBoxText) {
          await expect(scanListPage.infoBox).toContainText(expectedInfoBoxText)
        }

        await expect(scanListPage.getCurrentYearCount()).resolves.toEqual(expectedCurrentYearCount)
        if (expectedCountText) {
          await expect(scanListPage.countSection).toContainText(expectedCountText)
        }
        if (expectedCountWarningText) {
          await expect(scanListPage.currentYearCountWarning).toContainText(expectedCountWarningText)
        } else {
          await expect(scanListPage.currentYearCountWarning).not.toBeVisible()
        }

        await expect(scanListPage.getOutcomes()).resolves.toEqual(expectedOutcomes)
      })
    }

    const alertsScenarios = [
      {
        scenario: 'with no relevant alerts',
        scanSummary: mockScanSummaryResponse({ prisonerNumber, now, relevantAlerts: [] }),
        expectedAlertFlags: ['No scan alerts'],
      },
      {
        scenario: 'with an internal secretor alert',
        scanSummary: mockScanSummaryResponse({
          prisonerNumber,
          now,
          relevantAlerts: [mockInternalSecretorAlert],
        }),
        expectedAlertFlags: ['Internal Secretor'],
      },
      {
        scenario: 'with both relevant alerts',
        scanSummary: mockScanSummaryResponse({
          prisonerNumber,
          now,
          relevantAlerts: [mockInternalSecretorAlert, mockDoNotScanAlert],
        }),
        expectedAlertFlags: ['Internal Secretor', 'Do Not X-Ray Body Scan'],
      },
    ]
    for (const { scenario, scanSummary, expectedAlertFlags } of alertsScenarios) {
      test(`Shows summary for a person ${scenario}`, async ({ page }) => {
        await Promise.all([
          xrayBodyScansApi.stubGetScanSummary(prisonerNumber, scanSummary),
          xrayBodyScansApi.stubListScans(prisonerNumber),
          login(page),
        ])

        const scanListPage = await goToScanListPage(page)

        await expect(scanListPage.alertsList).toContainText(expectedAlertFlags)
      })
    }
  })

  test.describe('Scan history', () => {
    const tabScenarios = [
      {
        scenario: 'last year',
        yearTabIndex: 1,
        listScanRequest: {
          fromScanDate: new Date(now.getFullYear() - 1, 0, 1, 12),
          toScanDate: new Date(now.getFullYear() - 1, 11, 31, 12),
        },
        expectedSubheading: `Scans recorded in ${now.getFullYear() - 1}`,
        expectedNoScansMessage: `No X-ray body scans have been recorded for this person in ${now.getFullYear() - 1}.`,
      },
      {
        scenario: '2 years ago',
        yearTabIndex: 2,
        listScanRequest: {
          fromScanDate: new Date(now.getFullYear() - 2, 0, 1, 12),
          toScanDate: new Date(now.getFullYear() - 2, 11, 31, 12),
        },
        expectedSubheading: `Scans recorded in ${now.getFullYear() - 2}`,
        expectedNoScansMessage: `No X-ray body scans have been recorded for this person in ${now.getFullYear() - 2}.`,
      },
      {
        scenario: 'all years',
        yearTabIndex: 3,
        listScanRequest: {
          fromScanDate: new Date(2000, 0, 1, 12),
        },
        expectedSubheading: 'All scans recorded',
        expectedNoScansMessage: 'No X-ray body scans have been recorded for this person.',
      },
    ]
    for (const {
      scenario,
      yearTabIndex,
      listScanRequest,
      expectedSubheading,
      expectedNoScansMessage,
    } of tabScenarios) {
      test(`Can filter scans from ${scenario} and display messages when there are no scans`, async ({ page }) => {
        await Promise.all([
          xrayBodyScansApi.stubGetScanSummary(
            prisonerNumber,
            mockScanSummaryResponse({
              prisonerNumber,
              now,
              relevantAlerts: [],
            }),
          ),
          xrayBodyScansApi.stubListScans(prisonerNumber, emptyPageResponse(), { page: 0 }),
          login(page),
        ])

        const scanListPage = await goToScanListPage(page)

        await expect(
          scanListPage.historySection.getByRole('heading', { name: 'Scans recorded this year', level: 3 }),
        ).toBeVisible()
        await expect(scanListPage.scanTable).not.toBeVisible()
        await expect(scanListPage.historySection).toContainText(
          `No X-ray body scans have been recorded for this person in ${now.getFullYear()}.`,
        )

        // mock filtered scans
        await xrayBodyScansApi.stubListScans(prisonerNumber, pageResponse([mockScanResponse(prisonerNumber, now)]), {
          ...listScanRequest,
          page: 0,
        })

        await scanListPage.yearTabs.nth(yearTabIndex).getByRole('link').click()

        await expect(
          scanListPage.historySection.getByRole('heading', { name: expectedSubheading, level: 3 }),
        ).toBeVisible()
        await expect(scanListPage.scanTable).toBeVisible()
        await expect(scanListPage.historySection).not.toContainText(expectedNoScansMessage)

        // mock no filtered scans
        await xrayBodyScansApi.stubListScans(prisonerNumber, emptyPageResponse(), {
          ...listScanRequest,
          page: 0,
        })

        await scanListPage.yearTabs.nth(yearTabIndex).getByRole('link').click()

        await expect(
          scanListPage.historySection.getByRole('heading', { name: expectedSubheading, level: 3 }),
        ).toBeVisible()
        await expect(scanListPage.scanTable).not.toBeVisible()
        await expect(scanListPage.historySection).toContainText(expectedNoScansMessage)
      })
    }

    test('Shows table of scans', async ({ page }) => {
      await Promise.all([
        xrayBodyScansApi.stubGetScanSummary(
          prisonerNumber,
          mockScanSummaryResponse({
            prisonerNumber,
            now,
            relevantAlerts: [],
          }),
        ),
        xrayBodyScansApi.stubListScans(
          prisonerNumber,
          pageResponse([
            {
              ...mockScanResponse(prisonerNumber, now),
              id: '019fc832-0000-7000-0000-000000000001',
              prisonId: 'LEI',
              justification: 'REASONABLE_SUSPICION',
              justificationDescription: 'Reasonable suspicion',
              outcome: 'POSITIVE',
              outcomeDescription: 'Item detected',
              typeOfFind: 'ORGANIC',
              typeOfFindDescription: 'Organic',
            },
            {
              ...mockScanResponse(prisonerNumber, now),
              id: '019fc832-0000-7000-0000-000000000002',
              prisonId: 'LEI',
              justification: 'REASONABLE_SUSPICION',
              justificationDescription: 'Reasonable suspicion',
              outcome: 'POSITIVE',
              outcomeDescription: 'Item detected',
              typeOfFind: 'INORGANIC',
              typeOfFindDescription: 'Inorganic',
              caseNoteId: '341c845e-fadc-4ec8-9330-81c83968c1a8',
            },
            {
              ...mockScanResponse(prisonerNumber, now),
              id: '019fc832-0000-7000-0000-000000000003',
              prisonId: 'LEI',
              justification: 'INTELLIGENCE',
              justificationDescription: 'Intelligence-led',
              outcome: 'POSITIVE',
              outcomeDescription: 'Item detected',
              typeOfFind: 'ORGANIC_AND_INORGANIC',
              typeOfFindDescription: 'Organic and inorganic',
            },
            {
              ...mockScanResponse(prisonerNumber, now),
              id: '019fc832-0000-7000-0000-000000000004',
              prisonId: 'LEI',
              justification: 'REASONABLE_SUSPICION',
              justificationDescription: 'Reasonable suspicion',
              outcome: 'POSITIVE',
              outcomeDescription: 'Item detected',
              typeOfFind: 'NOT_KNOWN',
              typeOfFindDescription: 'Not known',
            },
            {
              ...mockScanResponse(prisonerNumber, now),
              id: '019fc832-0000-7000-0000-000000000005',
              prisonId: 'LEI',
              justification: 'REASONABLE_SUSPICION',
              justificationDescription: 'Reasonable suspicion',
              outcome: 'NEGATIVE',
              outcomeDescription: 'No item detected',
              typeOfFind: null,
              typeOfFindDescription: null,
            },
            {
              ...mockScanResponse(prisonerNumber, now),
              id: '019fc832-0000-7000-0000-000000000006',
              prisonId: 'MDI',
              justification: 'INTELLIGENCE',
              justificationDescription: 'Intelligence-led',
              outcome: 'INCONCLUSIVE',
              outcomeDescription: 'Inconclusive',
              typeOfFind: null,
              typeOfFindDescription: null,
            },
            // nomis scan may be missing details
            mockLegacyScanResponse(prisonerNumber, now),
            // nomis scan may be missing scan date
            mockLegacyScanResponse(prisonerNumber, null, 'positive'),
          ]),
        ),
        login(page),
      ])

      const scanListPage = await goToScanListPage(page)
      const dateStr = formatDisplayDate(now)
      await expect(scanListPage.getScanTableContents()).resolves.toEqual([
        [dateStr, 'Leeds (HMP)', 'Reasonable suspicion', 'Item detected', 'Organic', 'Add case note'],
        [dateStr, 'Leeds (HMP)', 'Reasonable suspicion', 'Item detected', 'Inorganic', 'View case note'],
        [dateStr, 'Leeds (HMP)', 'Intelligence-led', 'Item detected', 'Organic and inorganic', 'Add case note'],
        [dateStr, 'Leeds (HMP)', 'Reasonable suspicion', 'Item detected', 'Not known', 'Add case note'],
        [dateStr, 'Leeds (HMP)', 'Reasonable suspicion', 'No item detected', 'None', 'Add case note'],
        [dateStr, 'Moorland (HMP & YOI)', 'Intelligence-led', 'Inconclusive', 'None', 'Add case note'],
        [dateStr, '', '', '', '', ''],
        ['Not recorded', '', '', 'positive', '', ''],
      ])
      await expect(scanListPage.getScanTableActionUrls()).resolves.toEqual([
        expect.stringContaining('/prisoner/A1234BC/scan/019fc832-0000-7000-0000-000000000001/add-a-scan-case-note'),
        // TODO: should direct case note link point to profile?
        expect.stringContaining('/profile/prisoner/A1234BC/update-case-note/341c845e-fadc-4ec8-9330-81c83968c1a8'),
        expect.stringContaining('/prisoner/A1234BC/scan/019fc832-0000-7000-0000-000000000003/add-a-scan-case-note'),
        expect.stringContaining('/prisoner/A1234BC/scan/019fc832-0000-7000-0000-000000000004/add-a-scan-case-note'),
        expect.stringContaining('/prisoner/A1234BC/scan/019fc832-0000-7000-0000-000000000005/add-a-scan-case-note'),
        expect.stringContaining('/prisoner/A1234BC/scan/019fc832-0000-7000-0000-000000000006/add-a-scan-case-note'),
        undefined,
        undefined,
      ])
      await expect(scanListPage.pagination).not.toBeVisible()
    })

    const pageScenarios = [
      {
        scenario: 'last year',
        yearTabIndex: 1,
        listScanRequest: {
          fromScanDate: new Date(now.getFullYear() - 1, 0, 1, 12),
          toScanDate: new Date(now.getFullYear() - 1, 11, 31, 12),
        },
        goToPage: 'page 10',
        finalPage: 10,
      },
      {
        scenario: 'all years',
        yearTabIndex: 3,
        listScanRequest: {
          fromScanDate: new Date(2000, 0, 1, 12),
        },
        goToPage: 'next page',
        finalPage: 1,
      },
    ]
    for (const { scenario, yearTabIndex, listScanRequest, goToPage, finalPage } of pageScenarios) {
      const response = pageResponse(Array.from({ length: 20 }).map(() => mockLegacyScanResponse(prisonerNumber, now)))
      response.totalElements = 200
      response.totalPages = 10

      test(`Shows pagination when going to ${goToPage} of 10 pages in scans from ${scenario}`, async ({ page }) => {
        await Promise.all([
          xrayBodyScansApi.stubGetScanSummary(
            prisonerNumber,
            mockScanSummaryResponse({
              prisonerNumber,
              now,
              relevantAlerts: [],
            }),
          ),
          xrayBodyScansApi.stubListScans(prisonerNumber, response, { page: 0 }),
          login(page),
        ])

        const scanListPage = await goToScanListPage(page)

        await xrayBodyScansApi.stubListScans(prisonerNumber, response, { ...listScanRequest, page: 0 })
        await scanListPage.yearTabs.nth(yearTabIndex).getByRole('link').click()

        await xrayBodyScansApi.stubListScans(prisonerNumber, response, { ...listScanRequest, page: finalPage })
        await scanListPage.pagination.getByRole('link', { name: goToPage === 'page 10' ? '10' : 'Next' }).click()

        if (scenario === 'all years') {
          await expect(scanListPage.pagination.getByRole('link', { name: 'View all' })).not.toBeVisible()
        } else {
          await xrayBodyScansApi.stubListScans(
            prisonerNumber,
            {
              ...response,
              numberOfElements: 200,
              totalElements: 200,
              totalPages: 1,
              size: 5000,
            },
            { ...listScanRequest, page: 0 },
          )
          await scanListPage.pagination.getByRole('link', { name: 'View all' }).click()
          await expect(scanListPage.pagination).not.toBeVisible()
        }
      })
    }

    test('Can sort scans by date in various tabs', async ({ page }) => {
      const response = pageResponse(Array.from({ length: 20 }).map(() => mockScanResponse(prisonerNumber, now)))
      response.totalElements = 110
      response.totalPages = 6

      await Promise.all([
        xrayBodyScansApi.stubGetScanSummary(
          prisonerNumber,
          mockScanSummaryResponse({
            prisonerNumber,
            now,
            relevantAlerts: [],
          }),
        ),
        xrayBodyScansApi.stubListScans(prisonerNumber, response, {
          page: 0,
        }),
        login(page),
      ])

      const scanListPage = await goToScanListPage(page)
      await expect(scanListPage.getScanTableHeaders()).resolves.toEqual([
        {
          text: expect.stringMatching(/Date\s+\(sorted descending\)/),
          href: expect.stringContaining('sort=scanDate'),
          ariaSort: 'descending',
        },
        { text: 'Establishment' },
        { text: 'Reason' },
        { text: 'Scan details' },
        { text: 'Items found' },
        { text: 'Action' },
      ])

      // sort by ascending scan date in this year
      await xrayBodyScansApi.stubListScans(prisonerNumber, response, {
        page: 0,
        sort: 'scanDate,ASC',
      })
      await scanListPage.scanTable.locator('.govuk-table__head').getByRole('link', { name: 'Date' }).click()
      await expect(scanListPage.getScanTableHeaders()).resolves.toEqual(
        expect.arrayContaining([
          {
            text: expect.stringMatching(/Date\s+\(sorted ascending\)/),
            href: expect.stringContaining('sort=-scanDate'),
            ariaSort: 'ascending',
          },
        ]),
      )

      // go to another page and ensure sort order persists
      await xrayBodyScansApi.stubListScans(
        prisonerNumber,
        { ...response, number: 2 },
        {
          page: 2,
          sort: 'scanDate,ASC',
        },
      )
      await scanListPage.pagination.getByRole('link', { name: '3' }).click()
      await expect(scanListPage.getScanTableHeaders()).resolves.toEqual(
        expect.arrayContaining([
          {
            text: expect.stringMatching(/Date\s+\(sorted ascending\)/),
            href: expect.stringContaining('sort=-scanDate'),
            ariaSort: 'ascending',
          },
        ]),
      )

      // go to all years and expect sort and page to reset
      await xrayBodyScansApi.stubListScans(prisonerNumber, response, {
        page: 0,
        fromScanDate: new Date(2000, 0, 1, 12),
      })
      await scanListPage.yearTabs.nth(3).getByRole('link').click()
      await expect(scanListPage.getScanTableHeaders()).resolves.toEqual(
        expect.arrayContaining([
          {
            text: expect.stringMatching(/Date\s+\(sorted descending\)/),
            href: expect.stringContaining('sort=scanDate'),
            ariaSort: 'descending',
          },
        ]),
      )
    })

    test('Can open case note in a modal window', async ({ page }) => {
      const scans: ScanResponse[] = [
        {
          ...mockScanResponse(prisonerNumber, now),
          id: '019fc832-0000-7000-0000-000000000001',
          prisonId: 'LEI',
          justification: 'REASONABLE_SUSPICION',
          justificationDescription: 'Reasonable suspicion',
          outcome: 'POSITIVE',
          outcomeDescription: 'Item detected',
          typeOfFind: 'ORGANIC',
          typeOfFindDescription: 'Organic',
        },
        {
          ...mockScanResponse(prisonerNumber, now),
          id: '019fc832-0000-7000-0000-000000000002',
          prisonId: 'LEI',
          justification: 'REASONABLE_SUSPICION',
          justificationDescription: 'Reasonable suspicion',
          outcome: 'POSITIVE',
          outcomeDescription: 'Item detected',
          typeOfFind: 'INORGANIC',
          typeOfFindDescription: 'Inorganic',
          caseNoteId: '341c845e-fadc-4ec8-9330-81c83968c1a8',
        },
      ]
      const caseNote = mockScanCaseNoteResponse(scans[1])
      scans[1].caseNoteId = caseNote.id

      await Promise.all([
        xrayBodyScansApi.stubGetScanSummary(
          prisonerNumber,
          mockScanSummaryResponse({
            prisonerNumber,
            now,
            relevantAlerts: [],
          }),
        ),
        xrayBodyScansApi.stubListScans(prisonerNumber, pageResponse(scans)),
        login(page),
      ])

      const scanListPage = await goToScanListPage(page)
      await expect(scanListPage.modal).not.toBeVisible()
      await expect(scanListPage.getNthRowActionLink(0)).toContainText('Add case note')

      await Promise.all([
        xrayBodyScansApi.stubGetScan(scans[1].id, scans[1]),
        xrayBodyScansApi.stubGetScanCaseNote(scans[1].id, caseNote),
      ])
      await scanListPage.getNthRowActionLink(1).click()
      await expect(scanListPage.modal).toBeVisible()
      await expect(scanListPage.modalHeader).toContainText('Case note details')
      await expect(scanListPage.modal).toContainText(caseNote.text)
      await scanListPage.modalContent.getByRole('button', { name: 'Close' }).click()
      await expect(scanListPage.modal).not.toBeVisible()

      await xrayBodyScansApi.stubGetScanCaseNote(scans[1].id, internalServerErrorResponse)
      await scanListPage.getNthRowActionLink(1).click()
      await expect(scanListPage.modal).toBeVisible()
      await expect(scanListPage.modalHeader).toContainText('Case note details')
      await expect(scanListPage.modal).toContainText('The error has been logged. Please try again.')
      await scanListPage.modalHeader.getByRole('button', { name: 'Close' }).click()
      await expect(scanListPage.modal).not.toBeVisible()
    })
  })

  // TODO: what shows if summary and/or list do not load?
})
