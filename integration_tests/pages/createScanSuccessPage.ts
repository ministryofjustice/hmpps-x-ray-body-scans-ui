import type { Page } from '@playwright/test'
import AbstractPage from './abstractPage'

export default class CreateScanSuccessPage extends AbstractPage {
  static async verifyOnPage(page: Page): Promise<CreateScanSuccessPage> {
    const createScanPage = new this(page)
    await createScanPage.expectHeading('Scan recorded')
    return createScanPage
  }
}
