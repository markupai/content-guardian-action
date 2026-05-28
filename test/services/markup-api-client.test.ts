import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@actions/core", () => ({
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

import {
  MarkupApiError,
  assertStyleAgentEnabled,
  getStyleAgentConfig,
  getWorkflowStatus,
  isFatalApiError,
  listStyleAgentTargets,
  pollUntilDone,
  runStyleAgent,
} from "../../src/services/markup-api-client.js";
import { STYLE_AGENT_ID } from "../../src/constants/index.js";
import type { OrganizationConfigResponse, StyleTarget } from "../../src/types/index.js";

type FetchResp = {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
};

function makeResp(body: unknown, init: { ok?: boolean; status?: number } = {}): FetchResp {
  const status = init.status ?? 200;
  return {
    ok: init.ok ?? status < 400,
    status,
    text: () => Promise.resolve(typeof body === "string" ? body : JSON.stringify(body)),
  };
}

const fetchMock = vi.fn();
globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;

beforeEach(() => {
  fetchMock.mockReset();
});

describe("markup-api-client request", () => {
  it("sends auth + integration headers on GET", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResp({
        is_acrolinx_classic: false,
        style_agent: "enabled",
        style_agent_numeric_scoring: true,
      }),
    );
    const config = await getStyleAgentConfig("test-key");
    expect(config.style_agent_numeric_scoring).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.markup.ai/style-agent/config");
    expect(init.method).toBe("GET");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-key");
    expect(headers["x-integration-id"]).toBe("markupai-content-guardian-action");
  });

  it("throws MarkupApiError on 401 with extracted message + request_id", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResp({ detail: "Not authenticated.", request_id: "req-42" }, { ok: false, status: 401 }),
    );
    await expect(getStyleAgentConfig("bad")).rejects.toMatchObject({
      name: "MarkupApiError",
      status: 401,
      requestId: "req-42",
      message: "Not authenticated.",
    });
  });

  it("retries once on 5xx and succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce(
        makeResp({ detail: "boom", request_id: "r1" }, { ok: false, status: 502 }),
      )
      .mockResolvedValueOnce(
        makeResp({
          is_acrolinx_classic: false,
          style_agent: "enabled",
          style_agent_numeric_scoring: false,
        }),
      );
    const config = await getStyleAgentConfig("k");
    expect(config.style_agent).toBe("enabled");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry on 4xx", async () => {
    fetchMock.mockResolvedValueOnce(makeResp({ detail: "bad" }, { ok: false, status: 422 }));
    await expect(getStyleAgentConfig("k")).rejects.toBeInstanceOf(MarkupApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("listStyleAgentTargets", () => {
  it("filters to enabled targets", async () => {
    const targets: StyleTarget[] = [
      { id: "a", display_name: "A", is_default: false, enabled: true },
      { id: "b", display_name: "B", is_default: false, enabled: false },
    ];
    fetchMock.mockResolvedValueOnce(makeResp(targets));
    const result = await listStyleAgentTargets("k");
    expect(result.map((t) => t.id)).toEqual(["a"]);
  });

  it("returns [] when API returns null", async () => {
    fetchMock.mockResolvedValueOnce(makeResp(null));
    expect(await listStyleAgentTargets("k")).toEqual([]);
  });
});

describe("assertStyleAgentEnabled", () => {
  const base: OrganizationConfigResponse = {
    is_acrolinx_classic: false,
    style_agent: "disabled",
    style_agent_numeric_scoring: false,
  };

  it("passes for enabled mode", () => {
    expect(() => {
      assertStyleAgentEnabled({ ...base, style_agent: "enabled" });
    }).not.toThrow();
  });

  it("passes for enabled_terminology", () => {
    expect(() => {
      assertStyleAgentEnabled({ ...base, style_agent: "enabled_terminology" });
    }).not.toThrow();
  });

  it("throws for disabled", () => {
    expect(() => {
      assertStyleAgentEnabled(base);
    }).toThrow(/not enabled/);
  });
});

describe("runStyleAgent", () => {
  it("posts to hardcoded style agent id with wait=false", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResp({
        workflow_id: "agw_1",
        status: "running",
        started_at: "2026-01-01T00:00:00Z",
      }),
    );
    const resp = await runStyleAgent("k", { text: "hi", target_id: "tgt_x" });
    expect(resp.workflow_id).toBe("agw_1");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`https://api.markup.ai/agents/${STYLE_AGENT_ID}/run?wait=false`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ text: "hi", target_id: "tgt_x" });
  });
});

describe("pollUntilDone", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns once the workflow status is terminal", async () => {
    fetchMock
      .mockResolvedValueOnce(
        makeResp({ workflow_id: "w", status: "running", started_at: "2026-01-01" }),
      )
      .mockResolvedValueOnce(
        makeResp({ workflow_id: "w", status: "completed", started_at: "2026-01-01" }),
      );

    const promise = pollUntilDone("k", "w", { intervalMs: 10, timeoutMs: 1000 });
    // First poll runs immediately and returns "running"; advance time for the sleep.
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(10);
    const result = await promise;
    expect(result.status).toBe("completed");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("times out if it never becomes terminal", async () => {
    fetchMock.mockResolvedValue(
      makeResp({ workflow_id: "w", status: "running", started_at: "2026-01-01" }),
    );
    const promise = pollUntilDone("k", "w", { intervalMs: 5, timeoutMs: 20 });
    // Attach the rejection handler immediately so it's never an unhandled rejection.
    const assertion = expect(promise).rejects.toThrow(/polling timed out/);
    await vi.advanceTimersByTimeAsync(50);
    await assertion;
  });
});

describe("getWorkflowStatus", () => {
  it("URL-encodes the workflow id", async () => {
    fetchMock.mockResolvedValueOnce(
      makeResp({ workflow_id: "w/1", status: "completed", started_at: "2026-01-01" }),
    );
    await getWorkflowStatus("k", "w/1");
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toBe("https://api.markup.ai/agents/workflows/w%2F1");
  });
});

describe("isFatalApiError", () => {
  it("treats 401/403/5xx as fatal", () => {
    expect(isFatalApiError(new MarkupApiError("x", 401))).toBe(true);
    expect(isFatalApiError(new MarkupApiError("x", 403))).toBe(true);
    expect(isFatalApiError(new MarkupApiError("x", 503))).toBe(true);
  });
  it("does not treat 4xx (non-auth) as fatal", () => {
    expect(isFatalApiError(new MarkupApiError("x", 404))).toBe(false);
    expect(isFatalApiError(new MarkupApiError("x", 422))).toBe(false);
  });
  it("returns false for non-MarkupApiError", () => {
    expect(isFatalApiError(new Error("nope"))).toBe(false);
  });
});
