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

  get internalSecretorAlertCreatedNote(): Locator {
    return this.page.getByText('An internal secretor alert has been added')
  }

  get updateInternalSecretorAlertLink(): Locator {
    return this.page.getByText('Update internal secretor alert')
  }
}
