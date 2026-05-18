export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function supabaseHeaders(extra?: Record<string, string>) {
  return {
    apikey: ANON_KEY,
    Authorization: `Bearer ${ANON_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

export function supabaseUrl(table: string, params?: Record<string, string>): string {
  const url = new URL(`${SUPABASE_URL}/rest/v1/${table}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
}
