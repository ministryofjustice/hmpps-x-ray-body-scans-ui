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

  get returnLink(): Locator {
    return this.page.getByRole('link', { name: 'Return to the prisoner’s profile' })
  }
}
