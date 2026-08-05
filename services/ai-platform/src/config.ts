/**
 * Local copy of the env reader.
 *
 * `@aegis/utils` is browser-oriented (it pulls in Tailwind class merging), so a
 * service importing it would drag frontend dependencies into a server process.
 * The shared package earns its place when there is a second server-side reader
 * to share — not before.
 */
export function optionalEnv(
  name: string,
  source: Record<string, string | undefined>,
  fallback: string
): string {
  const value = source[name];
  return value === undefined || value === "" ? fallback : value;
}
