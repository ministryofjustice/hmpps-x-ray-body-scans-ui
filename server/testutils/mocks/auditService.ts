import type AuditService from '../../services/auditService'

// eslint-disable-next-line import/prefer-default-export
export function mockAuditService(auditService: jest.Mocked<AuditService>) {
  auditService.logAuditEvent.mockResolvedValue(Promise.resolve())
  auditService.logPageView.mockResolvedValue(Promise.resolve())
}
