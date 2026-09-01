import type { Locator, Page } from '@playwright/test'
import AbstractPage from './abstractPage'

export default class AddScanCaseNotePage extends AbstractPage {
  static async verifyOnPage(page: Page): Promise<AddScanCaseNotePage> {
    const addScanCaseNotePage = new this(page)
    await addScanCaseNotePage.expectHeading('Add an X-ray body scan case note')
    return addScanCaseNotePage
  }

  get additionalDetailsInput(): Locator {
    return this.page.getByLabel('Additional details (optional)')
  }

  get saveButton(): Locator {
    return this.page.getByRole('button', { name: 'Save' })
  }

  get cancelLink(): Locator {
    return this.page.getByRole('link', { name: 'Cancel' })
  }
}
