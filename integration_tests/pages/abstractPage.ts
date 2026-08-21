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

  getFormValues<T = Record<string, string>>(): Promise<T> {
    return this.page.locator('form').evaluate<T, void, HTMLFormElement>(form => {
      const data = new FormData(form)
      return Object.fromEntries(data.entries()) as T
    })
  }

  protected expectHeading(text: string): Promise<void> {
    return expect(this.page.getByRole('heading', { name: text })).toBeVisible()
  }

  async getBreadcrumbs(): Promise<Anchor[] | null> {
    const breadcrumbs = this.page.locator('.govuk-breadcrumbs')
    if ((await breadcrumbs.count()) === 0) {
      return null
    }
    return breadcrumbs.getByRole('link').evaluateAll(anchors =>
      anchors.map(anchor => ({
        text: anchor.textContent,
        href: anchor.getAttribute('href'),
      })),
    )
  }

  async getErrorSummary(): Promise<Anchor[] | null> {
    const errorSummary = this.page.locator('.govuk-error-summary')
    if ((await errorSummary.count()) === 0) {
      return null
    }
    // a page with an error summary should have a prefix in the title
    await expect(this.page.title()).resolves.toMatch(/^\s*Error:\s+/)
    return errorSummary.locator('.govuk-error-summary__list a').evaluateAll(anchors =>
      anchors.map(anchor => ({
        text: anchor.textContent,
        href: anchor.getAttribute('href'),
      })),
    )
  }
}

interface Anchor {
  text: string
  href: string | null
}
