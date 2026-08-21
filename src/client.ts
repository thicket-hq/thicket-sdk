// The transport every resource namespace rides: bearer auth, retries with
// Retry-After respect, page-based auto-pagination, and one error shape.
// Contract: https://www.thickethq.com/developers/api (spec: /openapi.json).

export type ThicketScope = "read" | "full";

export interface ThicketClientOptions {
  /** Personal access token (`thicket_pat_…`), or an async provider for one. */
  token: string | (() => Promise<string>);
  /**
   * Identifies your integration to Thicket: the app's name plus a contact
   * (URL or email), e.g. "AcmeSync (dev@acme.com)". Required: token calls
   * without a User-Agent are refused with 400.
   */
  userAgent: string;
  /** Defaults to https://www.thickethq.com */
  baseUrl?: string;
  /** Total attempts per request including the first (default 3). */
  maxAttempts?: number;
  /** Injectable fetch for testing; defaults to globalThis.fetch. */
  fetch?: typeof globalThis.fetch;
}

export type ErrorCode =
  | "usage"
  | "not_found"
  | "auth_required"
  | "forbidden"
  | "rate_limit"
  | "network"
  | "api_error"
  | "validation"
  | "plan_limit";

const STATUS_TO_CODE: Record<number, ErrorCode> = {
  400: "validation",
  401: "auth_required",
  402: "plan_limit",
  403: "forbidden",
  404: "not_found",
  422: "validation",
  429: "rate_limit",
  500: "api_error",
  502: "api_error",
  503: "api_error",
  504: "api_error",
};

const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);
// Never retried regardless of anything else.
const NEVER_RETRY = new Set([400, 401, 402, 403, 404, 422]);

export class ThicketError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public status?: number,
    public retryable: boolean = false,
    public retryAfter?: number,
    /** The server's machine-readable error.code, when it sent one. */
    public apiCode?: string,
  ) {
    super(message);
    this.name = "ThicketError";
  }
}

export interface RequestOptions {
  query?: Record<
    string,
    string | number | boolean | null | undefined
  >;
  body?: unknown;
  /** Overrides the default JSON handling (e.g. multipart FormData). */
  rawBody?: BodyInit;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export interface ListPage<T> {
  items: T[];
  page: number;
}

export class ThicketClient {
  readonly baseUrl: string;
  private readonly options: Required<
    Pick<ThicketClientOptions, "userAgent" | "maxAttempts">
  > &
    ThicketClientOptions;
  private readonly fetchImpl: typeof globalThis.fetch;

  constructor(options: ThicketClientOptions) {
    if (!options.token) {
      throw new ThicketError("usage", "token is required");
    }
    if (!options.userAgent?.trim()) {
      throw new ThicketError(
        "usage",
        'userAgent is required: name your app and a contact, e.g. "AcmeSync (dev@acme.com)"',
      );
    }
    this.baseUrl = (options.baseUrl ?? "https://www.thickethq.com").replace(
      /\/$/,
      "",
    );
    if (!/^https:/.test(this.baseUrl) && !/localhost|127\.0\.0\.1/.test(this.baseUrl)) {
      throw new ThicketError("usage", "baseUrl must be HTTPS (localhost excepted)");
    }
    this.options = { maxAttempts: 3, ...options };
    this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  private async token(): Promise<string> {
    const t = this.options.token;
    return typeof t === "function" ? t() : t;
  }

  /**
   * One API call. `path` starts at the API root, e.g. "/api/v1/authorization"
   * or "/api/v1/acme/projects". Retries 429 and 5xx with exponential backoff
   * (Retry-After wins when present); POST is never retried.
   */
  async request<T>(
    method: string,
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const url = new URL(this.baseUrl + path);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    }
    const attempts = method === "POST" ? 1 : this.options.maxAttempts;
    let lastError: ThicketError | null = null;

    for (let attempt = 0; attempt < attempts; attempt++) {
      let response: Response;
      try {
        response = await this.fetchImpl(url, {
          method,
          headers: {
            authorization: `Bearer ${await this.token()}`,
            "user-agent": this.options.userAgent,
            accept: "application/json",
            ...(options.body !== undefined
              ? { "content-type": "application/json" }
              : {}),
            ...options.headers,
          },
          body:
            options.rawBody ??
            (options.body !== undefined
              ? JSON.stringify(options.body)
              : undefined),
          signal: options.signal,
          redirect: "follow",
        });
      } catch (err) {
        lastError = new ThicketError(
          "network",
          err instanceof Error ? err.message : "network error",
          undefined,
          true,
        );
        await this.backoff(attempt, undefined);
        continue;
      }

      if (response.ok) {
        if (response.status === 204) return undefined as T;
        return (await response.json()) as T;
      }

      lastError = await this.toError(response);
      if (NEVER_RETRY.has(response.status) || !RETRYABLE_STATUSES.has(response.status)) {
        throw lastError;
      }
      if (attempt < attempts - 1) {
        await this.backoff(attempt, lastError.retryAfter);
      }
    }
    throw lastError!;
  }

  private async toError(response: Response): Promise<ThicketError> {
    let message = response.statusText || `HTTP ${response.status}`;
    let apiCode: string | undefined;
    try {
      const body = (await response.json()) as {
        error?: { code?: string; message?: string };
      };
      if (body?.error?.message) message = body.error.message;
      apiCode = body?.error?.code;
    } catch {
      // Non-JSON error body: keep the status text.
    }
    const retryAfterHeader = response.headers.get("retry-after");
    const retryAfter = retryAfterHeader
      ? Number.parseInt(retryAfterHeader, 10) || undefined
      : undefined;
    return new ThicketError(
      STATUS_TO_CODE[response.status] ?? "api_error",
      message.slice(0, 500),
      response.status,
      RETRYABLE_STATUSES.has(response.status),
      retryAfter,
      apiCode,
    );
  }

  private backoff(attempt: number, retryAfter: number | undefined): Promise<void> {
    const ms =
      retryAfter !== undefined
        ? retryAfter * 1000
        : 1000 * 2 ** attempt + Math.random() * 250;
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Auto-pagination for `?page`/`?per_page` listings: yields every item,
   * following pages until a short page. `perPage` caps at 100 server-side.
   */
  async *paginate<T>(
    path: string,
    options: RequestOptions & { perPage?: number } = {},
  ): AsyncGenerator<T, void, void> {
    const perPage = Math.min(options.perPage ?? 100, 100);
    for (let page = 1; ; page++) {
      const items = await this.request<T[]>("GET", path, {
        ...options,
        query: { ...options.query, page, per_page: perPage },
      });
      for (const item of items) yield item;
      if (items.length < perPage) return;
    }
  }
}
