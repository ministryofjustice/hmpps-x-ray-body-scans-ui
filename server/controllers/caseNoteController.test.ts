import type { Request, Response } from 'express'
import logger from '../../logger'
import { user } from '../routes/testutils/appSetup'
import { fixedClock, now } from '../testutils/fixedClock'
import { internalServerErrorResponse, mockThrownError } from '../testutils/mocks/errorResponse'
import { mockPrisoner } from '../testutils/mocks/prisonerSearchApi'
import { mockLegacyScanResponse, mockScanResponse, mockScanCaseNoteResponse } from '../testutils/mocks/xrayBodyScansApi'
import { XrayBodyScansApiClient } from '../data/xrayBodyScansApiClient'
import { ScanResponse } from '../data/interfaces/xrayBodyScansApi'
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

let caseNoteController: CaseNoteController
let req: Request
let res: Response & { render: jest.Mock; redirect: jest.Mock; sendStatus: jest.Mock }

beforeAll(() => {
  fixedClock()
})

beforeEach(() => {
  caseNoteController = new CaseNoteController(auditService, xrayBodyScansApiClient)

  req = {
    params: { prisonerNumber, scanId },
    body: {},
    id: correlationId,
  } as unknown as Request

  res = {
    locals: { user: { ...user, username }, prisoner, scan },
    render: jest.fn(),
    redirect: jest.fn(),
    sendStatus: jest.fn(),
  } as unknown as Response & { render: jest.Mock; redirect: jest.Mock; sendStatus: jest.Mock }
})

afterEach(() => {
  jest.resetAllMocks()
})

describe('getAddScanCaseNote', () => {
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
        occurredAt: '24 July 2026 at 00:00',
        caseNoteTitle: `Result of X-ray body scan: ${scan.outcomeDescription}`,
        createCallFailed: false,
        errors: undefined,
      }),
    )
  })

  it('returns 404 when scan is not found', async () => {
    res.locals.scan = undefined
    await caseNoteController.getAddScanCaseNote(req, res)

    expect(res.sendStatus).toHaveBeenCalledWith(404)
    expect(res.render).not.toHaveBeenCalled()
    expect(res.redirect).not.toHaveBeenCalled()
  })

  it('returns 404 for a NOMIS scan', async () => {
    res.locals.scan = mockLegacyScanResponse(prisonerNumber, now) as unknown as ScanResponse
    await caseNoteController.getAddScanCaseNote(req, res)

    expect(res.sendStatus).toHaveBeenCalledWith(404)
    expect(res.render).not.toHaveBeenCalled()
    expect(res.redirect).not.toHaveBeenCalled()
  })

  it('returns 404 for a scan that already has a case note', async () => {
    res.locals.scan = {
      ...scan,
      caseNoteId,
    }
    await caseNoteController.getAddScanCaseNote(req, res)

    expect(res.sendStatus).toHaveBeenCalledWith(404)
    expect(res.render).not.toHaveBeenCalled()
    expect(res.redirect).not.toHaveBeenCalled()
  })
})

describe('postAddScanCaseNote', () => {
  it('creates a case note with only the auto-text and redirects', async () => {
    xrayBodyScansApiClient.createScanCaseNote.mockResolvedValueOnce(caseNote)

    await caseNoteController.postAddScanCaseNote(req, res)

    expect(xrayBodyScansApiClient.createScanCaseNote).toHaveBeenCalledWith(
      scanId,
      {
        text: `
Reason: Reasonable suspicion
Result: Item detected
Items found: Inorganic
        `.trim(),
      },
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
    expect(res.redirect).toHaveBeenCalledWith(`/prisoner/${prisonerNumber}/scan-overview`)
    expect(logger.info).toHaveBeenCalledWith(`Created case note ${caseNote.id} for scan ${scan.id}`)
  })

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
    expect(res.redirect).toHaveBeenCalledWith(`/prisoner/${prisonerNumber}/scan-overview`)
    expect(logger.info).toHaveBeenCalledWith(`Created case note ${caseNote.id} for scan ${scan.id}`)
  })

  it('shows a validation error when additional details exceeds 3500 characters', async () => {
    req.body = { additionalDetails: 'a'.repeat(3501) }
    await caseNoteController.postAddScanCaseNote(req, res)

    expect(res.render).toHaveBeenCalledWith(
      'pages/addScanCaseNote',
      expect.objectContaining({
        errors: {
          properties: {
            additionalDetails: { errors: ['The additional details must be 3,500 characters or less'] },
          },
        },
        createCallFailed: false,
      }),
    )
    expect(xrayBodyScansApiClient.createScanCaseNote).not.toHaveBeenCalled()
    expect(res.redirect).not.toHaveBeenCalled()
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
  })

  it('returns 404 when scan is not found', async () => {
    res.locals.scan = undefined
    await caseNoteController.postAddScanCaseNote(req, res)

    expect(res.sendStatus).toHaveBeenCalledWith(404)
    expect(res.render).not.toHaveBeenCalled()
    expect(res.redirect).not.toHaveBeenCalled()
  })

  it('returns 404 for a NOMIS scan', async () => {
    res.locals.scan = mockLegacyScanResponse(prisonerNumber, now) as unknown as ScanResponse
    await caseNoteController.postAddScanCaseNote(req, res)

    expect(res.sendStatus).toHaveBeenCalledWith(404)
    expect(res.render).not.toHaveBeenCalled()
    expect(res.redirect).not.toHaveBeenCalled()
  })

  it('returns 404 for a scan that already has a case note', async () => {
    res.locals.scan = {
      ...scan,
      caseNoteId,
    }
    await caseNoteController.postAddScanCaseNote(req, res)

    expect(res.sendStatus).toHaveBeenCalledWith(404)
    expect(res.render).not.toHaveBeenCalled()
    expect(res.redirect).not.toHaveBeenCalled()
  })
})
