import { type Page, expect, test } from '@playwright/test'
import { DEFAULT_ROLES, login, resetStubs } from '../testUtils'
import { formatIsoDate } from '../../server/utils/dates'
import type { ScanResponse } from '../../server/data/interfaces/xrayBodyScansApi'
import { badRequestErrorResponse } from '../../server/testutils/mocks/errorResponse'
import {
  mockDoNotScanAlert,
  mockInternalSecretorAlert,
  mockScanResponse,
  mockScanSummaryResponse,
} from '../../server/testutils/mocks/xrayBodyScansApi'
import microFrontendComponents from '../mockApis/microFrontendComponents'
import prisonerSearchApi from '../mockApis/prisonerSearchApi'
import wpipUI from '../mockApis/wpipUI'
import xrayBodyScansApi from '../mockApis/xrayBodyScansApi'
import CreateScanPage from '../pages/createScanPage'
import CreateScanSuccessPage from '../pages/createScanSuccessPage'

const prisonerNumber = 'A1234BC'

test.describe('Create scan page', () => {
  test.beforeEach(async () => {
    await Promise.all([microFrontendComponents.stubComponents(), prisonerSearchApi.stubGetPrisoner(prisonerNumber)])
  })

  test.afterEach(async () => {
    await resetStubs()
  })

  async function goToCreateScanPage(page: Page, querystring = ''): Promise<CreateScanPage> {
    const response = await page.goto(`/prisoner/${prisonerNumber}/record-scan${querystring}`)
    expect(response?.status()).toBe(200)
    return CreateScanPage.verifyOnPage(page, 'John Smith')
  }

  test('Page shows', async ({ page }) => {
    await login(page)

    const createScanPage = await goToCreateScanPage(page)

    // breadcrumbs
    await expect(createScanPage.returnToWpipLink).not.toBeVisible()
    await expect(createScanPage.getBreadcrumbs()).resolves.toEqual([
      { text: 'Digital Prison Services', href: 'http://localhost:9091/dpshomepage' },
      { text: 'Smith, John', href: `http://localhost:9091/profile/prisoner/${prisonerNumber}` },
      { text: 'X-ray body scans', href: `/prisoner/${prisonerNumber}/scan-overview` },
    ])

    // nothing is pre-selected
    await expect(createScanPage.getFormValues()).resolves.toEqual(
      expect.not.objectContaining({
        scanDateOption: expect.anything(),
        justification: expect.anything(),
        outcome: expect.anything(),
      }),
    )

    // cancel link
    await expect(createScanPage.cancelLink).toContainText('Cancel')
    await expect(createScanPage.cancelLink).toHaveAttribute('href', `/prisoner/${prisonerNumber}/scan-overview`)
  })

  test('Links back to WPIP for users who came from there', async ({ page }) => {
    await login(page)

    const createScanPage = await goToCreateScanPage(page, '?wpipReturnPath=%2Frecent-arrivals%3Fsearch%3DJohn')

    // breadcrumbs
    await expect(createScanPage.returnToWpipLink).toContainText('Return to recent arrivals')
    await expect(createScanPage.returnToWpipLink).toHaveAttribute(
      'href',
      `http://localhost:9091/welcome/recent-arrivals?search=John`,
    )

    // cancel link
    await expect(createScanPage.cancelLink).toContainText('Return to recent arrivals')
    await expect(createScanPage.cancelLink).toHaveAttribute(
      'href',
      `http://localhost:9091/welcome/recent-arrivals?search=John`,
    )

    // end WPIP journey
    await wpipUI.stubWpipRecentArrivals()
    await createScanPage.cancelLink.click()
    await goToCreateScanPage(page)
    await expect(createScanPage.returnToWpipLink).not.toBeVisible()
  })

  test.describe('Recording a scan successfully', () => {
    async function expectSuccessPage(page: Page, linksBackToWpip = false): Promise<CreateScanSuccessPage> {
      const createScanSuccessPage = await CreateScanSuccessPage.verifyOnPage(page)

      // no breadcrumbs
      await expect(createScanSuccessPage.breadcrumbs).not.toBeVisible()

      // links
      if (linksBackToWpip) {
        await expect(createScanSuccessPage.returnButton).toContainText('Return to recent arrivals')
        await expect(createScanSuccessPage.returnButton).toHaveAttribute(
          'href',
          `http://localhost:9091/welcome/recent-arrivals?search=John`,
        )
      } else {
        await expect(createScanSuccessPage.returnButton).toContainText('Return to X-ray body scans')
        await expect(createScanSuccessPage.returnButton).toHaveAttribute(
          'href',
          `/prisoner/${prisonerNumber}/scan-overview`,
        )
      }
      await expect(createScanSuccessPage.viewProfileLink).toHaveAttribute(
        'href',
        `http://localhost:9091/profile/prisoner/${prisonerNumber}`,
      )

      return createScanSuccessPage
    }

    test('Can record a negative scan for today', async ({ page }) => {
      const now = new Date()
      await login(page)

      const createScanPage = await goToCreateScanPage(page)

      await createScanPage.checkRadioButton('Today', { exact: false })
      await createScanPage.checkRadioButton('Intelligence-led')
      await createScanPage.checkRadioButton('No item detected')

      // radio buttons selected
      await expect(createScanPage.getFormValues()).resolves.toEqual(
        expect.objectContaining({
          scanDateOption: 'today',
          justification: 'INTELLIGENCE',
          outcome: 'NEGATIVE',
        }),
      )

      const response: ScanResponse = {
        ...mockScanResponse(prisonerNumber, now),
        justification: 'INTELLIGENCE',
        justificationDescription: 'Intelligence-led',
        outcome: 'NEGATIVE',
        outcomeDescription: 'Negative',
      }
      await Promise.all([
        xrayBodyScansApi.stubCreateScan(
          prisonerNumber,
          {
            prisonId: 'MDI',
            scanDate: formatIsoDate(now),
            justification: 'INTELLIGENCE',
            outcome: 'NEGATIVE',
            createdBy: 'USER1',
          },
          response,
        ),
        xrayBodyScansApi.stubGetScanSummary(
          prisonerNumber,
          mockScanSummaryResponse({
            prisonerNumber,
            now,
            relevantAlerts: [],
          }),
          { includeAlerts: true },
        ),
      ])

      await createScanPage.saveButton.click()

      const createScanSuccessPage = await expectSuccessPage(page)

      await expect(createScanSuccessPage.panel).toContainText('Name: John Smith')
      await expect(createScanSuccessPage.getSummaryList()).resolves.toEqual([
        { key: 'Date', value: expect.stringContaining(String(now.getFullYear())) },
        { key: 'Reason', value: 'Intelligence-led' },
        { key: 'Result', value: 'Negative' },
      ])
      await expect(createScanSuccessPage.internalSecretorAlert).not.toBeVisible()
    })

    test('Can record a positive scan on another date', async ({ page }) => {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      yesterday.setHours(12, 0, 0, 0)
      const yesterdayString = formatIsoDate(yesterday)
      const [yesterdayYear, yesterdayMonth, yesterdayDay] = yesterdayString
        .split('-')
        .map(component => component.replace(/^0+/, ''))

      await login(page)

      const createScanPage = await goToCreateScanPage(page)

      await createScanPage.checkRadioButton('Another date')
      await createScanPage.typeScanDateComponent('Day', yesterdayDay)
      await createScanPage.typeScanDateComponent('Month', yesterdayMonth)
      await createScanPage.typeScanDateComponent('Year', yesterdayYear)
      await createScanPage.checkRadioButton('Reasonable suspicion')
      await createScanPage.checkRadioButton('Item detected')

      // radio buttons selected
      await expect(createScanPage.getFormValues()).resolves.toEqual(
        expect.objectContaining({
          scanDateOption: 'other',
          justification: 'REASONABLE_SUSPICION',
          outcome: 'POSITIVE',
        }),
      )

      const response: ScanResponse = {
        ...mockScanResponse(prisonerNumber, yesterday),
        justification: 'REASONABLE_SUSPICION',
        justificationDescription: 'Reasonable suspicion',
        outcome: 'POSITIVE',
        outcomeDescription: 'Positive',
      }
      await Promise.all([
        xrayBodyScansApi.stubCreateScan(
          prisonerNumber,
          {
            prisonId: 'MDI',
            scanDate: yesterdayString,
            justification: 'REASONABLE_SUSPICION',
            outcome: 'POSITIVE',
            createdBy: 'USER1',
          },
          response,
        ),
        xrayBodyScansApi.stubGetScanSummary(
          prisonerNumber,
          mockScanSummaryResponse({
            prisonerNumber,
            now: new Date(),
            relevantAlerts: [mockDoNotScanAlert],
          }),
          { includeAlerts: true },
        ),
      ])

      await createScanPage.saveButton.click()

      const createScanSuccessPage = await expectSuccessPage(page)

      await expect(createScanSuccessPage.panel).toContainText('Name: John Smith')
      await expect(createScanSuccessPage.getSummaryList()).resolves.toEqual([
        { key: 'Date', value: expect.stringContaining(String(yesterday.getFullYear())) },
        { key: 'Reason', value: 'Reasonable suspicion' },
        { key: 'Result', value: 'Positive' },
      ])
      await expect(createScanSuccessPage.internalSecretorAlert).not.toBeVisible()
    })

    for (const { scenario, hasUpdateAlertRole } of [
      { scenario: 'view it', hasUpdateAlertRole: false },
      { scenario: 'edit it', hasUpdateAlertRole: true },
    ]) {
      test(`Can record a scan for someone with the internal secretor alert and ${scenario}`, async ({ page }) => {
        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        yesterday.setHours(12, 0, 0, 0)

        const roles = [...DEFAULT_ROLES]
        if (hasUpdateAlertRole) {
          roles.push('ROLE_UPDATE_ALERT')
        }
        await login(page, { roles })

        const createScanPage = await goToCreateScanPage(page)

        await createScanPage.checkRadioButton('Yesterday', { exact: false })
        await createScanPage.checkRadioButton('Intelligence-led')
        await createScanPage.checkRadioButton('No item detected')

        // radio buttons selected
        await expect(createScanPage.getFormValues()).resolves.toEqual(
          expect.objectContaining({
            scanDateOption: 'yesterday',
            justification: 'INTELLIGENCE',
            outcome: 'NEGATIVE',
          }),
        )

        const response: ScanResponse = {
          ...mockScanResponse(prisonerNumber, yesterday),
          justification: 'INTELLIGENCE',
          justificationDescription: 'Intelligence-led',
          outcome: 'NEGATIVE',
          outcomeDescription: 'Negative',
        }
        await Promise.all([
          xrayBodyScansApi.stubCreateScan(
            prisonerNumber,
            {
              prisonId: 'MDI',
              scanDate: formatIsoDate(yesterday),
              justification: 'INTELLIGENCE',
              outcome: 'NEGATIVE',
              createdBy: 'USER1',
            },
            response,
          ),
          xrayBodyScansApi.stubGetScanSummary(
            prisonerNumber,
            mockScanSummaryResponse({
              prisonerNumber,
              now: new Date(),
              relevantAlerts: [mockInternalSecretorAlert],
            }),
            { includeAlerts: true },
          ),
        ])

        await createScanPage.saveButton.click()

        const createScanSuccessPage = await expectSuccessPage(page)

        if (hasUpdateAlertRole) {
          await expect(createScanSuccessPage.internalSecretorAlertLink).toContainText('Update internal secretor alert')
          await expect(createScanSuccessPage.internalSecretorAlertLink).toHaveAttribute(
            'href',
            `http://localhost:9091/profile/prisoner/${prisonerNumber}/alerts/${mockInternalSecretorAlert.id}/add-more-details`,
          )
        } else {
          await expect(createScanSuccessPage.internalSecretorAlertLink).toContainText('View the alert details')
          await expect(createScanSuccessPage.internalSecretorAlertLink).toHaveAttribute(
            'href',
            `http://localhost:9091/profile/prisoner/${prisonerNumber}/alerts/detail?ids=${mockInternalSecretorAlert.id}`,
          )
        }
      })
    }

    test('Can record a scan and link back to WPIP for users who came from there', async ({ page }) => {
      const now = new Date()
      await login(page)

      let createScanPage = await goToCreateScanPage(page, '?wpipReturnPath=%2Frecent-arrivals%3Fsearch%3DJohn')

      await createScanPage.checkRadioButton('Today', { exact: false })
      await createScanPage.checkRadioButton('Intelligence-led')
      await createScanPage.checkRadioButton('No item detected')

      const response: ScanResponse = {
        ...mockScanResponse(prisonerNumber, now),
        justification: 'INTELLIGENCE',
        justificationDescription: 'Intelligence-led',
        outcome: 'NEGATIVE',
        outcomeDescription: 'Negative',
      }
      await Promise.all([
        xrayBodyScansApi.stubCreateScan(
          prisonerNumber,
          {
            prisonId: 'MDI',
            scanDate: formatIsoDate(now),
            justification: 'INTELLIGENCE',
            outcome: 'NEGATIVE',
            createdBy: 'USER1',
          },
          response,
        ),
        xrayBodyScansApi.stubGetScanSummary(
          prisonerNumber,
          mockScanSummaryResponse({
            prisonerNumber,
            now,
            relevantAlerts: [],
          }),
          { includeAlerts: true },
        ),
      ])

      await createScanPage.saveButton.click()

      const createScanSuccessPage = await expectSuccessPage(page, true)

      // end WPIP journey
      await wpipUI.stubWpipRecentArrivals()
      await createScanSuccessPage.returnButton.click()
      createScanPage = await goToCreateScanPage(page)
      await expect(createScanPage.returnToWpipLink).not.toBeVisible()
    })
  })

  test.describe('Errors when recording a scan', () => {
    test('Shows an error message when one required field was not selected', async ({ page }) => {
      await login(page)

      let createScanPage = await goToCreateScanPage(page)

      await createScanPage.checkRadioButton('Today', { exact: false })
      await createScanPage.checkRadioButton('Intelligence-led')
      // outcome not selected

      await createScanPage.saveButton.click()

      createScanPage = await CreateScanPage.verifyOnPage(page, 'John Smith')

      // error summary shows
      await expect(createScanPage.getErrorSummary()).resolves.toEqual([
        { text: 'Select the result of the scan', href: '#outcome' },
      ])
      await expect(createScanPage.alert).not.toBeVisible()

      // user-entered details reappear
      await expect(createScanPage.getFormValues()).resolves.toEqual(
        expect.objectContaining({
          scanDateOption: 'today',
          justification: 'INTELLIGENCE',
        }),
      )
    })

    test('Shows an error messages when there are several errors', async ({ page }) => {
      await login(page)

      let createScanPage = await goToCreateScanPage(page)

      await createScanPage.checkRadioButton('Another date')
      await createScanPage.typeScanDateComponent('Month', 'July')
      await createScanPage.typeScanDateComponent('Year', '2026')
      // invalid date
      await createScanPage.checkRadioButton('Reasonable suspicion')
      // outcome not selected

      await createScanPage.saveButton.click()

      createScanPage = await CreateScanPage.verifyOnPage(page, 'John Smith')

      // error summary shows
      await expect(createScanPage.getErrorSummary()).resolves.toEqual([
        { text: 'Enter a real date', href: '#scanDate' },
        { text: 'Select the result of the scan', href: '#outcome' },
      ])
      await expect(createScanPage.alert).not.toBeVisible()
      // errors messages show
      await expect(createScanPage.scanDateConditional).toContainText('Enter a real date')
      await expect(createScanPage.getScanDateComponentErrors()).resolves.toEqual({
        day: true,
        month: true,
        year: false,
      })
      await expect(createScanPage.justificationFormGroup).not.toContainText('Select why the scan was carried out')
      await expect(createScanPage.outcomeFormGroup).toContainText('Select the result of the scan')

      // user-entered details reappear, even if invalid
      await expect(createScanPage.getFormValues()).resolves.toEqual(
        expect.objectContaining({
          scanDateOption: 'other',
          'scanDate-day': '',
          'scanDate-month': 'July',
          'scanDate-year': '2026',
          justification: 'REASONABLE_SUSPICION',
        }),
      )
    })

    test('Shows an error message when api call fails', async ({ page }) => {
      await login(page)

      let createScanPage = await goToCreateScanPage(page)

      await createScanPage.checkRadioButton('Today', { exact: false })
      await createScanPage.checkRadioButton('Intelligence-led')
      await createScanPage.checkRadioButton('No item detected')

      // simulate 400 bad response (eg. if api contract changed but ui has not been updated)
      await xrayBodyScansApi.stubCreateScan(
        prisonerNumber,
        {
          prisonId: 'MDI',
          scanDate: formatIsoDate(new Date()),
          justification: 'INTELLIGENCE',
          outcome: 'NEGATIVE',
          createdBy: 'USER1',
        },
        badRequestErrorResponse,
      )

      await createScanPage.saveButton.click()

      createScanPage = await CreateScanPage.verifyOnPage(page, 'John Smith')

      // error alert shows, but not error summary
      await expect(createScanPage.getErrorSummary()).resolves.toBeNull()
      await expect(createScanPage.alert).toContainText('The details could not be recorded')
    })
  })
})
