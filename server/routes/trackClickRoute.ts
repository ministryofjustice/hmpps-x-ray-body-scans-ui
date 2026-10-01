import type { Request, Response } from 'express'
import { telemetry } from '@ministryofjustice/hmpps-azure-telemetry'
import logger from '../../logger'

// eslint-disable-next-line import/prefer-default-export
export function trackClickRoute(req: Request, res: Response): void {
  const { body } = req
  const { username, activeCaseLoadId } = res.locals.user

  const common: Record<string, string> = {
    elementType: body.elementType,
    username,
    activeCaseLoadId: activeCaseLoadId ?? '',
    prisonerNumber: body.prisonerNumber,
    url: body.url ?? '',
  }

  if (body.elementType === 'alert-flag') {
    logger.info({ ...common, alertLabel: body.alertLabel }, 'XRBSAlertFlagClicked')
    telemetry.trackEvent('XRBSAlertFlagClicked', {
      ...common,
      alertLabel: body.alertLabel,
    })
  } else if (body.elementType === 'view-case-note') {
    logger.info(
      { ...common, scanId: body.scanId, caseNoteId: body.caseNoteId, scanOutcome: body.scanOutcome },
      'XRBSViewCaseNoteClicked',
    )
    telemetry.trackEvent('XRBSViewCaseNoteClicked', {
      ...common,
      scanId: body.scanId,
      caseNoteId: body.caseNoteId,
      scanOutcome: body.scanOutcome,
    })
  } else {
    res.sendStatus(400)
    return
  }

  res.sendStatus(204)
}
