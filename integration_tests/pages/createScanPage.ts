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
    return this.page.locator('.govuk-button-group').getByRole('link', { name: 'Cancel' })
  }

  checkRadioButton(label: string, { exact = true }: { exact?: boolean } = {}): Promise<void> {
    return this.page.getByLabel(label, { exact }).check()
  }

  get scanDateFormGroup(): Locator {
    return this.page.getByTestId('scanDate-form-group')
  }

  typeScanDateComponent(label: string, text: string): Promise<void> {
    return this.scanDateFormGroup.getByLabel(label, { exact: true }).fill(text)
  }

  get scanDateConditional(): Locator {
    return this.scanDateFormGroup.locator('#conditional-scanDateOption-3')
  }

  async getScanDateComponentErrors(): Promise<ScanDateComponentErrors> {
    const [day, month, year] = await Promise.all([
      this.scanDateFormGroup
        .getByRole('textbox', { name: 'Day' })
        .evaluate(input => input.classList.contains('govuk-input--error')),
      this.scanDateFormGroup
        .getByRole('textbox', { name: 'Month' })
        .evaluate(input => input.classList.contains('govuk-input--error')),
      this.scanDateFormGroup
        .getByRole('textbox', { name: 'Year' })
        .evaluate(input => input.classList.contains('govuk-input--error')),
    ])
    return { day, month, year }
  }

  get justificationFormGroup(): Locator {
    return this.page.getByTestId('justification-form-group')
  }

  get outcomeFormGroup(): Locator {
    return this.page.getByTestId('outcome-form-group')
  }
}

interface ScanDateComponentErrors {
  day: boolean
  month: boolean
  year: boolean
}
