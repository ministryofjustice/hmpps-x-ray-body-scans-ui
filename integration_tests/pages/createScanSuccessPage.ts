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

  get internalSecretorAlert(): Locator {
    return this.page.locator('[data-testid="internal-secretor-alert"]')
  }

  get internalSecretorAlertLink(): Locator {
    return this.internalSecretorAlert.getByRole('link')
  }
}
