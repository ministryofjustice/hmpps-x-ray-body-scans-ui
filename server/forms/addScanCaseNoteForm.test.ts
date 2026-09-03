import * as z from 'zod'
import type { Request } from 'express'
import { type AddScanCaseNoteForm, addScanCaseNoteForm } from './addScanCaseNoteForm'

type FormInput = z.input<typeof addScanCaseNoteForm>

describe('addScanCaseNoteForm', () => {
  it.each([undefined, '', '   '])('should parse an empty form with additional details %j', additionalDetails => {
    const result = addScanCaseNoteForm.safeParse({ additionalDetails } satisfies Request['query'] satisfies FormInput)
    expect(result.success).toBe(true)
    expect(result.data).toEqual<AddScanCaseNoteForm>({ additionalDetails: '' })
  })

  it('should parse a form with additional details and trim whitespace', () => {
    const result = addScanCaseNoteForm.safeParse({
      additionalDetails: `
Mr. Smith struggles to stand unaided
for long
    `,
    } satisfies Request['query'] satisfies FormInput)
    expect(result.success).toBe(true)
    expect(result.data).toEqual<AddScanCaseNoteForm>({
      additionalDetails: 'Mr. Smith struggles to stand unaided\nfor long',
    })
  })

  it('should not parse a form with additional details exceeding 3500 characters', () => {
    const result = addScanCaseNoteForm.safeParse({
      additionalDetails: `nothing found${'.'.repeat(3488)}`,
    } satisfies Request['query'] satisfies FormInput)
    expect(result.success).toBe(false)
    expect(result.data).toBeUndefined()
    const errors = z.treeifyError(result.error!)
    expect(errors).toEqual({
      errors: [],
      properties: { additionalDetails: { errors: ['The additional details must be 3,500 characters or less'] } },
    })
  })
})
