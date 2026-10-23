export function getAllowedOrigins(value = process.env.CLIENT_ORIGINS ?? ''): Set<string> {
  return new Set(value.split(',').map((origin) => origin.trim()).filter(Boolean));
}

export function isOriginAllowed(
  origin: string | undefined,
  allowedOrigins = getAllowedOrigins()
): boolean {
  return origin === undefined || allowedOrigins.has(origin);
}
