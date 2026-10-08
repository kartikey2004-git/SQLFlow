const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

if (!configuredApiUrl && process.env.NODE_ENV === "production") {
  throw new Error("NEXT_PUBLIC_API_URL is required in production (set it to the API's public origin).");
}

export const API_URL: string = (configuredApiUrl || "http://localhost:5000").replace(/\/+$/, "");

export const AUTH_URL: string = (process.env.NEXT_PUBLIC_AUTH_URL?.trim() || API_URL).replace(/\/+$/, "");

export const getApiBase = (): string =>
  typeof window === "undefined" ? (process.env.API_ORIGIN?.trim().replace(/\/+$/, "") || API_URL) : API_URL;
