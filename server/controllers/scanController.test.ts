import type { Request, Response } from 'express'
import logger from '../../logger'
import { user } from '../routes/testutils/appSetup'
import { fixedClock, now, yesterday } from '../testutils/fixedClock'
import { pageResponse } from '../testutils/pagination'
import { internalServerErrorResponse, mockThrownError } from '../testutils/mocks/errorResponse'
import { mockPrisoner } from '../testutils/mocks/prisonerSearchApiClient'
import { mockScanResponse, mockScanSummaryResponse } from '../testutils/mocks/xrayBodyScansApiClient'
import { XrayBodyScansApiClient } from '../data/xrayBodyScansApiClient'
import AuditService, { Page } from '../services/auditService'
import HmppsAuditClient from '../data/hmppsAuditClient'
import ScanController from './scanController'

jest.mock('../../logger')
jest.mock('../services/auditService')
jest.mock('../data/xrayBodyScansApiClient')

const auditService = new AuditService({} as HmppsAuditClient) as jest.Mocked<AuditService>
const xrayBodyScansApiClient = new XrayBodyScansApiClient(undefined as never) as jest.Mocked<XrayBodyScansApiClient>

const prisonerNumber = 'A1234BC'
const prisoner = mockPrisoner(prisonerNumber)
const username = 'user1'
const correlationId = 'correlation-id'

let scanController: ScanController
let req: Request
let res: Response & { render: jest.Mock; redirect: jest.Mock }

beforeAll(() => {
  fixedClock()
})

beforeEach(() => {
  scanController = new ScanController(xrayBodyScansApiClient, auditService)
  auditService.logPageView.mockResolvedValue(undefined)

  req = {
    params: { prisonerNumber },
    query: {},
    body: {},
    id: correlationId,
  } as unknown as Request

  res = {
    locals: { user: { ...user, username }, prisoner },
    render: jest.fn(),
    redirect: jest.fn(),
  } as unknown as Response & { render: jest.Mock; redirect: jest.Mock }
})

afterEach(() => {
  jest.resetAllMocks()
})

describe('getScanList', () => {
  it('logs a page view and renders the scan list with scan summary and scan rows', async () => {
    xrayBodyScansApiClient.getScanSummary.mockResolvedValue(
      mockScanSummaryResponse({
        prisonerNumber,
        now,
        nomisCount: 0,
        dpsCount: 6,
        positiveCount: 1,
        negativeCount: 2,
      }),
    )
    xrayBodyScansApiClient.listScans.mockResolvedValue(
      pageResponse([
        {
          ...mockScanResponse(prisonerNumber, now),
          prisonId: 'LEI',
          justification: 'REASONABLE_SUSPICION',
          justificationDescription: 'Reasonable suspicion',
          outcome: 'POSITIVE',
          outcomeDescription: 'Item detected',
          typeOfFind: 'ORGANIC',
          typeOfFindDescription: 'Organic',
        },
      ]),
    )

    await scanController.getScanList(req, res)

    expect(auditService.logPageView).toHaveBeenCalledWith(Page.SCAN_LIST, {
      who: username,
      subjectId: prisonerNumber,
      subjectType: 'PRISONER_ID',
      correlationId,
    })
    expect(res.render).toHaveBeenCalledWith(
      'pages/scanList',
      expect.objectContaining({
        prisonerNumber,
        scansThisYearCount: 6,
        itemsDetectedCount: 1,
        inconclusiveCount: 3,
        noItemsDetectedCount: 2,
        rawScanRows: [
          expect.objectContaining({
            date: '24 July 2026',
            establishment: 'LEI',
            reason: 'Reasonable suspicion',
            result: 'Item detected',
            itemsFound: 'Organic',
          }),
        ],
      }),
    )
  })
})

describe('getCreateScan', () => {
  it('logs a page view and renders the create scan form', async () => {
    await scanController.getCreateScan(req, res)

    expect(auditService.logPageView).toHaveBeenCalledWith(Page.CREATE_SCAN, {
      who: username,
      subjectId: prisonerNumber,
      subjectType: 'PRISONER_ID',
      correlationId,
    })
    expect(res.render).toHaveBeenCalledWith(
      'pages/createScan',
      expect.objectContaining({
        prisoner,
        today: expect.any(String),
        yesterday: expect.any(String),
        errors: undefined,
        formValues: undefined,
      }),
    )
  })
})

describe('postCreateScan', () => {
  it.each([
    {
      scenario: 'a positive organic intelligence scan for today',
      body: {
        scanDateOption: 'today',
        justification: 'INTELLIGENCE' as const,
        outcome: 'POSITIVE' as const,
        typeOfFind: 'ORGANIC' as const,
      },
      expectedScanDate: '2026-07-24',
    },
    {
      scenario: 'a positive inorganic intelligence scan for yesterday',
      body: {
        scanDateOption: 'yesterday',
        justification: 'INTELLIGENCE' as const,
        outcome: 'POSITIVE' as const,
        typeOfFind: 'INORGANIC' as const,
      },
      expectedScanDate: '2026-07-23',
    },
    {
      scenario: 'a positive mixed reasonable suspicion scan for today',
      body: {
        scanDateOption: 'today',
        justification: 'REASONABLE_SUSPICION' as const,
        outcome: 'POSITIVE' as const,
        typeOfFind: 'ORGANIC_AND_INORGANIC' as const,
      },
      expectedScanDate: '2026-07-24',
    },
    {
      scenario: 'a positive unknown reasonable suspicion scan for yesterday',
      body: {
        scanDateOption: 'yesterday',
        justification: 'REASONABLE_SUSPICION' as const,
        outcome: 'POSITIVE' as const,
        typeOfFind: 'NOT_KNOWN' as const,
      },
      expectedScanDate: '2026-07-23',
    },
    {
      scenario: 'a negative reasonable suspicion scan for an older date',
      body: {
        scanDateOption: 'other',
        'scanDate-day': '22',
        'scanDate-month': '7',
        'scanDate-year': '2026',
        justification: 'REASONABLE_SUSPICION' as const,
        outcome: 'NEGATIVE' as const,
      },
      expectedScanDate: '2026-07-22',
    },
    {
      scenario: 'a inconclusive intelligece scan for an older date',
      body: {
        scanDateOption: 'other',
        'scanDate-day': '21',
        'scanDate-month': '7',
        'scanDate-year': '2026',
        justification: 'INTELLIGENCE' as const,
        outcome: 'INCONCLUSIVE' as const,
      },
      expectedScanDate: '2026-07-21',
    },
  ])('creates $scenario and redirects to the success page', async ({ body, expectedScanDate }) => {
    const createdScan = {
      ...mockScanResponse(prisonerNumber, yesterday),
      justification: body.justification,
      justificationDescription: body.justification,
      outcome: body.outcome,
      outcomeDescription: body.outcome,
      typeOfFind: body.typeOfFind ?? null,
      typeOfFindDescription: body.typeOfFind ?? null,
    }
    xrayBodyScansApiClient.createScan.mockResolvedValueOnce(createdScan)

    req.body = body

    await scanController.postCreateScan(req, res)

    expect(xrayBodyScansApiClient.createScan).toHaveBeenCalledWith(
      prisonerNumber,
      expect.objectContaining({
        prisonId: 'MDI',
        scanDate: expectedScanDate,
        justification: body.justification,
        outcome: body.outcome,
        typeOfFind: body.typeOfFind ?? null,
      }),
      username,
    )
    expect(res.redirect).toHaveBeenCalledWith(
      `/prisoner/${prisonerNumber}/record-scan/success?scanId=${createdScan.id}&scanDate=2026-07-23`,
    )
    expect(res.render).not.toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith(`Scan ${createdScan.id} recorded`)
    expect(auditService.logAuditEvent).toHaveBeenCalledWith({
      what: 'CREATE_XRAY_BODY_SCAN',
      who: username,
      subjectId: prisonerNumber,
      subjectType: 'PRISONER_ID',
      correlationId: req.id,
      details: { scanId: createdScan.id },
    })
  })

  it.each([
    {
      scenario: 'scan date option not selected',
      body: {
        scanDateOption: '',
        justification: 'INTELLIGENCE',
        outcome: 'NEGATIVE',
      },
      expectedErrors: {
        errors: [],
        properties: { scanDateOption: { errors: ['Select when the scan happened'] } },
      },
    },
    {
      scenario: 'type of find is not selected',
      body: {
        scanDateOption: 'today',
        justification: 'INTELLIGENCE',
        outcome: 'POSITIVE',
        typeOfFind: '',
      },
      expectedErrors: {
        errors: [],
        properties: { typeOfFind: { errors: ['Select the type of item that was detected'] } },
      },
    },
    {
      scenario: 'scan date is invalid',
      body: {
        scanDateOption: 'other',
        'scanDate-day': '',
        'scanDate-month': '7',
        'scanDate-year': '2026',
        justification: 'INTELLIGENCE',
        outcome: 'POSITIVE',
        typeOfFind: 'NOT_KNOWN',
      },
      expectedErrors: {
        errors: [],
        properties: { scanDate: { errors: ['Enter a valid date'] } },
      },
    },
    // NB: other scenarios are covered by createScanForm.test.ts
  ])('shows errors when $scenario', async ({ body, expectedErrors }) => {
    req.body = body

    await scanController.postCreateScan(req, res)

    expect(res.render).toHaveBeenCalledWith(
      'pages/createScan',
      expect.objectContaining({
        prisoner,
        today: expect.any(String),
        yesterday: expect.any(String),
        errors: expectedErrors,
        formValues: body,
      }),
    )
    expect(res.redirect).not.toHaveBeenCalled()
    expect(xrayBodyScansApiClient.createScan).not.toHaveBeenCalled()
    expect(auditService.logAuditEvent).not.toHaveBeenCalled()
  })

  it('shows an error when api throws one', async () => {
    xrayBodyScansApiClient.createScan.mockRejectedValueOnce(mockThrownError(internalServerErrorResponse))

    req.body = {
      scanDateOption: 'today',
      justification: 'REASONABLE_SUSPICION',
      outcome: 'NEGATIVE',
    }

    await scanController.postCreateScan(req, res)

    expect(res.render).toHaveBeenCalledWith(
      'pages/createScan',
      expect.objectContaining({
        errors: { errors: ['The details could not be recorded. Try again later'] },
      }),
    )
    expect(res.redirect).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ responseStatus: 500 }))
    expect(auditService.logAuditEvent).not.toHaveBeenCalled()
  })
})

describe('getCreateScanSuccess', () => {
  it('logs a page view and renders the success page', async () => {
    await scanController.getCreateScanSuccess(req, res)

    expect(auditService.logPageView).toHaveBeenCalledWith(Page.CREATE_SCAN_SUCCESS, {
      who: username,
      subjectId: prisonerNumber,
      subjectType: 'PRISONER_ID',
      correlationId,
    })
    expect(res.render).toHaveBeenCalledWith('pages/createScanSuccess', { prisoner })
  })
})
