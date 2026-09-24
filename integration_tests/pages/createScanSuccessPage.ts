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
    return this.page.getByTestId('internal-secretor-alert')
  }

  get internalSecretorAlertLink(): Locator {
    return this.internalSecretorAlert.getByRole('link')
  }

  get addCaseNoteSection(): Locator {
    return this.page.getByTestId('add-case-note')
  }

  get addCaseNoteLink(): Locator {
    return this.addCaseNoteSection.getByRole('button', { name: 'Add a case note' })
  }

  get returnButton(): Locator {
    return this.page.locator('.govuk-button-group a.govuk-button')
  }

  get viewProfileLink(): Locator {
    return this.page.locator('.govuk-button-group').getByRole('link', { name: 'View this person’s profile' })
  }
}
