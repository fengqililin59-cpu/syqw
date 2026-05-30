/**
 * @file 与后端 GET /auth/me/permissions 响应对齐（JWT 内 perm_codes 与 permissions 同义）。
 */
export type MePermissionsResponse = {
  permissions?: string[] | null
  perm_codes?: string[] | null
}

export function permListFromMeResponse(d: MePermissionsResponse | null | undefined): string[] {
  const codes = d?.perm_codes
  const legacy = d?.permissions
  if (Array.isArray(codes) && codes.length > 0) return codes.map((x) => String(x))
  if (Array.isArray(legacy) && legacy.length > 0) return legacy.map((x) => String(x))
  return []
}
