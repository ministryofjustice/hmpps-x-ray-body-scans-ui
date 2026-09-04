import type { Request, Response } from 'express'
import { NotFound } from 'http-errors'
import logger from '../../logger'
import { user } from '../routes/testutils/appSetup'
import { fixedClock, now } from '../testutils/fixedClock'
import { internalServerErrorResponse, mockThrownError } from '../testutils/mocks/errorResponse'
import { mockPrisoner } from '../testutils/mocks/prisonerSearchApi'
import { mockLegacyScanResponse, mockScanResponse, mockScanCaseNoteResponse } from '../testutils/mocks/xrayBodyScansApi'
import { XrayBodyScansApiClient } from '../data/xrayBodyScansApiClient'
import type { ScanResponse } from '../data/interfaces/xrayBodyScansApi'
import AuditService, { Page } from '../services/auditService'
import CaseNoteController from './caseNoteController'

jest.mock('../../logger')
jest.mock('../services/auditService')
jest.mock('../data/xrayBodyScansApiClient')

const auditService = jest.mocked(new AuditService({} as never))
const xrayBodyScansApiClient = jest.mocked(new XrayBodyScansApiClient({} as never))

const prisonerNumber = 'A1234BC'
const prisoner = mockPrisoner(prisonerNumber)
const username = 'user1'
const correlationId = 'correlation-id'
const scan = mockScanResponse(prisonerNumber, now)
const scanId = scan.id
const caseNote = mockScanCaseNoteResponse(scan)
const caseNoteId = caseNote.id
const scanWithCaseNote = { ...scan, caseNoteId }

let caseNoteController: CaseNoteController
let req: Request
let res: Response & { render: jest.Mock; redirect: jest.Mock }

beforeAll(() => {
  fixedClock()
})

beforeEach(() => {
  caseNoteController = new CaseNoteController(auditService, xrayBodyScansApiClient)

  req = {
    params: { prisonerNumber, scanId },
    body: {},
    session: {},
    id: correlationId,
  } as unknown as Request

  res = {
    locals: { user: { ...user, username }, prisoner, scan },
    render: jest.fn(),
    redirect: jest.fn(),
  } as unknown as Response & { render: jest.Mock; redirect: jest.Mock }
})

afterEach(() => {
  jest.resetAllMocks()
})

describe('getScanCaseNote', () => {
  beforeEach(() => {
    req.originalUrl = `/prisoner/${prisonerNumber}/scan/${scanId}/case-note`
  })

  it('logs a page view and renders the case note', async () => {
    res.locals.scan = scanWithCaseNote
    xrayBodyScansApiClient.getScanCaseNote.mockResolvedValueOnce(caseNote)

    await caseNoteController.getScanCaseNote(req, res)

    expect(auditService.logPageView).toHaveBeenCalledWith(Page.VIEW_SCAN_CASE_NOTE, {
      who: username,
      subjectId: prisonerNumber,
      subjectType: 'PRISONER_ID',
      correlationId,
    })
    expect(res.render).toHaveBeenCalledWith('pages/scanCaseNote', { caseNote })
    expect(xrayBodyScansApiClient.getScanCaseNote).toHaveBeenCalledWith(scanId, username)
  })

  it('returns 404 when scan is not found', async () => {
    res.locals.scan = undefined

    await expect(caseNoteController.getScanCaseNote(req, res)).rejects.toThrow(new NotFound())

    expect(xrayBodyScansApiClient.getScanCaseNote).not.toHaveBeenCalled()
    expect(res.render).not.toHaveBeenCalled()
  })

  it('returns 404 for a NOMIS scan', async () => {
    res.locals.scan = mockLegacyScanResponse(prisonerNumber, now) as unknown as ScanResponse

    await expect(caseNoteController.getScanCaseNote(req, res)).rejects.toThrow(new NotFound())

    expect(xrayBodyScansApiClient.getScanCaseNote).not.toHaveBeenCalled()
    expect(res.render).not.toHaveBeenCalled()
  })

  it('returns 404 case note is not found', async () => {
    xrayBodyScansApiClient.getScanCaseNote.mockResolvedValueOnce(null)

    await expect(caseNoteController.getScanCaseNote(req, res)).rejects.toThrow(new NotFound())

    expect(xrayBodyScansApiClient.getScanCaseNote).not.toHaveBeenCalled()
    expect(res.render).not.toHaveBeenCalled()
  })
})

describe('getAddScanCaseNote', () => {
  beforeEach(() => {
    req.originalUrl = `/prisoner/${prisonerNumber}/scan/${scanId}/add-a-scan-case-note`
  })

  it('logs a page view and renders the form', async () => {
    await caseNoteController.getAddScanCaseNote(req, res)

    expect(auditService.logPageView).toHaveBeenCalledWith(Page.ADD_SCAN_CASE_NOTE, {
      who: username,
      subjectId: prisonerNumber,
      subjectType: 'PRISONER_ID',
      correlationId,
    })
    expect(res.render).toHaveBeenCalledWith(
      'pages/addScanCaseNote',
      expect.objectContaining({
        scan,
        createCallFailed: false,
        errors: undefined,
      }),
    )
  })

  it('returns 404 when scan is not found', async () => {
    res.locals.scan = undefined
    await expect(caseNoteController.getAddScanCaseNote(req, res)).rejects.toThrow(new NotFound())

    expect(res.render).not.toHaveBeenCalled()
    expect(res.redirect).not.toHaveBeenCalled()
  })

  it('returns 404 for a NOMIS scan', async () => {
    res.locals.scan = mockLegacyScanResponse(prisonerNumber, now) as unknown as ScanResponse
    await expect(caseNoteController.getAddScanCaseNote(req, res)).rejects.toThrow(new NotFound())

    expect(res.render).not.toHaveBeenCalled()
    expect(res.redirect).not.toHaveBeenCalled()
  })

  it('returns 404 for a scan that already has a case note', async () => {
    res.locals.scan = {
      ...scan,
      caseNoteId,
    }
    await expect(caseNoteController.getAddScanCaseNote(req, res)).rejects.toThrow(new NotFound())

    expect(res.render).not.toHaveBeenCalled()
    expect(res.redirect).not.toHaveBeenCalled()
  })
})

describe('postAddScanCaseNote', () => {
  beforeEach(() => {
    req.originalUrl = `/prisoner/${prisonerNumber}/scan/${scanId}/add-a-scan-case-note`
  })

  const scanScenarios: { scenario: string; scanScenario: ScanResponse; expectedText: string }[] = [
    {
      scenario: 'negative scan',
      scanScenario: {
        ...scan,
        outcome: 'NEGATIVE',
        outcomeDescription: 'No item detected',
        typeOfFind: null,
        typeOfFindDescription: null,
      },
      expectedText: `
Reason: Reasonable suspicion
Result: No item detected
Items found: None`,
    },
    {
      scenario: 'positive scan',
      scanScenario: {
        ...scan,
        justification: 'INTELLIGENCE',
        justificationDescription: 'Intelligence-led',
      },
      expectedText: `
Reason: Intelligence-led
Result: Item detected
Items found: Inorganic`,
    },
  ]
  it.each(scanScenarios)(
    'creates a case note for a $scenario with only the auto-text and redirects',
    async ({ scanScenario, expectedText }) => {
      res.locals.scan = scanScenario
      xrayBodyScansApiClient.createScanCaseNote.mockResolvedValueOnce(caseNote)

      await caseNoteController.postAddScanCaseNote(req, res)

      expect(xrayBodyScansApiClient.createScanCaseNote).toHaveBeenCalledWith(
        scanId,
        { text: expectedText.trim() },
        username,
      )
      expect(auditService.logAuditEvent).toHaveBeenCalledWith({
        what: 'CREATE_XRAY_BODY_SCAN_CASE_NOTE',
        who: username,
        subjectId: prisonerNumber,
        subjectType: 'PRISONER_ID',
        correlationId,
        details: { scanId },
      })
      expect(res.redirect).toHaveBeenCalledWith(`/prisoner/${prisonerNumber}/scan-overview#scan-history`)
      expect(req.session.addedCaseNoteToScan).toEqual(scan.id)
      expect(logger.info).toHaveBeenCalledWith(`Created case note ${caseNote.id} for scan ${scan.id}`)
    },
  )

  it('appends additional details to the auto-text', async () => {
    xrayBodyScansApiClient.createScanCaseNote.mockResolvedValueOnce(caseNote)

    req.body = { additionalDetails: 'Extra info' }
    await caseNoteController.postAddScanCaseNote(req, res)

    expect(xrayBodyScansApiClient.createScanCaseNote).toHaveBeenCalledWith(
      scanId,
      {
        text: `
Reason: Reasonable suspicion
Result: Item detected
Items found: Inorganic
--
Extra info
        `.trim(),
      },
      username,
    )
    expect(res.redirect).toHaveBeenCalledWith(`/prisoner/${prisonerNumber}/scan-overview#scan-history`)
    expect(req.session.addedCaseNoteToScan).toEqual(scan.id)
    expect(logger.info).toHaveBeenCalledWith(`Created case note ${caseNote.id} for scan ${scan.id}`)
  })

  it('returns the user to the list page preserving filters', async () => {
    xrayBodyScansApiClient.createScanCaseNote.mockResolvedValueOnce(caseNote)

    req.originalUrl += '?year=all&page=2'
    await caseNoteController.postAddScanCaseNote(req, res)

    expect(res.redirect).toHaveBeenCalledWith(`/prisoner/${prisonerNumber}/scan-overview?year=all&page=2#scan-history`)
  })

  it('shows a validation error when additional details exceeds 3500 characters', async () => {
    req.body = { additionalDetails: 'a'.repeat(3501) }
    await caseNoteController.postAddScanCaseNote(req, res)

    expect(res.render).toHaveBeenCalledWith(
      'pages/addScanCaseNote',
      expect.objectContaining({
        errors: {
          errors: [],
          properties: {
            additionalDetails: expect.objectContaining({
              errors: ['The additional details must be 3,500 characters or less'],
            }),
          },
        },
        createCallFailed: false,
      }),
    )
    expect(xrayBodyScansApiClient.createScanCaseNote).not.toHaveBeenCalled()
    expect(res.redirect).not.toHaveBeenCalled()
    expect(req.session.addedCaseNoteToScan).toBeUndefined()
  })

  it('shows an error when the API call fails', async () => {
    xrayBodyScansApiClient.createScanCaseNote.mockRejectedValueOnce(mockThrownError(internalServerErrorResponse))

    await caseNoteController.postAddScanCaseNote(req, res)

    expect(res.render).toHaveBeenCalledWith(
      'pages/addScanCaseNote',
      expect.objectContaining({ createCallFailed: true }),
    )
    expect(res.redirect).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ responseStatus: 500 }))
    expect(req.session.addedCaseNoteToScan).toBeUndefined()
  })

  it('returns 404 when scan is not found', async () => {
    res.locals.scan = undefined
    await expect(caseNoteController.postAddScanCaseNote(req, res)).rejects.toThrow(new NotFound())

    expect(res.render).not.toHaveBeenCalled()
    expect(res.redirect).not.toHaveBeenCalled()
    expect(req.session.addedCaseNoteToScan).toBeUndefined()
  })

  it('returns 404 for a NOMIS scan', async () => {
    res.locals.scan = mockLegacyScanResponse(prisonerNumber, now) as unknown as ScanResponse
    await expect(caseNoteController.postAddScanCaseNote(req, res)).rejects.toThrow(new NotFound())

    expect(res.render).not.toHaveBeenCalled()
    expect(res.redirect).not.toHaveBeenCalled()
    expect(req.session.addedCaseNoteToScan).toBeUndefined()
  })

  it('returns 404 for a scan that already has a case note', async () => {
    res.locals.scan = {
      ...scan,
      caseNoteId,
    }
    await expect(caseNoteController.postAddScanCaseNote(req, res)).rejects.toThrow(new NotFound())

    expect(res.render).not.toHaveBeenCalled()
    expect(res.redirect).not.toHaveBeenCalled()
    expect(req.session.addedCaseNoteToScan).toBeUndefined()
  })
})
