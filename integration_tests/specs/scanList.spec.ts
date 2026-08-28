import { type Page, expect, test } from '@playwright/test'
import { notFoundErrorResponse } from '../../server/testutils/mocks/errorResponse'
import {
  mockDoNotScanAlert,
  mockInternalSecretorAlert,
  mockScanSummaryResponse,
} from '../../server/testutils/mocks/xrayBodyScansApi'
import { login, resetStubs } from '../testUtils'
import microFrontendComponents from '../mockApis/microFrontendComponents'
import prisonRegisterApi from '../mockApis/prisonRegisterApi'
import prisonerSearchApi from '../mockApis/prisonerSearchApi'
import xrayBodyScansApi from '../mockApis/xrayBodyScansApi'
import ScanListPage from '../pages/scanListPage'

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
        mockScanSummaryResponse({ prisonerNumber, now: new Date(), relevantAlerts: [] }),
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
    const currentYear = `${new Date().getFullYear()}`
    await Promise.all([
      expect(
        scanListPage.summarySection.getByRole('heading', { name: 'X-ray body scans recorded in', level: 2 }),
      ).toContainText(currentYear),
      expect(scanListPage.countSection.getByRole('heading', { name: 'Scans in', level: 3 })).toContainText(currentYear),
    ])

    await expect(scanListPage.returnLink).toHaveAttribute(
      'href',
      `http://localhost:9091/profile/prisoner/${prisonerNumber}`,
    )
  })

  const summaryScenarios = [
    {
      scenario: 'with no scans',
      scanSummary: mockScanSummaryResponse({ prisonerNumber, now: new Date(), relevantAlerts: [] }),
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
      scanSummary: mockScanSummaryResponse({ prisonerNumber, now: new Date(), nomisCount: 1, relevantAlerts: [] }),
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
        now: new Date(),
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
        now: new Date(),
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
        now: new Date(),
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
      scanSummary: mockScanSummaryResponse({ prisonerNumber, now: new Date(), relevantAlerts: [] }),
      expectedAlertFlags: ['No scan alerts'],
    },
    {
      scenario: 'with an internal secretor alert',
      scanSummary: mockScanSummaryResponse({
        prisonerNumber,
        now: new Date(),
        relevantAlerts: [mockInternalSecretorAlert],
      }),
      expectedAlertFlags: ['Internal Secretor'],
    },
    {
      scenario: 'with both relevant alerts',
      scanSummary: mockScanSummaryResponse({
        prisonerNumber,
        now: new Date(),
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

  // TODO: what shows if summary and/or list do not load?
})
