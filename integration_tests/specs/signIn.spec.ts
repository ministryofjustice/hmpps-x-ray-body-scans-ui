import { expect, test } from '@playwright/test'
import { login, resetStubs } from '../testUtils'
import hmppsAuth from '../mockApis/hmppsAuth'
import microFrontendComponents from '../mockApis/microFrontendComponents'
import prisonApi from '../mockApis/prisonApi'
import NotFound from '../pages/notFoundPage'

// NB: using the 404 page in order to avoid role/case load checks

const startAtPath = '/not-found'

test.describe('Signing in and fallback header', () => {
  test.beforeEach(async () => {
    await Promise.all([
      microFrontendComponents.stubUnavailable(), // in order to force fallback header to show
      prisonApi.stubMyCaseloads([]), // dps-components lib tries prison-api if MFE did not load shared metadata
    ])
  })

  test.afterEach(async () => {
    await resetStubs()
  })

  test('Unauthenticated user directed to auth', async ({ page }) => {
    await hmppsAuth.stubSignInPage()
    await page.goto(startAtPath)
    await expect(page.getByRole('heading')).toHaveText('Sign in')
  })

  test('Unauthenticated user navigating to sign in page directed to auth', async ({ page }) => {
    await hmppsAuth.stubSignInPage()
    await page.goto('/sign-in')
    await expect(page.getByRole('heading')).toHaveText('Sign in')
  })

  test('User name visible in header', async ({ page }) => {
    await login(page, startAtPath, { name: 'A TestUser' })
    const notFoundPage = await NotFound.verifyOnPage(page)
    await expect(notFoundPage.usersName).toHaveText('A. Testuser')
  })

  test('Phase banner visible in header', async ({ page }) => {
    await login(page, startAtPath)
    const notFoundPage = await NotFound.verifyOnPage(page)
    await expect(notFoundPage.phaseBanner).toHaveText('DEV')
  })

  test('User can sign out', async ({ page }) => {
    await login(page, startAtPath)
    const notFoundPage = await NotFound.verifyOnPage(page)
    await notFoundPage.signOut()
    await expect(page.getByRole('heading')).toHaveText('Sign in')
  })

  test('Token verification failure takes user to sign in page', async ({ page }) => {
    await login(page, startAtPath, { active: false })
    await expect(page.getByRole('heading')).toHaveText('Sign in')
  })

  test('Token verification failure clears user session', async ({ page }) => {
    await login(page, startAtPath, { name: 'A TestUser', active: false })
    await expect(page.getByRole('heading')).toHaveText('Sign in')
    await login(page, startAtPath, { name: 'Some OtherTestUser', active: true })
    const notFoundPage = await NotFound.verifyOnPage(page)
    await expect(notFoundPage.usersName).toHaveText('S. Othertestuser')
  })
})
