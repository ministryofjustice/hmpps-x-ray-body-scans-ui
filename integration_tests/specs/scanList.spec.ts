import { type Page, expect, test } from '@playwright/test'
import { formatDisplayDate } from '../../server/utils/dates'
import { notFoundErrorResponse } from '../../server/testutils/mocks/errorResponse'
import { emptyPageResponse, pageResponse } from '../../server/testutils/pagination'
import {
  mockDoNotScanAlert,
  mockInternalSecretorAlert,
  mockLegacyScanResponse,
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
const nowDisplay = formatDisplayDate(now)
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

  test('404 page when prisoner not found', async ({ page }) => {
    await prisonerSearchApi.stubGetPrisoner('B2222BB', notFoundErrorResponse)
    await login(page)

    const response = await page.goto('/prisoner/B2222BB/scan-overview')

    expect(response?.status()).toBe(404)
  })

  async function goToScanListPage(page: Page): Promise<ScanListPage> {
    const response = await page.goto(`/prisoner/${prisonerNumber}/scan-overview`)
    expect(response?.status()).toBe(200)
    return ScanListPage.verifyOnPage(page)
  }

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
  for (const { scenario, yearTabIndex, listScanRequest, expectedSubheading, expectedNoScansMessage } of tabScenarios) {
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
        xrayBodyScansApi.stubListScans(prisonerNumber, emptyPageResponse(), {}),
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
      await xrayBodyScansApi.stubListScans(
        prisonerNumber,
        pageResponse([mockScanResponse(prisonerNumber, now)]),
        listScanRequest,
      )

      await scanListPage.yearTabs.nth(yearTabIndex).getByRole('link').click()

      await expect(
        scanListPage.historySection.getByRole('heading', { name: expectedSubheading, level: 3 }),
      ).toBeVisible()
      await expect(scanListPage.scanTable).toBeVisible()
      await expect(scanListPage.historySection).not.toContainText(expectedNoScansMessage)

      // mock no filtered scans
      await xrayBodyScansApi.stubListScans(prisonerNumber, emptyPageResponse(), listScanRequest)

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
            prisonId: 'LEI',
            justification: 'REASONABLE_SUSPICION',
            justificationDescription: 'Reasonable suspicion',
            outcome: 'POSITIVE',
            outcomeDescription: 'Item detected',
            typeOfFind: 'INORGANIC',
            typeOfFindDescription: 'Inorganic',
            caseNoteId: '019f94a7-17cd-746f-b1df-5d4848da42e1',
          },
          {
            ...mockScanResponse(prisonerNumber, now),
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
            prisonId: 'MDI',
            justification: 'INTELLIGENCE',
            justificationDescription: 'Intelligence-led',
            outcome: 'INCONCLUSIVE',
            outcomeDescription: 'Inconclusive',
            typeOfFind: null,
            typeOfFindDescription: null,
          },
          mockLegacyScanResponse(prisonerNumber, now),
          mockLegacyScanResponse(prisonerNumber, null, 'positive'),
        ]),
        {},
      ),
      login(page),
    ])

    const scanListPage = await goToScanListPage(page)
    await expect(scanListPage.getScanTableContents()).resolves.toEqual([
      [nowDisplay, 'Leeds (HMP & YOI)', 'Reasonable suspicion', 'Item detected', 'Organic', 'Add case note'],
      [nowDisplay, 'Leeds (HMP & YOI)', 'Reasonable suspicion', 'Item detected', 'Inorganic', 'View case note'],
      [nowDisplay, 'Leeds (HMP & YOI)', 'Intelligence-led', 'Item detected', 'Organic and inorganic', 'Add case note'],
      [nowDisplay, 'Leeds (HMP & YOI)', 'Reasonable suspicion', 'Item detected', 'Not known', 'Add case note'],
      [nowDisplay, 'Leeds (HMP & YOI)', 'Reasonable suspicion', 'No item detected', 'None', 'Add case note'],
      [nowDisplay, 'Moorland (HMP & YOI)', 'Intelligence-led', 'Inconclusive', 'None', 'Add case note'],
      [nowDisplay, '', '', '', '', ''],
      ['Not recorded', '', '', 'positive', '', ''],
    ])
  })

  // TODO: what shows if summary and/or list do not load?
})
