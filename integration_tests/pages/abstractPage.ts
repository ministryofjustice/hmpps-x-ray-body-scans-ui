import { expect, type Locator, type Page } from '@playwright/test'

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

  protected expectHeading(text: string): Promise<void> {
    return expect(this.page.getByRole('heading', { name: text })).toBeVisible()
  }

  getBreadcrumbs(): Promise<Breadcrumb[]> {
    return this.page.locator('.govuk-breadcrumbs a').evaluateAll(anchors =>
      anchors.map(anchor => ({
        text: anchor.textContent,
        href: anchor.getAttribute('href'),
      })),
    )
  }
}

interface Breadcrumb {
  text: string
  href: string | null
}
