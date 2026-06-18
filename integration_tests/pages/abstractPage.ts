import type { Locator, Page } from '@playwright/test'

export default class AbstractPage {
  protected constructor(protected readonly page: Page) {}

  /** phase banner that appear in header (requires micro frontend components to use fallback) */
  get phaseBanner(): Locator {
    return this.page.locator('.fallback-dps-header__title strong.govuk-tag')
  }

  /** user name that appear in header (requires micro frontend components to use fallback) */
  get usersName(): Locator {
    return this.page.getByTestId('header-user-name')
  }

  /** link to sign out */
  get signoutLink(): Locator {
    return this.page.getByText('Sign out')
  }

  async signOut() {
    return this.signoutLink.first().click()
  }
}
