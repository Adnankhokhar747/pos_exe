export interface AuthenticatedUser {
  userId: string;
  tenantId: string;
  username: string;
  permissions: string[];
}

export interface AccessTokenPayload {
  sub: string;
  tenantId: string;
  username: string;
  permissions: string[];
}
