import * as z from 'zod'

const errorMessages = {
  textTooLong: 'The additional details must be 3,500 characters or less',
}

export const addScanCaseNoteForm = z
  .object({
    additionalDetails: z.preprocess(
      v => (typeof v === 'string' ? v.trim() : v),
      z.string().max(3500, errorMessages.textTooLong).optional(),
    ),
  })
  .transform(({ additionalDetails }) => {
    return { additionalDetails: additionalDetails ?? '' }
  })

export type AddScanCaseNoteForm = z.infer<typeof addScanCaseNoteForm>
