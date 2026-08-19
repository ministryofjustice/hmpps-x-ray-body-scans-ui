import * as z from 'zod'

// NB: zod does not export the return type of z.treeifyError
export type ZodErrorTree<T> = ReturnType<typeof z.treeifyError<T>>

interface ErrorSummaryListItem {
  text: string
  href: string
}

/** Convert treeified zod errors into list for GOV.UK error summary component */
export function errorSummary<T extends Record<string, unknown>>(
  zodErrorTree: ZodErrorTree<T> | undefined,
): ErrorSummaryListItem[] | undefined {
  const errorList: ErrorSummaryListItem[] = []

  if (zodErrorTree?.errors?.length) {
    // for whole-form errors, there is nowhere to anchor to, so top of form will do.
    // ideally, form schemas should be set up to never create unanchored errors.
    errorList.push({
      text: zodErrorTree.errors.join('. '),
      href: '#form',
    })
  }

  if (zodErrorTree?.properties) {
    Object.entries(zodErrorTree.properties).forEach(([fieldName, errorMessages]) => {
      if (errorMessages && errorMessages.errors) {
        errorList.push({ text: errorMessages.errors.join('. '), href: `#${fieldName}` })
      }
    })
  }

  return errorList.length > 0 ? errorList : undefined
}

interface ErrorMessage {
  text: string
}

/** Finds a field error in treeified zod errors for the GOV.UK error message component */
export function errorMessageForField<T extends Record<string, unknown>>(
  fieldName: keyof T,
  zodErrorTree: ZodErrorTree<T> | undefined,
): ErrorMessage | undefined {
  const errorMessage = zodErrorTree?.properties?.[fieldName]?.errors?.join('. ')
  return errorMessage ? { text: errorMessage } : undefined
}
