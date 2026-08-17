import type { Page } from '@playwright/test'
import AbstractPage from './abstractPage'

export default class CreateScanPage extends AbstractPage {
  static async verifyOnPage(page: Page, name: string): Promise<CreateScanPage> {
    const createScanPage = new this(page)
    await createScanPage.expectHeading(`Record an X-ray body scan for ${name}`)
    return createScanPage
  }
}
