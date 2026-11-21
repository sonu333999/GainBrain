// In-memory token store (never stored in localStorage or sessionStorage)
let authTokenMemory: string | null = null;

export function setAuthTokenMemory(token: string | null) {
  authTokenMemory = token;
}

export function getAuthTokenMemory(): string | null {
  return authTokenMemory;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (authTokenMemory) {
    headers.set('Authorization', `Bearer ${authTokenMemory}`);
  }
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      typeof data === 'object' && data !== null && 'error' in data
        ? String((data as { error: unknown }).error)
        : `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status);
  }

  return data as T;
}

export async function apiDownloadBlob(path: string, fallbackFileName: string) {
  const headers = new Headers();
  if (authTokenMemory) {
    headers.set('Authorization', `Bearer ${authTokenMemory}`);
  }
  const response = await fetch(path, { headers });
  if (!response.ok) {
    let message = 'Download failed.';
    try {
      const json = await response.json();
      if (json?.error) message = json.error;
    } catch {
      // ignore
    }
    throw new ApiError(message, response.status);
  }

  const disposition = response.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/i);
  const fileName = match?.[1] || fallbackFileName;

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
