import { type Page, expect, test } from '@playwright/test'
import { DEFAULT_ROLES, login, resetStubs } from '../testUtils'
import { daysAgo } from '../../server/utils/dates'
import type { ScanResponse } from '../../server/data/interfaces/xrayBodyScansApi'
import { internalServerErrorResponse, notFoundErrorResponse } from '../../server/testutils/mocks/errorResponse'
import { pageResponse } from '../../server/testutils/pagination'
import { caseloadLEI } from '../../server/testutils/mocks/prisonApi'
import { mockPrisoner } from '../../server/testutils/mocks/prisonerSearchApi'
import {
  mockScanCaseNoteResponse,
  mockScanResponse,
  mockScanSummaryResponse,
} from '../../server/testutils/mocks/xrayBodyScansApi'
import microFrontendComponents from '../mockApis/microFrontendComponents'
import prisonApi from '../mockApis/prisonApi'
import prisonRegisterApi from '../mockApis/prisonRegisterApi'
import prisonerSearchApi from '../mockApis/prisonerSearchApi'
import wpipUI from '../mockApis/wpipUI'
import xrayBodyScansApi from '../mockApis/xrayBodyScansApi'
import AddScanCaseNotePage from '../pages/addScanCaseNotePage'
import AuthErrorPage from '../pages/authErrorPage'
import ScanListPage from '../pages/scanListPage'

const prisonerNumber = 'A1234BC'
const prisoner = mockPrisoner(prisonerNumber, { currentFacialImageId: '1008971246' })
const scanId = '019f94a7-17cd-746f-b1df-5d4848da42e1'
const now = new Date()

const startAtPath = `/prisoner/${prisonerNumber}/scan/${scanId}/add-a-scan-case-note`

const scan = mockScanResponse(prisonerNumber, now)
scan.id = scanId
const caseNote = mockScanCaseNoteResponse(scan)

test.describe('Add scan case note page', () => {
  test.beforeEach(async () => {
    await Promise.all([
      microFrontendComponents.stubComponents(),
      prisonApi.stubPrisonerPhoto(prisoner.currentFacialImageId!),
      prisonerSearchApi.stubGetPrisoner(prisonerNumber, prisoner),
    ])
  })

  test.afterEach(async () => {
    await resetStubs()
  })

  async function startOnAddScanCaseNotePage(
    page: Page,
    stubScan: ScanResponse = scan,
    querystring = '',
  ): Promise<AddScanCaseNotePage> {
    await xrayBodyScansApi.stubGetScan(stubScan.id, stubScan)
    const response = await login(
      page,
      `/prisoner/${prisonerNumber}/scan/${stubScan.id}/add-a-scan-case-note${querystring}`,
    )
    expect(response?.status()).toBe(200)
    return AddScanCaseNotePage.verifyOnPage(page)
  }

  test.describe('Page display', () => {
    test('404 page when prisoner not found', async ({ page }) => {
      await Promise.all([prisonerSearchApi.stubGetPrisoner('B2222BB', notFoundErrorResponse)])

      const response = await login(page, `/prisoner/B2222BB/scan/${scanId}/add-a-scan-case-note`)

      expect(response?.status()).toBe(404)
    })

    test('404 page when scan not found', async ({ page }) => {
      await xrayBodyScansApi.stubGetScan(scanId, notFoundErrorResponse)

      const response = await login(page, startAtPath)

      expect(response?.status()).toBe(404)
    })

    test('404 page when scan already has a case note', async ({ page }) => {
      await xrayBodyScansApi.stubGetScan(scanId, { ...scan, caseNoteId: '341c845e-fadc-4ec8-9330-81c83968c1a8' })

      const response = await login(page, startAtPath)

      expect(response?.status()).toBe(404)
    })

    const scanScenarios: { scenario: string; stubScan: ScanResponse; expectedDescription: string[] }[] = [
      {
        scenario: 'negative scan',
        stubScan: {
          ...scan,
          outcome: 'NEGATIVE',
          outcomeDescription: 'No item detected',
        },
        expectedDescription: ['Reason: Reasonable suspicion', 'Result: No item detected'],
      },
      {
        scenario: 'positive scan',
        stubScan: {
          ...scan,
          justification: 'INTELLIGENCE',
          justificationDescription: 'Intelligence-led',
        },
        expectedDescription: ['Reason: Intelligence-led', 'Result: Item detected'],
      },
    ]
    for (const { scenario, stubScan, expectedDescription } of scanScenarios) {
      test(`Page shows for a ${scenario} with expected content`, async ({ page }) => {
        const addScanCaseNotePage = await startOnAddScanCaseNotePage(page, stubScan)

        // breadcrumbs
        await expect(addScanCaseNotePage.returnToWpipLink).not.toBeVisible()
        await expect(addScanCaseNotePage.getBreadcrumbs()).resolves.toEqual([
          { text: 'Digital Prison Services', href: 'http://localhost:9091/dpshomepage' },
          { text: 'Smith, John', href: `http://localhost:9091/profile/prisoner/${prisonerNumber}` },
          { text: 'X-ray body scans', href: `/prisoner/${prisonerNumber}/scan-overview` },
        ])

        // profile banner
        await expect(addScanCaseNotePage.profileBannerLink).toContainText('Smith, John')
        await expect(addScanCaseNotePage.profileBannerLink).toHaveAttribute(
          'href',
          `http://localhost:9091/profile/prisoner/${prisonerNumber}`,
        )
        await expect(addScanCaseNotePage.profileBannerPhoto).toHaveAttribute('alt', 'Photo of John Smith')
        await expect(addScanCaseNotePage.getProfileBannerProperties()).resolves.toEqual([
          {
            title: 'Location',
            description: 'A-1-205',
          },
          {
            title: 'Category',
            description: 'C',
          },
        ])

        // case note details
        await expect(addScanCaseNotePage.getSummaryList()).resolves.toEqual([
          { key: 'Type', value: 'General' },
          { key: 'Sub-type', value: 'X-ray body scan' },
          { key: 'What happened', value: expect.stringMatching(expectedDescription.join('\\s+')) },
          { key: 'Happened', value: expect.stringContaining('at 00:00') },
        ])

        // cancel link
        await expect(addScanCaseNotePage.cancelLink).toHaveAttribute(
          'href',
          `/prisoner/${prisonerNumber}/scan-overview`,
        )
      })
    }

    test('Links back to WPIP for users who came from there', async ({ page }) => {
      const addScanCaseNotePage = await startOnAddScanCaseNotePage(
        page,
        scan,
        '?wpipReturnPath=%2Frecent-arrivals%3Fsearch%3DJohn',
      )

      // breadcrumbs
      await expect(addScanCaseNotePage.returnToWpipLink).toContainText('John Smith arrival summary')
      await expect(addScanCaseNotePage.returnToWpipLink).toHaveAttribute(
        'href',
        `http://localhost:9091/welcome/recent-arrivals?search=John`,
      )

      // cancel link
      await expect(addScanCaseNotePage.cancelLink).toHaveAttribute(
        'href',
        `http://localhost:9091/welcome/recent-arrivals?search=John`,
      )

      // end WPIP journey
      await wpipUI.stubWpipRecentArrivals()
      await addScanCaseNotePage.cancelLink.click()
      await page.goto(startAtPath)
      await expect(addScanCaseNotePage.returnToWpipLink).not.toBeVisible()
    })

    test('Page inaccessible for an old scan', async ({ page }) => {
      await xrayBodyScansApi.stubGetScan(scan.id, {
        ...scan,
        scanDate: daysAgo(32),
      })
      await login(page, startAtPath)
      await AuthErrorPage.verifyOnPage(page)
    })

    function stubRecentlyLeftPrisoner(): Promise<unknown> {
      return Promise.all([
        microFrontendComponents.stubComponents({ caseLoads: [caseloadLEI] }),
        prisonerSearchApi.stubGetPrisoner(prisonerNumber, {
          ...prisoner,
          previousPrisonId: 'LEI',
          previousPrisonLeavingDate: daysAgo(5).toISOString(),
        }),
      ])
    }

    test('Page shows for a recent scan in user’s prison of a prisoner who has recently left user’s case loads who has global search and POM roles', async ({
      page,
    }) => {
      await Promise.all([
        stubRecentlyLeftPrisoner(),
        xrayBodyScansApi.stubGetScan(scan.id, {
          ...scan,
          prisonId: 'LEI',
        }),
      ])
      await login(page, startAtPath, { roles: [...DEFAULT_ROLES, 'ROLE_GLOBAL_SEARCH', 'ROLE_POM'] })

      const addScanCaseNotePage = await AddScanCaseNotePage.verifyOnPage(page)

      // profile banner
      await expect(addScanCaseNotePage.profileBannerLink).toContainText('Smith, John')
      await expect(addScanCaseNotePage.profileBannerLink).toHaveAttribute(
        'href',
        `http://localhost:9091/profile/prisoner/${prisonerNumber}`,
      )
      await expect(addScanCaseNotePage.profileBannerPhoto).toHaveAttribute(
        'aria-label',
        'Photo of John Smith is not available',
      )
      await expect(addScanCaseNotePage.getProfileBannerProperties()).resolves.toEqual([
        {
          title: 'Category',
          description: 'C',
        },
      ])
    })

    for (const { scenario, roles } of [
      { scenario: 'recently left user’s case loads', roles: DEFAULT_ROLES },
      {
        scenario: 'recently left user’s case loads even with global search and POM roles',
        roles: [...DEFAULT_ROLES, 'ROLE_GLOBAL_SEARCH', 'ROLE_POM'],
      },
    ]) {
      test(`Page for a scan in another case load is inaccessible for a prisoner who has ${scenario}`, async ({
        page,
      }) => {
        await Promise.all([stubRecentlyLeftPrisoner(), xrayBodyScansApi.stubGetScan(scan.id, scan)])
        await login(page, startAtPath, { roles })
        await AuthErrorPage.verifyOnPage(page)
      })
    }
  })

  test.describe('Adding a case note successfully', () => {
    async function stubScanListPage() {
      return Promise.all([
        prisonRegisterApi.stubAllPrisons(),
        xrayBodyScansApi.stubGetScanSummary(
          prisonerNumber,
          mockScanSummaryResponse({ prisonerNumber, now, relevantAlerts: [] }),
        ),
        xrayBodyScansApi.stubListScans(
          prisonerNumber,
          pageResponse([
            { ...mockScanResponse(prisonerNumber, now), id: '019fc832-0000-7000-0000-000000000001' },
            scan,
          ]),
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
      const addScanCaseNotePage = await startOnAddScanCaseNotePage(page)

      await xrayBodyScansApi.stubCreateScanCaseNote(
        scanId,
        {
          text: `
Reason: Reasonable suspicion
Result: Item detected
        `.trim(),
          prisonId: 'MDI',
        },
        caseNote,
      )
      await stubScanListPage()
      await addScanCaseNotePage.saveButton.click()

      await expectCaseNoteSaved(page)
    })

    test('Saves case note with additional details', async ({ page }) => {
      const addScanCaseNotePage = await startOnAddScanCaseNotePage(page)

      await xrayBodyScansApi.stubCreateScanCaseNote(
        scanId,
        {
          text: `
Reason: Reasonable suspicion
Result: Item detected
--
Some extra details
        `.trim(),
          prisonId: 'MDI',
        },
        caseNote,
      )
      await stubScanListPage()
      await addScanCaseNotePage.additionalDetailsInput.fill('Some extra details')
      await addScanCaseNotePage.saveButton.click()

      await expectCaseNoteSaved(page)
    })

    test('Returns the user to the list page preserving filters', async ({ page }) => {
      const addScanCaseNotePage = await startOnAddScanCaseNotePage(page, scan, '?year=all&sort=scanDate')

      await xrayBodyScansApi.stubCreateScanCaseNote(scanId, undefined, caseNote)

      await stubScanListPage()
      await addScanCaseNotePage.saveButton.click()

      const scanListPage = await expectCaseNoteSaved(page, '?year=all&sort=scanDate')
      await expect(
        scanListPage.historySection.getByRole('heading', { name: 'All scans recorded', level: 3 }),
      ).toBeVisible()
    })
  })

  test.describe('Errors when adding a case note', () => {
    test('Shows validation error when additional details exceeds 3500 characters', async ({ page }) => {
      const addScanCaseNotePage = await startOnAddScanCaseNotePage(page)

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
      const addScanCaseNotePage = await startOnAddScanCaseNotePage(page)

      await xrayBodyScansApi.stubCreateScanCaseNote(scanId, undefined, internalServerErrorResponse)
      await addScanCaseNotePage.saveButton.click()

      await expect(addScanCaseNotePage.alert).toContainText('The case note could not be saved')
    })
  })
})
