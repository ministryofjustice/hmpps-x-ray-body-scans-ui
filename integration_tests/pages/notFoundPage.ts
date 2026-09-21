import type { Page } from '@playwright/test'
import AbstractPage from './abstractPage'

export default class NotFound extends AbstractPage {
  static async verifyOnPage(page: Page): Promise<NotFound> {
    const homePage = new this(page)
    await homePage.expectHeading('Page not found')
    return homePage
  }
}
