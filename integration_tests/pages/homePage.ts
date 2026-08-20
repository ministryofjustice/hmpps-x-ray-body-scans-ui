import type { Page } from '@playwright/test'
import AbstractPage from './abstractPage'

export default class HomePage extends AbstractPage {
  static async verifyOnPage(page: Page): Promise<HomePage> {
    const homePage = new this(page)
    await homePage.expectHeading('This site is under construction...')
    return homePage
  }
}
