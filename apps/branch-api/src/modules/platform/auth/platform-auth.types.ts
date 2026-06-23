export interface AuthenticatedPlatformAdmin {
  adminId: string;
  username: string;
}

export interface PlatformAccessTokenPayload {
  sub: string;
  username: string;
  kind: 'platform-admin';
}
