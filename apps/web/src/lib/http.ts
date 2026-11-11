import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError, type ZodType } from "zod";

/** Every API error has the shape `{ error: { code, message } }`. Codes are stable; clients map them to copy. */
export class ApiError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message || code);
  }
}

export const unauthorized = () => new ApiError(401, "unauthorized", "Sign in required");
export const forbidden = (msg = "Not allowed") => new ApiError(403, "forbidden", msg);
export const notFound = (msg = "Not found") => new ApiError(404, "not_found", msg);
export const badRequest = (msg = "Invalid request") => new ApiError(400, "invalid_request", msg);
export const planLimit = (msg: string) => new ApiError(402, "plan_limit", msg);

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  "Access-Control-Allow-Headers": "Authorization,Content-Type,X-Guest-Token,X-Occasion-Pin",
  "Access-Control-Max-Age": "86400",
};

export function json<T>(data: T, init: { status?: number; headers?: Record<string, string> } = {}) {
  return NextResponse.json(data, { status: init.status ?? 200, headers: { "Cache-Control": "no-store", ...init.headers } });
}

export function errorJson(status: number, code: string, message: string) {
  return json({ error: { code, message } }, { status });
}

export function toErrorResponse(e: unknown) {
  if (e instanceof ApiError) return errorJson(e.status, e.code, e.message);
  if (e instanceof ZodError) {
    const first = e.issues[0];
    const path = first?.path?.join(".");
    return errorJson(400, "invalid_request", first ? `${path ? path + ": " : ""}${first.message}` : "Invalid request");
  }
  console.error("[api] unhandled error", e);
  return errorJson(500, "server_error", "Something went wrong");
}

type Handler<P> = (req: NextRequest, params: P) => Promise<Response>;

/** Wraps a route handler: awaits params, converts thrown ApiError/ZodError into the standard error shape. */
export function route<P extends Record<string, string> = Record<string, never>>(handler: Handler<P>) {
  return async (req: NextRequest, ctx: { params: Promise<P> }): Promise<Response> => {
    try {
      const params = (ctx?.params ? await ctx.params : {}) as P;
      return await handler(req, params);
    } catch (e) {
      return toErrorResponse(e);
    }
  };
}

export async function readJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw badRequest("Body must be JSON");
  }
  return schema.parse(body);
}

export function readQuery<T>(req: NextRequest, schema: ZodType<T>): T {
  const obj: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((v, k) => {
    if (v !== "") obj[k] = v;
  });
  return schema.parse(obj);
}

export function clientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") || "unknown";
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(s: unknown): s is string {
  return typeof s === "string" && UUID_RE.test(s);
}
export function assertUuid(s: string, what = "id"): string {
  if (!isUuid(s)) throw notFound(`Unknown ${what}`);
  return s;
}
