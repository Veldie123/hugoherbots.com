/**
 * Unit tests for server/hugo-engine/auth-middleware.ts
 *
 * Tests: requireAuth, requireAdmin, optionalAuth
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";

// Mock supabase before importing the module under test
const mockGetUser = vi.fn();
vi.mock("../../server/hugo-engine/supabase-client", () => ({
  supabase: {
    auth: { getUser: (...args: any[]) => mockGetUser(...args) },
  },
}));

import {
  requireAuth,
  requireAdmin,
  optionalAuth,
} from "../../server/hugo-engine/auth-middleware";

function mockReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    ...overrides,
  } as unknown as Request;
}

function mockRes(): Response {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

const next: NextFunction = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── requireAuth ────────────────────────────────────────────────────────────

describe("requireAuth", () => {
  it("returns 401 when no Authorization header", async () => {
    const req = mockReq();
    const res = mockRes();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Authentication required" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when Authorization header does not start with Bearer", async () => {
    const req = mockReq({ headers: { authorization: "Basic abc123" } });
    const res = mockRes();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when supabase returns an error", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error("Invalid JWT"),
    });

    const req = mockReq({ headers: { authorization: "Bearer bad-token" } });
    const res = mockRes();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: "Invalid or expired token",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when supabase returns no user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const req = mockReq({ headers: { authorization: "Bearer some-token" } });
    const res = mockRes();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("attaches userId, userEmail and calls next() for valid user", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "user-123",
          email: "test@example.com",
        },
      },
      error: null,
    });

    const req = mockReq({ headers: { authorization: "Bearer valid-token" } });
    const res = mockRes();

    await requireAuth(req, res, next);

    expect(req.userId).toBe("user-123");
    expect(req.userEmail).toBe("test@example.com");
    expect(req.isAdmin).toBe(false);
    expect(next).toHaveBeenCalled();
  });

  it("sets isAdmin=true for @hugoherbots.com emails", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          id: "admin-1",
          email: "hugo@hugoherbots.com",
        },
      },
      error: null,
    });

    const req = mockReq({ headers: { authorization: "Bearer admin-token" } });
    const res = mockRes();

    await requireAuth(req, res, next);

    expect(req.isAdmin).toBe(true);
    expect(req.userId).toBe("admin-1");
    expect(next).toHaveBeenCalled();
  });

  it("returns 401 when getUser throws an exception", async () => {
    mockGetUser.mockRejectedValue(new Error("Network error"));

    const req = mockReq({ headers: { authorization: "Bearer token" } });
    const res = mockRes();

    await requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Authentication failed" });
    expect(next).not.toHaveBeenCalled();
  });

  it("sets userEmail to undefined when user has no email", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "no-email-user", email: null } },
      error: null,
    });

    const req = mockReq({ headers: { authorization: "Bearer token" } });
    const res = mockRes();

    await requireAuth(req, res, next);

    expect(req.userId).toBe("no-email-user");
    expect(req.userEmail).toBeUndefined();
    expect(req.isAdmin).toBe(false);
    expect(next).toHaveBeenCalled();
  });
});

// ─── requireAdmin ───────────────────────────────────────────────────────────

describe("requireAdmin", () => {
  it("returns 403 when isAdmin is false", () => {
    const req = mockReq();
    req.isAdmin = false;
    const res = mockRes();

    requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "Admin access required" });
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 when isAdmin is undefined", () => {
    const req = mockReq();
    const res = mockRes();

    requireAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() when isAdmin is true", () => {
    const req = mockReq();
    req.isAdmin = true;
    const res = mockRes();

    requireAdmin(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

// ─── optionalAuth ───────────────────────────────────────────────────────────

describe("optionalAuth", () => {
  it("calls next() without auth when no Authorization header", async () => {
    const req = mockReq();
    const res = mockRes();

    await optionalAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.userId).toBeUndefined();
  });

  it("calls next() without auth when Authorization is not Bearer", async () => {
    const req = mockReq({ headers: { authorization: "Basic abc" } });
    const res = mockRes();

    await optionalAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.userId).toBeUndefined();
  });

  it("attaches user info when valid token is provided", async () => {
    mockGetUser.mockResolvedValue({
      data: {
        user: { id: "user-456", email: "user@test.com" },
      },
    });

    const req = mockReq({ headers: { authorization: "Bearer good-token" } });
    const res = mockRes();

    await optionalAuth(req, res, next);

    expect(req.userId).toBe("user-456");
    expect(req.userEmail).toBe("user@test.com");
    expect(req.isAdmin).toBe(false);
    expect(next).toHaveBeenCalled();
  });

  it("continues without auth when token is invalid", async () => {
    mockGetUser.mockRejectedValue(new Error("Bad token"));

    const req = mockReq({ headers: { authorization: "Bearer bad" } });
    const res = mockRes();

    await optionalAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.userId).toBeUndefined();
  });

  it("continues without auth when getUser returns no user", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const req = mockReq({ headers: { authorization: "Bearer expired" } });
    const res = mockRes();

    await optionalAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.userId).toBeUndefined();
  });
});
