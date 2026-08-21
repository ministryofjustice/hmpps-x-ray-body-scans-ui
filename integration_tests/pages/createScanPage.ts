import type { Locator, Page } from '@playwright/test'
import AbstractPage from './abstractPage'

export default class CreateScanPage extends AbstractPage {
  static async verifyOnPage(page: Page, name: string): Promise<CreateScanPage> {
    const createScanPage = new this(page)
    await createScanPage.expectHeading(`Record an X-ray body scan for ${name}`)
    return createScanPage
  }

  get saveButton(): Locator {
    return this.page.getByRole('button', { name: 'Save' })
  }

  get cancelLink(): Locator {
    return this.page.getByRole('link', { name: 'Cancel' })
  }

  checkRadioButton(label: string, { exact = true }: { exact?: boolean } = {}): Promise<void> {
    return this.page.getByLabel(label, { exact }).check()
  }

  typeScanDateComponent(label: string, text: string): Promise<void> {
    return this.page.getByLabel(label, { exact: true }).fill(text)
  }
}
