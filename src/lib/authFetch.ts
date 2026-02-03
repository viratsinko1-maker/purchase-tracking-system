/**
 * Authenticated Fetch Helper
 * ใช้แทน fetch() ธรรมดาเพื่อส่ง user credentials ไปด้วย
 */

/**
 * Get user info from sessionStorage
 */
function getUserFromSession(): { id?: string; role?: string } | null {
  if (typeof window === "undefined") return null;

  try {
    const userStr = sessionStorage.getItem("user");
    if (userStr) {
      return JSON.parse(userStr) as { id?: string; role?: string };
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

/**
 * Get auth headers for API calls
 */
export function getAuthHeaders(): Record<string, string> {
  const user = getUserFromSession();
  const headers: Record<string, string> = {};

  if (user) {
    if (user.id) headers["x-user-id"] = user.id;
    if (user.role) headers["x-user-role"] = user.role;
  }

  return headers;
}

/**
 * Authenticated fetch - automatically includes user credentials
 * Use this instead of fetch() for protected API endpoints
 */
export async function authFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const authHeaders = getAuthHeaders();

  const mergedHeaders = {
    ...authHeaders,
    ...(options.headers || {}),
  };

  return fetch(url, {
    ...options,
    headers: mergedHeaders,
  });
}

/**
 * Authenticated fetch with JSON body
 * Convenience wrapper for POST/PUT requests with JSON data
 */
export async function authFetchJson<T = unknown>(
  url: string,
  options: RequestInit & { body?: unknown } = {}
): Promise<{ ok: boolean; status: number; data: T }> {
  const { body, ...restOptions } = options;

  const response = await authFetch(url, {
    ...restOptions,
    headers: {
      "Content-Type": "application/json",
      ...(restOptions.headers || {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await response.json() as T;

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

export default authFetch;
