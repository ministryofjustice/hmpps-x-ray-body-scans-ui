import { expect, test } from '@playwright/test'
import { login, resetStubs } from '../testUtils'
import { formatIsoDate } from '../../server/utils/dates'
import type { ScanResponse } from '../../server/data/interfaces/xrayBodyScansApiClient'
import { badRequestErrorResponse } from '../../server/testutils/mocks/errorResponse'
import {
  mockDoNotScanAlert,
  mockInternalSecretorAlert,
  mockScanResponse,
  mockScanSummaryResponse,
} from '../../server/testutils/mocks/xrayBodyScansApiClient'
import microFrontendComponents from '../mockApis/microFrontendComponents'
import prisonerSearchApi from '../mockApis/prisonerSearchApi'
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

  test('Page shows', async ({ page }) => {
    await login(page)

    const response = await page.goto(`/prisoner/${prisonerNumber}/record-scan`)
    expect(response?.status()).toBe(200)

    const createScanPage = await CreateScanPage.verifyOnPage(page, 'John Smith')

    await expect(createScanPage.getBreadcrumbs()).resolves.toEqual([
      { text: 'Digital Prison Services', href: 'http://localhost:9091/dpshomepage' },
      { text: 'Smith, John', href: `http://localhost:9091/profile/prisoner/${prisonerNumber}` },
      { text: 'X-ray body scans', href: `/prisoner/${prisonerNumber}/scans` },
    ])

    // nothing is pre-selected
    await expect(createScanPage.getFormValues()).resolves.toEqual(
      expect.not.objectContaining({
        scanDateOption: expect.anything(),
        justification: expect.anything(),
        outcome: expect.anything(),
        typeOfFind: expect.anything(),
      }),
    )

    await expect(createScanPage.cancelLink).toHaveAttribute('href', `/prisoner/${prisonerNumber}/scans`)
  })

  test('Can record a negative scan for today', async ({ page }) => {
    const now = new Date()
    await login(page)

    await page.goto(`/prisoner/${prisonerNumber}/record-scan`)
    const createScanPage = await CreateScanPage.verifyOnPage(page, 'John Smith')

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
      typeOfFind: null,
      typeOfFindDescription: null,
    }
    await Promise.all([
      xrayBodyScansApi.stubCreateScan(
        prisonerNumber,
        {
          prisonId: 'LEI',
          scanDate: formatIsoDate(now),
          justification: 'INTELLIGENCE',
          outcome: 'NEGATIVE',
          typeOfFind: null,
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
      ),
    ])

    await createScanPage.saveButton.click()

    const createScanSuccessPage = await CreateScanSuccessPage.verifyOnPage(page)

    await expect(createScanSuccessPage.panel).toContainText('Name: John Smith')
    await expect(createScanSuccessPage.getSummaryList()).resolves.toEqual([
      { key: 'Date', value: expect.stringContaining(String(now.getFullYear())) },
      { key: 'Reason', value: 'Intelligence-led' },
      { key: 'Result', value: 'Negative' },
      { key: 'Items found', value: 'None' },
    ])
    await expect(createScanSuccessPage.internalSecretorAlertCreatedNote).not.toBeVisible()
    await expect(createScanSuccessPage.updateInternalSecretorAlertLink).not.toBeVisible()
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

    await page.goto(`/prisoner/${prisonerNumber}/record-scan`)
    const createScanPage = await CreateScanPage.verifyOnPage(page, 'John Smith')

    await createScanPage.checkRadioButton('Another date')
    await createScanPage.typeScanDateComponent('Day', yesterdayDay)
    await createScanPage.typeScanDateComponent('Month', yesterdayMonth)
    await createScanPage.typeScanDateComponent('Year', yesterdayYear)
    await createScanPage.checkRadioButton('Reasonable suspicion')
    await createScanPage.checkRadioButton('Item detected')
    await createScanPage.checkRadioButton('Inorganic')

    // radio buttons selected
    await expect(createScanPage.getFormValues()).resolves.toEqual(
      expect.objectContaining({
        scanDateOption: 'other',
        justification: 'REASONABLE_SUSPICION',
        outcome: 'POSITIVE',
        typeOfFind: 'INORGANIC',
      }),
    )

    const response: ScanResponse = {
      ...mockScanResponse(prisonerNumber, yesterday),
      justification: 'REASONABLE_SUSPICION',
      justificationDescription: 'Reasonable suspicion',
      outcome: 'POSITIVE',
      outcomeDescription: 'Positive',
      typeOfFind: 'INORGANIC',
      typeOfFindDescription: 'Inorganic',
    }
    await Promise.all([
      xrayBodyScansApi.stubCreateScan(
        prisonerNumber,
        {
          prisonId: 'LEI',
          scanDate: yesterdayString,
          justification: 'REASONABLE_SUSPICION',
          outcome: 'POSITIVE',
          typeOfFind: 'INORGANIC',
          createdBy: 'USER1',
        },
        response,
      ),
      xrayBodyScansApi.stubGetScanSummary(
        prisonerNumber,
        mockScanSummaryResponse({
          prisonerNumber,
          now: new Date(),
          relevantAlerts: [mockInternalSecretorAlert, mockDoNotScanAlert],
        }),
      ),
    ])

    await createScanPage.saveButton.click()

    const createScanSuccessPage = await CreateScanSuccessPage.verifyOnPage(page)

    await expect(createScanSuccessPage.panel).toContainText('Name: John Smith')
    await expect(createScanSuccessPage.getSummaryList()).resolves.toEqual([
      { key: 'Date', value: expect.stringContaining(String(yesterday.getFullYear())) },
      { key: 'Reason', value: 'Reasonable suspicion' },
      { key: 'Result', value: 'Positive' },
      { key: 'Items found', value: 'Inorganic' },
    ])
    await expect(createScanSuccessPage.internalSecretorAlertCreatedNote).not.toBeVisible()
    await expect(createScanSuccessPage.updateInternalSecretorAlertLink).toHaveAttribute(
      'href',
      `http://localhost:9091/profile/prisoner/${prisonerNumber}/alerts/${mockInternalSecretorAlert.id}/add-more-details`,
    )
  })

  test('Shows an error message when one required field was not selected', async ({ page }) => {
    await login(page)

    await page.goto(`/prisoner/${prisonerNumber}/record-scan`)
    let createScanPage = await CreateScanPage.verifyOnPage(page, 'John Smith')

    await createScanPage.checkRadioButton('Today', { exact: false })
    await createScanPage.checkRadioButton('Intelligence-led')
    // outcome not selected

    await createScanPage.saveButton.click()

    createScanPage = await CreateScanPage.verifyOnPage(page, 'John Smith')

    // errors summary shows
    await expect(createScanPage.getErrorSummary()).resolves.toEqual([
      { text: 'Select the result of the scan', href: '#outcome' },
    ])

    // user-entered details reappear
    await expect(createScanPage.getFormValues()).resolves.toEqual(
      expect.objectContaining({
        scanDateOption: 'today',
        justification: 'INTELLIGENCE',
      }),
    )
  })

  test('Shows a error messages when there are several errors', async ({ page }) => {
    await login(page)

    await page.goto(`/prisoner/${prisonerNumber}/record-scan`)
    let createScanPage = await CreateScanPage.verifyOnPage(page, 'John Smith')

    await createScanPage.checkRadioButton('Another date')
    await createScanPage.typeScanDateComponent('Month', 'July')
    await createScanPage.typeScanDateComponent('Year', '2026')
    // invalid date
    await createScanPage.checkRadioButton('Reasonable suspicion')
    await createScanPage.checkRadioButton('Item detected')
    // type of find not selected

    await createScanPage.saveButton.click()

    createScanPage = await CreateScanPage.verifyOnPage(page, 'John Smith')

    // errors summary shows
    await expect(createScanPage.getErrorSummary()).resolves.toEqual([
      { text: 'Enter a real date', href: '#scanDate' },
      { text: 'Select type of item detected', href: '#typeOfFind' },
    ])

    // user-entered details reappear, even if invalid
    await expect(createScanPage.getFormValues()).resolves.toEqual(
      expect.objectContaining({
        scanDateOption: 'other',
        'scanDate-day': '',
        'scanDate-month': 'July',
        'scanDate-year': '2026',
        justification: 'REASONABLE_SUSPICION',
        outcome: 'POSITIVE',
      }),
    )
  })

  test('Shows an error message when api call fails', async ({ page }) => {
    await login(page)

    await page.goto(`/prisoner/${prisonerNumber}/record-scan`)
    let createScanPage = await CreateScanPage.verifyOnPage(page, 'John Smith')

    await createScanPage.checkRadioButton('Today', { exact: false })
    await createScanPage.checkRadioButton('Intelligence-led')
    await createScanPage.checkRadioButton('No item detected')

    // simulate 400 bad response (eg. if api contract changed but ui has not been updated)
    await xrayBodyScansApi.stubCreateScan(
      prisonerNumber,
      {
        prisonId: 'LEI',
        scanDate: formatIsoDate(new Date()),
        justification: 'INTELLIGENCE',
        outcome: 'NEGATIVE',
        typeOfFind: null,
        createdBy: 'USER1',
      },
      badRequestErrorResponse,
    )

    await createScanPage.saveButton.click()

    createScanPage = await CreateScanPage.verifyOnPage(page, 'John Smith')

    // errors summary shows, but cannot point to a specific field
    await expect(createScanPage.getErrorSummary()).resolves.toEqual([
      { text: 'The details could not be recorded. Try again later', href: '#form' },
    ])
  })
})
