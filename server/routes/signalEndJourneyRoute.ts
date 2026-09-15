import type { Request, Response } from 'express'

// eslint-disable-next-line import/prefer-default-export
export function signalEndJourneyRoute(req: Request, res: Response): void {
  const { name: journeyName } = req.query

  if (journeyName !== 'wpip') {
    res.sendStatus(404)
    return
  }

  if (req.session.wpipReturnPath) {
    delete req.session.wpipReturnPath
  }
  res.sendStatus(204)
}
