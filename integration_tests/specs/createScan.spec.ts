import { expect, test } from '@playwright/test'
import { login, resetStubs } from '../testUtils'
import { formatIsoDate } from '../../server/utils/dates'
import { mockScanResponse } from '../../server/testutils/mocks/xrayBodyScansApiClient'
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

  test('Can record a negative scan', async ({ page }) => {
    const now = new Date()
    await login(page)

    await page.goto(`/prisoner/${prisonerNumber}/record-scan`)
    const createScanPage = await CreateScanPage.verifyOnPage(page, 'John Smith')

    await createScanPage.checkRadioButton('Today')
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

    const response = {
      ...mockScanResponse(prisonerNumber, now),
      justification: 'INTELLIGENCE',
      justificationDescription: 'INTELLIGENCE',
      outcome: 'NEGATIVE',
      outcomeDescription: 'NEGATIVE',
      typeOfFind: null,
      typeOfFindDescription: null,
    }
    await xrayBodyScansApi.stubCreateScan(
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
    )

    await createScanPage.saveButton.click()
    await CreateScanSuccessPage.verifyOnPage(page)
  })
})
