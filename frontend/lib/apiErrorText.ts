/** Turn FastAPI / plain HTTP error bodies into a short user-facing string. */
export function formatApiErrorBody(body: string, status: number): string {
  const t = body.trim();
  if (!t) return `Request failed (${status})`;
  try {
    const j = JSON.parse(t) as { detail?: unknown };
    if (typeof j.detail === "string") return j.detail;
    if (Array.isArray(j.detail)) {
      return j.detail
        .map((item) => {
          if (item && typeof item === "object" && "msg" in item) {
            const o = item as { msg?: string };
            return o.msg ?? JSON.stringify(item);
          }
          return String(item);
        })
        .join(" ");
    }
    if (j.detail != null && typeof j.detail !== "object") {
      return String(j.detail);
    }
  } catch {
    /* plain text */
  }
  return t;
}

export async function errorMessageFromResponse(res: Response): Promise<string> {
  const t = await res.text();
  return formatApiErrorBody(t, res.status);
}
