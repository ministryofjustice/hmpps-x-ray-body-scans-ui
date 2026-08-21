import type { Locator, Page } from '@playwright/test'
import AbstractPage from './abstractPage'

export default class CreateScanSuccessPage extends AbstractPage {
  static async verifyOnPage(page: Page): Promise<CreateScanSuccessPage> {
    const createScanSuccessPage = new this(page)
    await createScanSuccessPage.expectHeading('Scan recorded')
    return createScanSuccessPage
  }

  get panel(): Locator {
    return this.page.locator('.govuk-panel--confirmation')
  }

  getSummaryList(): Promise<SummaryListItem[]> {
    return this.page.locator('.govuk-summary-list__row').evaluateAll<SummaryListItem[], void, HTMLDivElement>(rows =>
      rows.map(row => {
        const key = row.getElementsByClassName('govuk-summary-list__key').item(0)?.textContent?.trim()
        const value = row.getElementsByClassName('govuk-summary-list__value').item(0)?.textContent?.trim()
        return { key, value }
      }),
    )
  }
}

interface SummaryListItem {
  key: string | undefined
  value: string | undefined
}
