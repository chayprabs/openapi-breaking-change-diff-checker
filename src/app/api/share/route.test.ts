import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const { authMock, insertValuesMock, selectMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  insertValuesMock: vi.fn().mockResolvedValue(undefined),
  selectMock: vi.fn(),
}));

vi.mock("@/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/db", () => ({
  ensureDatabaseReady: vi.fn().mockResolvedValue(undefined),
  db: {
    insert: vi.fn().mockReturnValue({ values: insertValuesMock }),
    select: (...args: unknown[]) => selectMock(...args),
  },
}));

function createRequest(body: unknown) {
  return new Request("http://localhost/api/share", {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

describe("POST /api/share", () => {
  beforeEach(() => {
    selectMock.mockReset();
    insertValuesMock.mockClear();
    authMock.mockResolvedValue({
      user: { email: "owner@example.com" },
    });
  });

  it("returns 401 when the user is not authenticated", async () => {
    authMock.mockResolvedValue(null);

    const response = await POST(createRequest({ reportId: "report-1" }));

    expect(response.status).toBe(401);
  });

  it("returns 404 when the report does not belong to the user", async () => {
    selectMock.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            {
              id: "report-1",
              orgId: "org-1",
              userId: "someone-else@example.com",
            },
          ]),
        }),
      }),
    });

    const response = await POST(createRequest({ reportId: "report-1" }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Report not found." });
  });

  it("returns 403 when the user is not a member of the report org", async () => {
    selectMock
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: "report-1",
                orgId: "org-1",
                userId: "owner@example.com",
              },
            ]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

    const response = await POST(createRequest({ reportId: "report-1" }));

    expect(response.status).toBe(403);
  });

  it("creates a share link for an owned org report", async () => {
    selectMock
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: "report-1",
                orgId: "org-1",
                userId: "owner@example.com",
              },
            ]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: "membership-1" }]),
          }),
        }),
      });

    const response = await POST(createRequest({ reportId: "report-1" }));

    expect(response.status).toBe(201);
    expect(insertValuesMock).toHaveBeenCalledOnce();
    await expect(response.json()).resolves.toMatchObject({
      path: expect.stringMatching(/^\/share\/[a-f0-9]+$/),
      token: expect.any(String),
    });
  });
});
