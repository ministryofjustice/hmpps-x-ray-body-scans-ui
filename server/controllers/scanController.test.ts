import type { Request, Response } from 'express'
import logger from '../../logger'
import { user } from '../routes/testutils/appSetup'
import { fixedClock, now, yesterday } from '../testutils/fixedClock'
import { emptyPageResponse, pageResponse } from '../testutils/pagination'
import { internalServerErrorResponse, mockThrownError } from '../testutils/mocks/errorResponse'
import { mockPrisonNamesImpl } from '../testutils/mocks/prisonService'
import { mockPrisoner } from '../testutils/mocks/prisonerSearchApi'
import {
  mockDoNotScanAlert,
  mockInternalSecretorAlert,
  mockLegacyScanResponse,
  mockScanResponse,
  mockScanSummaryResponse,
} from '../testutils/mocks/xrayBodyScansApi'
import { XrayBodyScansApiClient } from '../data/xrayBodyScansApiClient'
import AuditService, { Page } from '../services/auditService'
import { PrisonService } from '../services/prisonService'
import ScanController from './scanController'

jest.mock('../../logger')
jest.mock('../services/auditService')
jest.mock('../services/prisonService')
jest.mock('../data/xrayBodyScansApiClient')

const auditService = jest.mocked(new AuditService({} as never))
const prisonService = jest.mocked(new PrisonService({} as never, {} as never))
const xrayBodyScansApiClient = jest.mocked(new XrayBodyScansApiClient({} as never))

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
  scanController = new ScanController(auditService, prisonService, xrayBodyScansApiClient)
  prisonService.getPrisonNames.mockImplementation(mockPrisonNamesImpl)

  req = {
    originalUrl: `/prisoner/${prisonerNumber}/scan-overview`,
    params: { prisonerNumber },
    query: {},
    session: {},
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
  afterEach(() => {
    // list page should always log an audit event
    expect(auditService.logPageView).toHaveBeenCalledWith(Page.SCAN_LIST, {
      who: username,
      subjectId: prisonerNumber,
      subjectType: 'PRISONER_ID',
      correlationId,
    })
  })

  it.each([
    {
      scenario: 'an empty page for someone with no scans or alerts',
      scanSummary: mockScanSummaryResponse({ prisonerNumber, now, relevantAlerts: [] }),
      expectedAlertFlags: [],
    },
    {
      scenario: 'the scan summary for someone without alerts',
      scanSummary: mockScanSummaryResponse({
        prisonerNumber,
        now,
        nomisCount: 1,
        dpsCount: 2,
        negativeCount: 2,
        relevantAlerts: [],
      }),
      expectedAlertFlags: [],
    },
    {
      scenario: 'the scan summary for someone with alerts',
      scanSummary: mockScanSummaryResponse({
        prisonerNumber,
        now,
        relevantAlerts: [mockInternalSecretorAlert, mockDoNotScanAlert],
      }),
      expectedAlertFlags: [
        {
          label: mockInternalSecretorAlert.codeDescription,
          alertCodes: [mockInternalSecretorAlert.code],
          classes: expect.stringContaining('dps-alert-status--security'),
        },
        {
          label: mockDoNotScanAlert.codeDescription,
          alertCodes: [mockDoNotScanAlert.code],
          classes: expect.stringContaining('dps-alert-status--security'),
        },
      ],
    },
  ])('should show $scenario', async ({ scanSummary, expectedAlertFlags }) => {
    xrayBodyScansApiClient.getScanSummary.mockResolvedValueOnce(scanSummary)
    xrayBodyScansApiClient.listScans.mockResolvedValueOnce(emptyPageResponse())

    await scanController.getScanList(req, res)

    expect(res.render).toHaveBeenCalledWith('pages/scanList', {
      prisonerNumber,
      scanSummary,
      alertFlags: expectedAlertFlags,
      yearFilter: undefined,
      historicYears: [2025, 2024],
      pagination: null,
      sorter: expect.any(Function),
      scanRows: [],
      addedCaseNoteToScan: undefined,
    })
    expect(xrayBodyScansApiClient.listScans).toHaveBeenCalledWith(prisonerNumber, { page: 0 }, username)
    expect(prisonService.getPrisonNames).not.toHaveBeenCalled()
  })

  it.each([
    { scenario: 'this year', year: undefined, expectedYearFilter: undefined, expectedListScansRequest: { page: 0 } },
    {
      scenario: 'last year',
      year: '2025',
      expectedYearFilter: 2025,
      expectedListScansRequest: { page: 0, fromScanDate: expect.any(Date), toScanDate: expect.any(Date) },
    },
    {
      scenario: 'all years',
      year: 'all',
      expectedYearFilter: 'all',
      expectedListScansRequest: { page: 0, fromScanDate: expect.any(Date) },
    },
  ])('should show the scan list for $scenario', async ({ year, expectedYearFilter, expectedListScansRequest }) => {
    const scanSummary = mockScanSummaryResponse({ prisonerNumber, now, relevantAlerts: [] })
    xrayBodyScansApiClient.getScanSummary.mockResolvedValueOnce(scanSummary)
    xrayBodyScansApiClient.listScans.mockResolvedValueOnce(
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
        mockLegacyScanResponse(prisonerNumber, now),
        mockLegacyScanResponse(prisonerNumber, null, 'pos'),
      ]),
    )

    req.query.year = year
    await scanController.getScanList(req, res)

    expect(res.render).toHaveBeenCalledWith('pages/scanList', {
      prisonerNumber,
      scanSummary,
      alertFlags: [],
      yearFilter: expectedYearFilter,
      historicYears: [2025, 2024],
      pagination: { showing: [1, 3, 3] },
      sorter: expect.any(Function),
      scanRows: [
        expect.objectContaining({
          source: 'DPS',
          scanDateDescription: '24 July 2026',
          prisonDescription: 'Leeds (HMP)',
          justificationDescription: 'Reasonable suspicion',
          outcomeDescription: 'Item detected',
          typeOfFindDescription: 'Organic',
          highlightedRow: false,
        }),
        expect.objectContaining({
          source: 'NOMIS',
          scanDateDescription: '24 July 2026',
          scanDetails: null,
        }),
        expect.objectContaining({
          source: 'NOMIS',
          scanDateDescription: 'Not recorded',
          scanDetails: 'pos',
        }),
      ],
      addedCaseNoteToScan: undefined,
    })
    expect(xrayBodyScansApiClient.listScans).toHaveBeenCalledWith(prisonerNumber, expectedListScansRequest, username)
    expect(prisonService.getPrisonNames).toHaveBeenCalledWith(['LEI'])
  })

  it('should show pagination for long lists', async () => {
    xrayBodyScansApiClient.getScanSummary.mockResolvedValueOnce(
      mockScanSummaryResponse({ prisonerNumber, now, relevantAlerts: [] }),
    )
    xrayBodyScansApiClient.listScans.mockResolvedValueOnce({
      ...pageResponse(Array.from({ length: 20 }).map(() => mockLegacyScanResponse(prisonerNumber, now))),
      number: 1,
      totalPages: 3,
      totalElements: 56,
    })

    req.query.page = '1'
    req.originalUrl += '?page=1'
    await scanController.getScanList(req, res)

    expect(res.render).toHaveBeenCalledWith(
      'pages/scanList',
      expect.objectContaining({
        pagination: expect.objectContaining({
          showing: [21, 40, 56],
          viewAllUrl: `/prisoner/${prisonerNumber}/scan-overview?page=all`,
        }),
        sorter: expect.any(Function),
      }),
    )
    expect(xrayBodyScansApiClient.listScans).toHaveBeenCalledWith(prisonerNumber, { page: 1 }, username)
    expect(prisonService.getPrisonNames).not.toHaveBeenCalled()
  })

  it.each([
    {
      scenario: 'this year',
      year: undefined,
      expectedYearFilter: undefined,
      expectedListScansRequest: { fromScanDate: undefined, toScanDate: undefined },
    },
    {
      scenario: 'last year',
      year: '2025',
      expectedYearFilter: 2025,
      expectedListScansRequest: { fromScanDate: expect.any(Date), toScanDate: expect.any(Date) },
    },
  ])('should show all scans for $scenario', async ({ year, expectedYearFilter, expectedListScansRequest }) => {
    xrayBodyScansApiClient.getScanSummary.mockResolvedValueOnce(
      mockScanSummaryResponse({ prisonerNumber, now, relevantAlerts: [] }),
    )
    xrayBodyScansApiClient.listScans.mockResolvedValueOnce({
      ...pageResponse(Array.from({ length: 31 }).map(() => mockLegacyScanResponse(prisonerNumber, now))),
      number: 0,
      totalPages: 1,
      totalElements: 31,
      size: 5000,
    })

    req.query.year = year
    req.query.page = 'all'
    req.originalUrl += '?page=all'
    await scanController.getScanList(req, res)

    expect(res.render).toHaveBeenCalledWith(
      'pages/scanList',
      expect.objectContaining({
        yearFilter: expectedYearFilter,
        pagination: { showing: [1, 31, 31] },
        sorter: expect.any(Function),
      }),
    )
    expect(xrayBodyScansApiClient.listScans).toHaveBeenCalledWith(
      prisonerNumber,
      { ...expectedListScansRequest, page: 0, size: 5000 },
      username,
    )
    expect(prisonService.getPrisonNames).not.toHaveBeenCalled()
  })

  // TODO: what shows if summary and/or list do not load?
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
        today: '24 July 2026',
        yesterday: '23 July 2026',
        errors: undefined,
        scanDateComponentsWithErrors: new Set(),
        createCallFailed: undefined,
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
  ])('creates $scenario and shows the success page', async ({ body, expectedScanDate }) => {
    const scan = {
      ...mockScanResponse(prisonerNumber, yesterday),
      justification: body.justification,
      justificationDescription: body.justification,
      outcome: body.outcome,
      outcomeDescription: body.outcome,
      typeOfFind: body.typeOfFind ?? null,
      typeOfFindDescription: body.typeOfFind ?? null,
    }
    xrayBodyScansApiClient.createScan.mockResolvedValueOnce(scan)
    xrayBodyScansApiClient.getScanSummary.mockResolvedValueOnce(
      mockScanSummaryResponse({ prisonerNumber, now, relevantAlerts: [] }),
    )

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
    expect(xrayBodyScansApiClient.getScanSummary).toHaveBeenCalledWith(
      prisoner.prisonerNumber,
      { includeAlerts: true },
      username,
    )
    expect(res.render).toHaveBeenCalledWith(
      'pages/createScanSuccess',
      expect.objectContaining({
        prisoner,
        scan,
        internalSecretorAlert: undefined,
        internalSecretorAlertCreated: false,
      }),
    )
    expect(res.redirect).not.toHaveBeenCalled()
    expect(logger.info).toHaveBeenCalledWith(`Scan ${scan.id} recorded`)
    expect(auditService.logAuditEvent).toHaveBeenCalledWith({
      what: 'CREATE_XRAY_BODY_SCAN',
      who: username,
      subjectId: prisonerNumber,
      subjectType: 'PRISONER_ID',
      correlationId: req.id,
      details: { scanId: scan.id },
    })
    expect(auditService.logPageView).toHaveBeenCalledWith(Page.CREATE_SCAN_SUCCESS, {
      who: username,
      subjectId: prisonerNumber,
      subjectType: 'PRISONER_ID',
      correlationId,
    })
  })

  it('shows an update link if an internal secretor alert already exists', async () => {
    xrayBodyScansApiClient.createScan.mockResolvedValueOnce(mockScanResponse(prisonerNumber, yesterday))
    xrayBodyScansApiClient.getScanSummary.mockResolvedValueOnce(
      mockScanSummaryResponse({ prisonerNumber, now, relevantAlerts: [mockInternalSecretorAlert, mockDoNotScanAlert] }),
    )

    req.body = {
      scanDateOption: 'yesterday',
      justification: 'REASONABLE_SUSPICION' as const,
      outcome: 'POSITIVE' as const,
      typeOfFind: 'INORGANIC' as const,
    }
    await scanController.postCreateScan(req, res)

    expect(xrayBodyScansApiClient.createScan).toHaveBeenCalled()
    expect(xrayBodyScansApiClient.getScanSummary).toHaveBeenCalled()
    expect(res.render).toHaveBeenCalledWith(
      'pages/createScanSuccess',
      expect.objectContaining({
        internalSecretorAlert: mockInternalSecretorAlert,
        internalSecretorAlertCreated: false,
      }),
    )
    expect(res.redirect).not.toHaveBeenCalled()
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
      expectedScanDateComponentsWithErrors: [],
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
        properties: { typeOfFind: { errors: ['Select type of item detected'] } },
      },
      expectedScanDateComponentsWithErrors: [],
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
        properties: { scanDate: { errors: ['The scan date must include a day'] } },
      },
      expectedScanDateComponentsWithErrors: ['scanDate-day'],
    },
    // NB: other scenarios are covered by createScanForm.test.ts
  ])('shows errors when $scenario', async ({ body, expectedErrors, expectedScanDateComponentsWithErrors }) => {
    req.body = body

    await scanController.postCreateScan(req, res)

    expect(res.render).toHaveBeenCalledWith(
      'pages/createScan',
      expect.objectContaining({
        prisoner,
        today: '24 July 2026',
        yesterday: '23 July 2026',
        errors: expectedErrors,
        scanDateComponentsWithErrors: new Set(expectedScanDateComponentsWithErrors),
        createCallFailed: undefined,
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
        errors: { errors: [] },
        scanDateComponentsWithErrors: new Set(),
        createCallFailed: true,
      }),
    )
    expect(res.redirect).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ responseStatus: 500 }))
    expect(auditService.logAuditEvent).not.toHaveBeenCalled()
  })
})
