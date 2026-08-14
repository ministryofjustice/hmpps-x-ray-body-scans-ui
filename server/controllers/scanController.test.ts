import type { Request, Response } from 'express'
import { pageResponse } from '../testutils/pagination'
import { mockScanResponse, mockScanSummaryResponse } from '../testutils/mocks/xrayBodyScansApiClient'
import { XrayBodyScansApiClient } from '../data/xrayBodyScansApiClient'
import AuditService, { Page } from '../services/auditService'
import HmppsAuditClient from '../data/hmppsAuditClient'
import ScanController from './scanController'

jest.mock('../services/auditService')
jest.mock('../data/xrayBodyScansApiClient')

const auditService = new AuditService({} as HmppsAuditClient) as jest.Mocked<AuditService>
const xrayBodyScansApiClient = new XrayBodyScansApiClient(undefined as never) as jest.Mocked<XrayBodyScansApiClient>

const prisonerNumber = 'A1234BC'
const username = 'user1'
const correlationId = 'correlation-id'

let scanController: ScanController
let req: Request
let res: Response & { render: jest.Mock; redirect: jest.Mock }

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
    locals: { user: { username } },
    render: jest.fn(),
    redirect: jest.fn(),
  } as unknown as Response & { render: jest.Mock; redirect: jest.Mock }
})

afterEach(() => {
  jest.resetAllMocks()
})

describe('getScanList', () => {
  it('logs a page view and renders the scan list with scan summary and scan rows', async () => {
    const now = new Date('2026-07-27T12:00:00')
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
            date: '27 July 2026',
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
        prisonerNumber,
        today: expect.any(String),
        yesterday: expect.any(String),
      }),
    )
  })
})

describe('postCreateScan', () => {
  it('creates the scan and redirects to the success page', async () => {
    xrayBodyScansApiClient.createScan.mockResolvedValue({
      source: 'DPS',
      id: '42',
      prisonerNumber,
      prisonId: 'TODO',
      scanDate: new Date('2026-07-27T12:00:00'),
      justification: 'REASONABLE_SUSPICION',
      justificationDescription: 'Reasonable suspicion',
      outcome: 'NEGATIVE',
      outcomeDescription: 'No item detected',
      typeOfFind: null,
      typeOfFindDescription: null,
      caseNoteId: null,
      mergedFromPrisonerNumber: null,
      mergedAt: null,
      createdAt: new Date('2026-07-27T12:00:00'),
      createdBy: username,
      lastModifiedAt: new Date('2026-07-27T12:00:00'),
      lastModifiedBy: username,
    })

    req.body = {
      scanDateOption: 'other',
      'scanDate-day': '27',
      'scanDate-month': '7',
      'scanDate-year': '2026',
      scanResult: 'NEGATIVE',
    }

    await scanController.postCreateScan(req, res)

    expect(xrayBodyScansApiClient.createScan).toHaveBeenCalledWith(
      prisonerNumber,
      expect.objectContaining({ scanDate: '2026-07-27', outcome: 'NEGATIVE' }),
      username,
    )
    expect(res.redirect).toHaveBeenCalledWith(
      `/prisoner/${prisonerNumber}/create-scan/success?scanId=42&scanDate=2026-07-27`,
    )
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
    expect(res.render).toHaveBeenCalledWith('pages/createScanSuccess', { prisonerNumber })
  })
})
