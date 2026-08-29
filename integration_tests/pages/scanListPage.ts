import type { Locator, Page } from '@playwright/test'
import AbstractPage from './abstractPage'

export default class ScanListPage extends AbstractPage {
  static async verifyOnPage(page: Page): Promise<ScanListPage> {
    const createScanPage = new this(page)
    await createScanPage.expectHeading('X-ray body scans')
    return createScanPage
  }

  get summarySection(): Locator {
    return this.page.locator('[data-testid="scan-summary"]')
  }

  get infoBox(): Locator {
    return this.summarySection.locator('[data-testid="dps-scans-exist"]')
  }

  get countSection(): Locator {
    return this.page.locator('[data-testid="scan-count"]')
  }

  async getCurrentYearCount(): Promise<{ count: number; ariaLabel: string | null }> {
    return this.countSection.locator('.scan-count__number span').evaluate((count: HTMLSpanElement) => ({
      count: Number.parseInt(count.textContent.trim(), 10),
      ariaLabel: count.ariaLabel ?? null,
    }))
  }

  get currentYearCountWarning(): Locator {
    return this.countSection.locator('.scan-count__limit-warning')
  }

  get outcomeSection(): Locator {
    return this.page.locator('[data-testid="scan-outcome"]')
  }

  async getOutcomes(): Promise<number[]> {
    return this.outcomeSection
      .locator('.scan-outcome')
      .evaluateAll((outcomes: HTMLLIElement[]) =>
        outcomes.map(outcome => Number.parseInt(outcome.querySelector('.scan-outcome__count')!.textContent.trim(), 10)),
      )
  }

  get alertsList(): Locator {
    return this.page.locator('[data-testid="scan-alerts"] li')
  }

  get yearTabs(): Locator {
    return this.page.locator('.govuk-tabs__list li')
  }

  get historySection(): Locator {
    return this.page.locator('[data-testid="scan-history"]')
  }

  get scanTable(): Locator {
    return this.page.locator('.scan-table')
  }

  async getScanTableContents(): Promise<string[][]> {
    return this.scanTable
      .locator('.govuk-table__body tr')
      .evaluateAll((trs: HTMLTableRowElement[]) =>
        trs.map(tr => Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim())),
      )
  }

  get pagination(): Locator {
    return this.page.locator('.dps-pagination').first()
  }

  get returnLink(): Locator {
    return this.page.getByRole('link', { name: 'Return to the prisoner’s profile' })
  }
}
