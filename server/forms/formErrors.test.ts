import { errorMessageForField, errorSummary } from './formErrors'
import { createScanForm, treeifyCreateScanFormErrors } from './createScanForm'

describe('errorSummary', () => {
  it('should return undefined when there are no errors', () => {
    expect(errorSummary(undefined)).toBeUndefined()
    expect(errorSummary({ errors: [] })).toBeUndefined()
    expect(errorSummary({ errors: [], properties: {} })).toBeUndefined()
  })

  it('should return list of field errors', () => {
    const errorList = errorSummary({
      errors: [],
      properties: { name: { errors: ['Enter name'] }, choice: { errors: ['Select an option'] } },
    })
    expect(errorList).toEqual([
      { text: 'Enter name', href: '#name' },
      { text: 'Select an option', href: '#choice' },
    ])
  })

  it('should return list of whole-form errors', () => {
    const errorList = errorSummary({
      errors: ['An error occurred'],
      properties: { name: { errors: ['Enter name'] } },
    })
    expect(errorList).toEqual([
      { text: 'An error occurred', href: '#form' },
      { text: 'Enter name', href: '#name' },
    ])
  })

  it('should join multiple errors for a field', () => {
    const errorList = errorSummary({
      errors: ['An error occurred', 'Bad request'],
      properties: { password: { errors: ['Enter at least 10 characters', 'Enter at least 2 numbers'] } },
    })
    expect(errorList).toEqual([
      { text: 'An error occurred. Bad request', href: '#form' },
      { text: 'Enter at least 10 characters. Enter at least 2 numbers', href: '#password' },
    ])
  })
})

describe('errorMessageForField', () => {
  it('should return undefined when there are no errors for this field', () => {
    expect(errorMessageForField('name', undefined)).toBeUndefined()
    expect(errorMessageForField('name', { errors: [] })).toBeUndefined()
    expect(errorMessageForField('name', { errors: [], properties: {} })).toBeUndefined()
    expect(
      errorMessageForField('name', {
        errors: [],
        properties: { age: { errors: ['You must be at lea st 16'] }, name: { errors: [] } },
      }),
    ).toBeUndefined()
  })

  it('should return an error message for a field with an error', () => {
    expect(
      errorMessageForField('age', {
        errors: [],
        properties: { age: { errors: ['You must be at least 16'] }, name: { errors: [] } },
      }),
    ).toEqual({ text: 'You must be at least 16' })
  })

  it('should return an joined error message for a field with multiple errors', () => {
    expect(
      errorMessageForField('password', {
        errors: [],
        properties: { password: { errors: ['Enter at least 10 characters', 'Enter at least 2 numbers'] } },
      }),
    ).toEqual({ text: 'Enter at least 10 characters. Enter at least 2 numbers' })
  })
})

describe('create scan form errors', () => {
  const badForm = {
    scanDateOption: 'other',
    'scanDate-day': '',
    'scanDate-month': 'may',
    'scanDate-year': '26',
    justification: 'intel',
    outcome: 'item found',
    typeOfFind: 'unclear',
  }
  const result = createScanForm.safeParse(badForm)
  const treeifiedErrors = treeifyCreateScanFormErrors(result.error!)

  it('should summarise errors', () => {
    const summary = errorSummary(treeifiedErrors)
    expect(summary).toEqual([
      {
        text: 'Enter a valid date',
        href: '#scanDate',
      },
      {
        text: 'Select why the scan was carried out',
        href: '#justification',
      },
      {
        text: 'Select the result of the scan',
        href: '#outcome',
      },
      {
        text: 'Select the type of item that was detected',
        href: '#typeOfFind',
      },
    ])
  })

  it('should find errors for specific fields', () => {
    let fieldMessage = errorMessageForField('scanDate', treeifiedErrors)
    expect(fieldMessage).toEqual({ text: 'Enter a valid date' })

    fieldMessage = errorMessageForField('outcome', treeifiedErrors)
    expect(fieldMessage).toEqual({ text: 'Select the result of the scan' })

    fieldMessage = errorMessageForField('scanDateOption', treeifiedErrors)
    expect(fieldMessage).toBeUndefined()
  })
})
