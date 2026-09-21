import type { Page } from '@playwright/test'
import AbstractPage from './abstractPage'

export default class AuthErrorPage extends AbstractPage {
  static async verifyOnPage(page: Page): Promise<AuthErrorPage> {
    const homePage = new this(page)
    await homePage.expectHeading('Authorisation Error')
    return homePage
  }
}
