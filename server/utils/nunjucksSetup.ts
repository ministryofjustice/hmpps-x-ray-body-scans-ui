/* eslint-disable no-param-reassign */
import fs from 'node:fs'
import path from 'node:path'
import express from 'express'
import nunjucks from 'nunjucks'
import config from '../config'
import logger from '../../logger'
import { formatDisplayDate } from './dates'
import { initialiseName } from './utils'
import type { Prisoner } from '../data/interfaces/prisonerSearchApi'
import { errorMessageForField, errorSummary } from '../forms/formErrors'

export default function nunjucksSetup(app: express.Express): void {
  app.set('view engine', 'njk')

  app.locals.asset_path = '/assets/'
  app.locals.applicationName = 'X-ray Body Scans'
  app.locals.environmentName = config.environmentName
  app.locals.environmentNameColour = config.environmentName === 'PRE-PRODUCTION' ? 'govuk-tag--green' : ''
  let assetManifest: Record<string, string> = {}

  try {
    const assetMetadataPath = path.resolve(__dirname, '../../assets/manifest.json')
    assetManifest = JSON.parse(fs.readFileSync(assetMetadataPath, 'utf8'))
  } catch (e) {
    if (process.env.NODE_ENV !== 'test') {
      logger.error(e, 'Could not read asset manifest file')
    }
  }

  const njkEnv = nunjucks.configure(
    [
      path.join(__dirname, '../../server/views'),
      'node_modules/govuk-frontend/dist/',
      'node_modules/@ministryofjustice/frontend/',
      'node_modules/@ministryofjustice/hmpps-connect-dps-components/dist/assets/',
      'node_modules/@ministryofjustice/hmpps-connect-dps-shared-items/dist/assets',
    ],
    {
      autoescape: true,
      express: app,
      noCache: process.env.NODE_ENV !== 'production',
    },
  )

  njkEnv.addGlobal('dpsHomeUrl', config.serviceUrls.digitalPrison)
  njkEnv.addGlobal('prisonerProfileUrl', config.serviceUrls.prisonerProfile)

  njkEnv.addGlobal('errorMessageForField', errorMessageForField)
  njkEnv.addGlobal('errorSummary', errorSummary)

  njkEnv.addFilter('initialiseName', initialiseName)
  njkEnv.addFilter('assetMap', (url: string) => assetManifest[url] || url)
  njkEnv.addFilter(
    'prisonerProfileUrl',
    (prisoner: Prisoner) => `${config.serviceUrls.prisonerProfile}/prisoner/${prisoner.prisonerNumber}`,
  )
  njkEnv.addFilter('formatDisplayDate', formatDisplayDate)
}
