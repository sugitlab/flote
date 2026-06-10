// Detects "column does not exist" class errors so schema-migration fallbacks
// only fire for missing columns — never for network errors or timeouts,
// which would otherwise double (or triple) every read/write.
export function isColumnMissingError(
  error: { code?: string; message?: string } | null | undefined
): boolean {
  if (!error) return false;
  const code = error.code ?? "";
  const msg = (error.message ?? "").toLowerCase();
  return (
    code === "PGRST204" || // PostgREST: column not found in schema cache
    code === "42703" || // PostgreSQL: undefined_column
    msg.includes("schema cache") ||
    (msg.includes("column") && msg.includes("does not exist"))
  );
}
