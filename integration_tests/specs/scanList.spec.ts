import { type Page, expect, test } from '@playwright/test'
import { daysAgo, formatDisplayDate } from '../../server/utils/dates'
import type { ScanResponse } from '../../server/data/interfaces/xrayBodyScansApi'
import { internalServerErrorResponse, notFoundErrorResponse } from '../../server/testutils/mocks/errorResponse'
import { emptyPageResponse, pageResponse } from '../../server/testutils/pagination'
import { mockPrisoner } from '../../server/testutils/mocks/prisonerSearchApi'
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
import prisonApi from '../mockApis/prisonApi'
import prisonRegisterApi from '../mockApis/prisonRegisterApi'
import prisonerSearchApi from '../mockApis/prisonerSearchApi'
import wpipUI from '../mockApis/wpipUI'
import xrayBodyScansApi from '../mockApis/xrayBodyScansApi'
import ScanListPage from '../pages/scanListPage'

const now = new Date() // cannot fix clock since backend runs in separate process with no mocking
const prisonerNumber = 'A1234BC'
const prisoner = mockPrisoner(prisonerNumber, { currentFacialImageId: '1008971246' })

const startAtPath = `/prisoner/${prisonerNumber}/scan-overview`

test.describe('Scan list page', () => {
  test.beforeEach(async () => {
    await Promise.all([
      microFrontendComponents.stubComponents(),
      prisonApi.stubPrisonerPhoto(prisoner.currentFacialImageId!),
      prisonRegisterApi.stubAllPrisons(),
      prisonerSearchApi.stubGetPrisoner(prisonerNumber, prisoner),
    ])
  })

  test.afterEach(async () => {
    await resetStubs()
  })

  async function startOnScanListPage(page: Page, querystring = ''): Promise<ScanListPage> {
    const response = await login(page, `${startAtPath}${querystring}`)
    expect(response?.status()).toBe(200)
    return ScanListPage.verifyOnPage(page)
  }

  test.describe('Page display', () => {
    test('404 page when prisoner not found', async ({ page }) => {
      await prisonerSearchApi.stubGetPrisoner('B2222BB', notFoundErrorResponse)

      const response = await login(page, '/prisoner/B2222BB/scan-overview')

      expect(response?.status()).toBe(404)
    })

    test('Page shows', async ({ page }) => {
      await Promise.all([
        xrayBodyScansApi.stubGetScanSummary(
          prisonerNumber,
          mockScanSummaryResponse({ prisonerNumber, now, relevantAlerts: [] }),
          { includeAlerts: true },
        ),
        xrayBodyScansApi.stubListScans(prisonerNumber),
      ])

      const scanListPage = await startOnScanListPage(page)

      // breadcrumbs
      await expect(scanListPage.returnToWpipLink).not.toBeVisible()
      await expect(scanListPage.getBreadcrumbs()).resolves.toEqual([
        { text: 'Digital Prison Services', href: 'http://localhost:9091/dpshomepage' },
        { text: 'Smith, John', href: `http://localhost:9091/profile/prisoner/${prisonerNumber}` },
      ])

      // profile banner
      await expect(scanListPage.profileBannerLink).toContainText('Smith, John')
      await expect(scanListPage.profileBannerLink).toHaveAttribute(
        'href',
        `http://localhost:9091/profile/prisoner/${prisonerNumber}`,
      )
      await expect(scanListPage.profileBannerPhoto).toHaveAttribute('alt', 'Photo of John Smith')
      await expect(scanListPage.getProfileBannerProperties()).resolves.toEqual([
        {
          title: 'Location',
          description: 'A-1-205',
        },
        {
          title: 'Category',
          description: 'C',
        },
      ])

      // record button
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

      // no flash message
      await expect(scanListPage.flashMessage).not.toBeVisible()

      // return link
      await expect(scanListPage.returnLink).toContainText('Return to the prisoner’s profile')
      await expect(scanListPage.returnLink).toHaveAttribute(
        'href',
        `http://localhost:9091/profile/prisoner/${prisonerNumber}`,
      )
    })

    test('Links back to WPIP for users who came from there', async ({ page }) => {
      await Promise.all([
        xrayBodyScansApi.stubGetScanSummary(
          prisonerNumber,
          mockScanSummaryResponse({ prisonerNumber, now, relevantAlerts: [] }),
          { includeAlerts: true },
        ),
        xrayBodyScansApi.stubListScans(prisonerNumber),
      ])

      const scanListPage = await startOnScanListPage(page, '?wpipReturnPath=%2Frecent-arrivals%3Fsearch%3DJohn')

      // breadcrumbs
      await expect(scanListPage.returnToWpipLink).toContainText('Return to recent arrivals')
      await expect(scanListPage.returnToWpipLink).toHaveAttribute(
        'href',
        `http://localhost:9091/welcome/recent-arrivals?search=John`,
      )

      // return link
      await expect(scanListPage.returnLink).toContainText('Return to recent arrivals')
      await expect(scanListPage.returnLink).toHaveAttribute(
        'href',
        `http://localhost:9091/welcome/recent-arrivals?search=John`,
      )

      // end WPIP journey
      await wpipUI.stubWpipRecentArrivals()
      await scanListPage.returnToWpipLink.click()
      await page.goto(startAtPath)
      await expect(scanListPage.returnToWpipLink).not.toBeVisible()
    })

    // TODO: add test for "recently in caseloads but not now"
    // TODO: add test for "fails permissions"
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
          xrayBodyScansApi.stubGetScanSummary(prisonerNumber, scanSummary, { includeAlerts: true }),
          xrayBodyScansApi.stubListScans(prisonerNumber),
        ])

        const scanListPage = await startOnScanListPage(page)

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
        expectedAlertFlags: ['Internal secretor'],
      },
      {
        scenario: 'with both relevant alerts',
        scanSummary: mockScanSummaryResponse({
          prisonerNumber,
          now,
          relevantAlerts: [mockInternalSecretorAlert, mockDoNotScanAlert],
        }),
        expectedAlertFlags: ['Internal secretor', 'Do not X-Ray body scan'],
      },
    ]
    for (const { scenario, scanSummary, expectedAlertFlags } of alertsScenarios) {
      test(`Shows summary for a person ${scenario}`, async ({ page }) => {
        await Promise.all([
          xrayBodyScansApi.stubGetScanSummary(prisonerNumber, scanSummary, { includeAlerts: true }),
          xrayBodyScansApi.stubListScans(prisonerNumber),
        ])

        const scanListPage = await startOnScanListPage(page)

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
            { includeAlerts: true },
          ),
          xrayBodyScansApi.stubListScans(prisonerNumber, emptyPageResponse(), {
            fromScanDate: new Date(now.getFullYear(), 0, 1, 12),
            toScanDate: now,
            page: 0,
          }),
        ])

        const scanListPage = await startOnScanListPage(page)

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
          { includeAlerts: true },
        ),
        xrayBodyScansApi.stubListScans(
          prisonerNumber,
          pageResponse([
            // my prison, just now
            {
              ...mockScanResponse(prisonerNumber, now),
              id: '019fc832-0000-7000-0000-000000000001',
              prisonId: 'MDI',
              justification: 'REASONABLE_SUSPICION',
              justificationDescription: 'Reasonable suspicion',
              outcome: 'POSITIVE',
              outcomeDescription: 'Item detected',
            },
            // my prison, yesterday
            {
              ...mockScanResponse(prisonerNumber, daysAgo(1)),
              id: '019fc832-0000-7000-0000-000000000002',
              prisonId: 'MDI',
              justification: 'INTELLIGENCE',
              justificationDescription: 'Intelligence-led',
              outcome: 'POSITIVE',
              outcomeDescription: 'Item detected',
              caseNoteId: '341c845e-fadc-4ec8-9330-81c83968c1a8',
            },
            // different prison, recent
            {
              ...mockScanResponse(prisonerNumber, daysAgo(15)),
              id: '019fc832-0000-7000-0000-000000000003',
              prisonId: 'LEI',
              justification: 'REASONABLE_SUSPICION',
              justificationDescription: 'Reasonable suspicion',
              outcome: 'NEGATIVE',
              outcomeDescription: 'No item detected',
            },
            // my prison, not recent
            {
              ...mockScanResponse(prisonerNumber, daysAgo(33)),
              id: '019fc832-0000-7000-0000-000000000004',
              prisonId: 'MDI',
              justification: 'INTELLIGENCE',
              justificationDescription: 'Intelligence-led',
              outcome: 'INCONCLUSIVE',
              outcomeDescription: 'Inconclusive',
            },
            // nomis
            {
              ...mockLegacyScanResponse(prisonerNumber, daysAgo(60), 'intel - neg'),
              id: '715262',
            },
            // nomis scan may be missing details
            {
              ...mockLegacyScanResponse(prisonerNumber, daysAgo(61)),
              id: '715247',
            },
            // nomis scan may be missing scan date
            {
              ...mockLegacyScanResponse(prisonerNumber, null, 'positive'),
              id: '715187',
            },
          ]),
        ),
      ])

      const scanListPage = await startOnScanListPage(page)
      await expect(scanListPage.getScanTableContents()).resolves.toEqual([
        [formatDisplayDate(now), 'Moorland (HMP & YOI)', 'Reasonable suspicion', 'Item detected', 'Add case note'],
        [formatDisplayDate(daysAgo(1)), 'Moorland (HMP & YOI)', 'Intelligence-led', 'Item detected', 'View case note'],
        [formatDisplayDate(daysAgo(15)), 'Leeds (HMP)', 'Reasonable suspicion', 'No item detected', ''],
        [formatDisplayDate(daysAgo(33)), 'Moorland (HMP & YOI)', 'Intelligence-led', 'Inconclusive', ''],
        [formatDisplayDate(daysAgo(60)), '', '', 'intel - neg', ''],
        [formatDisplayDate(daysAgo(61)), '', '', '', ''],
        ['Not recorded', '', '', 'positive', ''],
      ])
      await expect(scanListPage.getScanTableActionUrls()).resolves.toEqual([
        expect.stringContaining('/prisoner/A1234BC/scan/019fc832-0000-7000-0000-000000000001/add-a-scan-case-note'),
        expect.stringContaining('/profile/prisoner/A1234BC/update-case-note/341c845e-fadc-4ec8-9330-81c83968c1a8'),
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
      ])
      await expect(scanListPage.pagination).toBeVisible()
      await expect(scanListPage.getPaginationShowingDescription()).resolves.toEqual('Showing 1 to 7 of 7 results')
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
        finalPage: 9,
        expectShowing: 'Showing 181 to 200 of 200 results',
      },
      {
        scenario: 'all years',
        yearTabIndex: 3,
        listScanRequest: {
          fromScanDate: new Date(2000, 0, 1, 12),
        },
        goToPage: 'next page',
        finalPage: 1,
        expectShowing: 'Showing 21 to 40 of 200 results',
      },
    ]
    for (const { scenario, yearTabIndex, listScanRequest, goToPage, finalPage, expectShowing } of pageScenarios) {
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
            { includeAlerts: true },
          ),
          xrayBodyScansApi.stubListScans(prisonerNumber, response, { page: 0 }),
        ])

        const scanListPage = await startOnScanListPage(page)
        await expect(scanListPage.getPaginationShowingDescription()).resolves.toContain(
          'Showing 1 to 20 of 200 results',
        )

        await xrayBodyScansApi.stubListScans(prisonerNumber, response, { ...listScanRequest, page: 0 })
        await scanListPage.yearTabs.nth(yearTabIndex).getByRole('link').click()
        await expect(scanListPage.getPaginationShowingDescription()).resolves.toContain(
          'Showing 1 to 20 of 200 results',
        )

        await xrayBodyScansApi.stubListScans(
          prisonerNumber,
          { ...response, number: finalPage },
          { ...listScanRequest, page: finalPage },
        )
        await scanListPage.pagination.getByRole('link', { name: goToPage === 'page 10' ? '10' : 'Next' }).click()
        await expect(scanListPage.getPaginationShowingDescription()).resolves.toContain(expectShowing)

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
          await expect(scanListPage.getPaginationShowingDescription()).resolves.toEqual(
            'Showing 1 to 200 of 200 results',
          )
          await expect(scanListPage.pagination.getByRole('link', { name: 'View all' })).not.toBeVisible()
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
          { includeAlerts: true },
        ),
        xrayBodyScansApi.stubListScans(prisonerNumber, response, {
          page: 0,
        }),
      ])

      const scanListPage = await startOnScanListPage(page)
      await expect(scanListPage.getScanTableHeaders()).resolves.toEqual([
        {
          text: expect.stringMatching(/Date\s+\(sorted descending\)/),
          href: expect.stringContaining('sort=scanDate'),
          ariaSort: 'descending',
        },
        { text: 'Establishment' },
        { text: 'Reason' },
        { text: 'Scan details' },
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

    const caseNoteScenarios = [
      { scenario: 'case note', withAmendments: false },
      { scenario: 'case note with amendments', withAmendments: true },
    ]
    for (const { scenario, withAmendments } of caseNoteScenarios) {
      test(`Can open ${scenario} in a modal window`, async ({ page }) => {
        const scans: ScanResponse[] = [
          {
            ...mockScanResponse(prisonerNumber, now),
            id: '019fc832-0000-7000-0000-000000000001',
            prisonId: 'MDI',
            justification: 'REASONABLE_SUSPICION',
            justificationDescription: 'Reasonable suspicion',
            outcome: 'POSITIVE',
            outcomeDescription: 'Item detected',
          },
          {
            ...mockScanResponse(prisonerNumber, now),
            id: '019fc832-0000-7000-0000-000000000002',
            prisonId: 'MDI',
            justification: 'REASONABLE_SUSPICION',
            justificationDescription: 'Reasonable suspicion',
            outcome: 'POSITIVE',
            outcomeDescription: 'Item detected',
            caseNoteId: '341c845e-fadc-4ec8-9330-81c83968c1a8',
          },
        ]
        const caseNote = mockScanCaseNoteResponse(scans[1])
        if (withAmendments) {
          caseNote.amendments.push({
            text: 'Moved to seg',
            createdBy: scans[1].createdBy,
            createdAt: scans[1].createdAt,
          })
        }
        scans[1].caseNoteId = caseNote.id

        await Promise.all([
          xrayBodyScansApi.stubGetScanSummary(
            prisonerNumber,
            mockScanSummaryResponse({
              prisonerNumber,
              now,
              relevantAlerts: [],
            }),
            { includeAlerts: true },
          ),
          xrayBodyScansApi.stubListScans(prisonerNumber, pageResponse(scans)),
        ])

        const scanListPage = await startOnScanListPage(page)
        await expect(scanListPage.modal).not.toBeVisible()
        await expect(scanListPage.getNthRowActionLink(0)).toContainText('Add case note')

        await Promise.all([
          xrayBodyScansApi.stubGetScan(scans[1].id, scans[1]),
          xrayBodyScansApi.stubGetScanCaseNote(scans[1].id, caseNote),
        ])
        await expect(scanListPage.getNthRowActionLink(1)).toContainText('View case note')
        await scanListPage.getNthRowActionLink(1).click()
        await expect(scanListPage.modal).toBeVisible()
        await expect(scanListPage.modalHeader).toContainText('Case note details')
        await expect(scanListPage.modal).toContainText(caseNote.text)

        if (withAmendments) {
          await expect(scanListPage.modal.getByRole('heading', { name: 'More details added', level: 3 })).toBeVisible()
          await expect(scanListPage.modal).toContainText('Moved to seg')
        } else {
          await expect(
            scanListPage.modal.getByRole('heading', { name: 'More details added', level: 3 }),
          ).not.toBeVisible()
          await expect(scanListPage.modal).not.toContainText('Moved to seg')
        }

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
    }
  })

  test('Shows an error message when summary or scans didn’t load', async ({ page }) => {
    await Promise.all([
      xrayBodyScansApi.stubGetScanSummary(
        prisonerNumber,
        mockScanSummaryResponse({ prisonerNumber, now, relevantAlerts: [] }),
        { includeAlerts: true },
      ),
      xrayBodyScansApi.stubListScans(prisonerNumber, internalServerErrorResponse),
    ])

    const scanListPage = await startOnScanListPage(page)

    await expect(scanListPage.alert).toContainText('The scan history could not be loaded')
  })
})
