export interface AuditFields {
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface TenantRecord extends AuditFields {
  id: string;
  organisationId: string;
}

export function belongsToOrganisation(record: TenantRecord, organisationId: string): boolean {
  return record.organisationId === organisationId;
}
