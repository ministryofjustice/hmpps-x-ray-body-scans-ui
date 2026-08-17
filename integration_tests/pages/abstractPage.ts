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

  async getBreadcrumbs(): Promise<Breadcrumb[]> {
    const handles = await this.page.locator('.govuk-breadcrumbs a').elementHandles()
    return Promise.all(
      handles.map(handle =>
        handle.evaluate<Breadcrumb, HTMLAnchorElement>(element => ({
          text: element.textContent!,
          href: element.getAttribute('href')!,
        })),
      ),
    )
  }
}

interface Breadcrumb {
  href: string
  text: string
}
