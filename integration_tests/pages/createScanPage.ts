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

  get scanDateConditional(): Locator {
    return this.page.locator('#conditional-scanDateOption-3')
  }

  async getScanDateComponentErrors(): Promise<ScanDateComponentErrors> {
    const [day, month, year] = await Promise.all([
      this.page.getByRole('textbox', { name: 'Day' }).evaluate(input => input.classList.contains('govuk-input--error')),
      this.page
        .getByRole('textbox', { name: 'Month' })
        .evaluate(input => input.classList.contains('govuk-input--error')),
      this.page
        .getByRole('textbox', { name: 'Year' })
        .evaluate(input => input.classList.contains('govuk-input--error')),
    ])
    return { day, month, year }
  }

  get outcomeConditional(): Locator {
    return this.page.locator('#conditional-outcome-3')
  }
}

interface ScanDateComponentErrors {
  day: boolean
  month: boolean
  year: boolean
}
