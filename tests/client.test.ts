// Transport contract: auth headers, error taxonomy, retry gates,
// Retry-After respect, pagination termination. All against a mocked fetch.
import { describe, expect, it, vi } from "vitest";
import { Thicket, ThicketClient, ThicketError } from "../src/index.js";

const OPTS = {
  token: "thicket_pat_test",
  userAgent: "sdk-tests (dev@test.local)",
};

function jsonResponse(status: number, body: unknown, headers?: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("construction", () => {
  it("requires token and userAgent", () => {
    expect(() => new ThicketClient({ ...OPTS, token: "" })).toThrow(ThicketError);
    expect(() => new ThicketClient({ ...OPTS, userAgent: " " })).toThrow(
      /userAgent/,
    );
  });
  it("refuses plain-http base URLs except localhost", () => {
    expect(
      () => new ThicketClient({ ...OPTS, baseUrl: "http://api.example.com" }),
    ).toThrow(/HTTPS/);
    expect(
      () => new ThicketClient({ ...OPTS, baseUrl: "http://localhost:3003" }),
    ).not.toThrow();
  });
});

describe("requests", () => {
  it("sends bearer auth and the user agent", async () => {
    const fetch = vi.fn(async () => jsonResponse(200, { ok: true })) as unknown as typeof globalThis.fetch;
    const client = new ThicketClient({ ...OPTS, fetch });
    await client.request("GET", "/api/v1/authorization");
    const [url, init] = (fetch as unknown as { mock: { calls: [URL, RequestInit][] } }).mock.calls[0];
    expect(String(url)).toBe("https://www.thickethq.com/api/v1/authorization");
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer thicket_pat_test");
    expect(headers["user-agent"]).toBe(OPTS.userAgent);
  });

  it("resolves async token providers", async () => {
    const fetch = vi.fn(async () => jsonResponse(200, {})) as unknown as typeof globalThis.fetch;
    const client = new ThicketClient({
      ...OPTS,
      token: async () => "thicket_pat_fresh",
      fetch,
    });
    await client.request("GET", "/x");
    const [, init] = (fetch as unknown as { mock: { calls: [URL, RequestInit][] } }).mock.calls[0];
    expect((init.headers as Record<string, string>).authorization).toBe(
      "Bearer thicket_pat_fresh",
    );
  });

  it("maps API errors to the taxonomy and never retries 4xx", async () => {
    const fetch = vi.fn(async () =>
      jsonResponse(403, { error: { code: "read_only_token", message: "nope" } }),
    ) as unknown as typeof globalThis.fetch;
    const client = new ThicketClient({ ...OPTS, fetch });
    const err = (await client.request("PUT", "/x").catch((e) => e)) as ThicketError;
    expect(err).toBeInstanceOf(ThicketError);
    expect(err.code).toBe("forbidden");
    expect(err.apiCode).toBe("read_only_token");
    expect(err.status).toBe(403);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("retries 429 honoring Retry-After, then succeeds", async () => {
    vi.useFakeTimers();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(429, { error: { code: "rate_limited", message: "slow" } }, { "retry-after": "1" }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { fine: true })) as unknown as typeof globalThis.fetch;
    const client = new ThicketClient({ ...OPTS, fetch });
    const pending = client.request<{ fine: boolean }>("GET", "/x");
    await vi.advanceTimersByTimeAsync(1000);
    await expect(pending).resolves.toEqual({ fine: true });
    expect(fetch).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("never retries POST", async () => {
    const fetch = vi.fn(async () =>
      jsonResponse(503, { error: { code: "unavailable", message: "down" } }),
    ) as unknown as typeof globalThis.fetch;
    const client = new ThicketClient({ ...OPTS, fetch });
    await expect(client.request("POST", "/x", { body: {} })).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("returns undefined for 204", async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 })) as unknown as typeof globalThis.fetch;
    const client = new ThicketClient({ ...OPTS, fetch });
    await expect(client.request("PUT", "/x")).resolves.toBeUndefined();
  });
});

describe("pagination", () => {
  it("follows pages until a short page", async () => {
    const pages: Record<string, unknown[]> = {
      "1": Array.from({ length: 3 }, (_, i) => ({ id: `a${i}` })),
      "2": [{ id: "b0" }],
    };
    const fetch = vi.fn(async (url: URL | RequestInfo) => {
      const page = new URL(String(url)).searchParams.get("page")!;
      return jsonResponse(200, pages[page] ?? []);
    }) as unknown as typeof globalThis.fetch;
    const client = new ThicketClient({ ...OPTS, fetch });
    const seen: string[] = [];
    for await (const item of client.paginate<{ id: string }>("/x", {
      perPage: 3,
    })) {
      seen.push(item.id);
    }
    expect(seen).toEqual(["a0", "a1", "a2", "b0"]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe("the front door", () => {
  it("scopes into organizations by slug", async () => {
    const fetch = vi.fn(async () => jsonResponse(200, [])) as unknown as typeof globalThis.fetch;
    const thicket = new Thicket({ ...OPTS, fetch });
    await thicket.org("acme").projects.list();
    const [url] = (fetch as unknown as { mock: { calls: [URL][] } }).mock.calls[0];
    expect(String(url)).toBe("https://www.thickethq.com/api/v1/acme/projects");
  });
});
