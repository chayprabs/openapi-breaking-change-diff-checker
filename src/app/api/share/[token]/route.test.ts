import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const selectMock = vi.fn();

vi.mock("@/lib/db", () => ({
  ensureDatabaseReady: vi.fn().mockResolvedValue(undefined),
  db: {
    select: (...args: unknown[]) => selectMock(...args),
  },
}));

function createRequest(token: string) {
  return new Request(`http://localhost/api/share/${token}`, {
    method: "GET",
  });
}

describe("GET /api/share/[token]", () => {
  beforeEach(() => {
    selectMock.mockReset();
  });

  it("returns 404 when the share token does not exist", async () => {
    selectMock.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const response = await GET(createRequest("missing-token"), {
      params: Promise.resolve({ token: "missing-token" }),
    });

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
  });

  it("returns 410 when the share link is expired", async () => {
    selectMock.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            {
              expiresAt: new Date(Date.now() - 1_000),
              reportId: "report-1",
              token: "expired-token",
            },
          ]),
        }),
      }),
    });

    const response = await GET(createRequest("expired-token"), {
      params: Promise.resolve({ token: "expired-token" }),
    });

    expect(response.status).toBe(410);
  });

  it("returns report payload with no-store headers", async () => {
    selectMock
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                expiresAt: new Date(Date.now() + 60_000),
                reportId: "report-1",
                token: "valid-token",
              },
            ]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: "report-1",
                reportJson: JSON.stringify({ summary: { totalFindings: 1 } }),
                settingsJson: null,
                title: "Demo report",
                tool: "openapi_diff",
              },
            ]),
          }),
        }),
      });

    const response = await GET(createRequest("valid-token"), {
      params: Promise.resolve({ token: "valid-token" }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
    await expect(response.json()).resolves.toMatchObject({
      reportId: "report-1",
      title: "Demo report",
      tool: "openapi_diff",
    });
  });
});
