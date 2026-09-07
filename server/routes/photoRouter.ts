import path from 'node:path'
import { type Response, Router } from 'express'
import { NotFound } from 'http-errors'
import { isGranted, CorePersonRecordPermission } from '@ministryofjustice/hmpps-prison-permissions-lib'
import logger from '../../logger'
import { PrisonApiClient } from '../data/prisonApi'
import AuditService from '../services/auditService'

// eslint-disable-next-line import/prefer-default-export
export function photoRouter(auditService: AuditService, prisonApiClient: PrisonApiClient) {
  const router = Router({ mergeParams: true })

  const assetsPath = path.resolve(__dirname, '../../assets')
  function sendPlaceholderPhoto(res: Response): void {
    res.sendFile('/images/photo-unavailable.png', { root: assetsPath }, error => {
      if (error) {
        logger.error(error, 'Cannot load placeholder photo')
      }
    })
  }

  router.get('/photo', async (req, res, next) => {
    const { prisoner, prisonerPermissions, user } = res.locals

    if (!prisoner) {
      next(new NotFound())
    }

    res.set('cache-control', 'private, max-age=86400')
    res.removeHeader('pragma')

    if (
      prisoner.currentFacialImageId &&
      user?.token &&
      isGranted(CorePersonRecordPermission.read_photo, prisonerPermissions)
    ) {
      auditService
        .logAuditEvent({
          what: 'VIEW_PHOTO',
          who: user.username,
          subjectId: prisoner.prisonerNumber,
          subjectType: 'PRISONER_ID',
          correlationId: req.id,
          details: { photoId: prisoner.currentFacialImageId },
        })
        .catch(error => logger.error(error))

      try {
        const imageStream = await prisonApiClient.getPhoto(prisoner.currentFacialImageId, false, user.token)
        res.type('image/jpeg')
        imageStream.pipe(res)
      } catch (error) {
        logger.error(error, 'Cannot load photo from prison-api')
        sendPlaceholderPhoto(res)
      }
    } else {
      sendPlaceholderPhoto(res)
    }
  })

  return router
}
