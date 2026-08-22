// import type { RequestHandler } from 'express'
// import type { PrisonService } from '../services/prisonService'
//
// // eslint-disable-next-line import/prefer-default-export
// export function cacheAllPrisons(prisonService: PrisonService): RequestHandler {
//   let cached = false
//   return async (req, res, next) => {
//     if (!cached) {
//       await prisonService.cacheAllPrisons()
//       cached = true
//     }
//     next()
//   }
// }
