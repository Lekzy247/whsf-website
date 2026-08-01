export type Permission =
  | "programme:read"
  | "programme:write"
  | "finance:read"
  | "finance:approve"
  | "identity:manage";

export interface SessionPrincipal {
  id: string;
  organisationId: string;
  permissions: readonly Permission[];
}

export function can(principal: SessionPrincipal | null, permission: Permission): boolean {
  return principal?.permissions.includes(permission) ?? false;
}
