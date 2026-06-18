import { expect, type Locator, type Page } from '@playwright/test'
import AbstractPage from './abstractPage'

export default class HomePage extends AbstractPage {
  static async verifyOnPage(page: Page): Promise<HomePage> {
    const homePage = new HomePage(page)
    await expect(homePage.heading).toBeVisible()
    return homePage
  }

  get heading(): Locator {
    return this.page.locator('h1', { hasText: 'This site is under construction...' })
  }
}
