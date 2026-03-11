/**
 * Unit tests for server/hugo-engine/routes/stripe.ts — webhook handler
 *
 * Tests signature verification and event-type handling without real Stripe calls.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockConstructEvent = vi.fn();
const mockSubscriptionsRetrieve = vi.fn();
const mockProductsRetrieve = vi.fn();
const mockPoolQuery = vi.fn();

vi.mock("../../src/server/stripeClient", () => ({
  getStripeClient: () => ({
    webhooks: { constructEvent: mockConstructEvent },
    subscriptions: { retrieve: mockSubscriptionsRetrieve },
    products: { retrieve: mockProductsRetrieve },
  }),
}));

vi.mock("../../server/hugo-engine/db", () => ({
  pool: { query: (...args: any[]) => mockPoolQuery(...args) },
}));

import { registerStripeWebhook } from "../../server/hugo-engine/routes/stripe";

// ─── Test app ───────────────────────────────────────────────────────────────

function createApp() {
  const app = express();
  registerStripeWebhook(app);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
});

// ─── Signature Verification ─────────────────────────────────────────────────

describe("Stripe webhook — signature verification", () => {
  it("returns 400 when stripe-signature header is missing", async () => {
    const app = createApp();

    const res = await request(app)
      .post("/api/stripe/webhook")
      .set("Content-Type", "application/json")
      .send(JSON.stringify({ type: "test" }));

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Missing stripe-signature/);
  });

  it("returns 400 when STRIPE_WEBHOOK_SECRET is not set", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const app = createApp();

    const res = await request(app)
      .post("/api/stripe/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "sig_test")
      .send(JSON.stringify({ type: "test" }));

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Missing stripe-signature/);
  });

  it("returns 400 when constructEvent throws (invalid signature)", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("Signature mismatch");
    });
    const app = createApp();

    const res = await request(app)
      .post("/api/stripe/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "sig_bad")
      .send(JSON.stringify({ type: "test" }));

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/verification failed/);
  });
});

// ─── checkout.session.completed ─────────────────────────────────────────────

describe("Stripe webhook — checkout.session.completed", () => {
  it("updates workspace plan_tier on successful checkout", async () => {
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          customer_details: { email: "buyer@example.com" },
          customer: "cus_123",
          subscription: "sub_456",
        },
      },
    });

    mockSubscriptionsRetrieve.mockResolvedValue({
      items: {
        data: [
          {
            price: {
              product: { metadata: { tier: "enterprise" } },
            },
          },
        ],
      },
    });

    mockPoolQuery.mockResolvedValue({ rows: [] });

    const app = createApp();
    const res = await request(app)
      .post("/api/stripe/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "sig_valid")
      .send(JSON.stringify({}));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });

    expect(mockPoolQuery).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE workspaces SET plan_tier"),
      ["enterprise", "cus_123", "sub_456", "buyer@example.com"]
    );
  });

  it("defaults to 'pro' tier when product has no tier metadata", async () => {
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          customer_details: { email: "buyer@test.com" },
          customer: "cus_x",
          subscription: "sub_y",
        },
      },
    });

    mockSubscriptionsRetrieve.mockResolvedValue({
      items: { data: [{ price: { product: { metadata: {} } } }] },
    });

    mockPoolQuery.mockResolvedValue({ rows: [] });

    const app = createApp();
    const res = await request(app)
      .post("/api/stripe/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "sig_valid")
      .send(JSON.stringify({}));

    expect(res.status).toBe(200);
    expect(mockPoolQuery).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE workspaces"),
      ["pro", "cus_x", "sub_y", "buyer@test.com"]
    );
  });

  it("skips DB update when email or subscriptionId is missing", async () => {
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          customer_details: {},
          customer: "cus_no_email",
          subscription: null,
        },
      },
    });

    const app = createApp();
    const res = await request(app)
      .post("/api/stripe/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "sig_valid")
      .send(JSON.stringify({}));

    expect(res.status).toBe(200);
    expect(mockPoolQuery).not.toHaveBeenCalled();
  });
});

// ─── customer.subscription.updated ──────────────────────────────────────────

describe("Stripe webhook — customer.subscription.updated", () => {
  it("updates plan_tier based on product metadata", async () => {
    mockConstructEvent.mockReturnValue({
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_updated",
          status: "active",
          items: {
            data: [
              {
                price: {
                  product: { metadata: { tier: "business" } },
                },
              },
            ],
          },
        },
      },
    });

    mockPoolQuery.mockResolvedValue({ rows: [] });

    const app = createApp();
    const res = await request(app)
      .post("/api/stripe/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "sig_valid")
      .send(JSON.stringify({}));

    expect(res.status).toBe(200);
    expect(mockPoolQuery).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE workspaces SET plan_tier"),
      ["business", "sub_updated"]
    );
  });

  it("sets plan_tier to 'free' when subscription is not active", async () => {
    mockConstructEvent.mockReturnValue({
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_paused",
          status: "past_due",
          items: {
            data: [
              {
                price: {
                  product: { metadata: { tier: "pro" } },
                },
              },
            ],
          },
        },
      },
    });

    mockPoolQuery.mockResolvedValue({ rows: [] });

    const app = createApp();
    const res = await request(app)
      .post("/api/stripe/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "sig_valid")
      .send(JSON.stringify({}));

    expect(res.status).toBe(200);
    expect(mockPoolQuery).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE workspaces SET plan_tier"),
      ["free", "sub_paused"]
    );
  });

  it("fetches product when it's a string ID (not expanded)", async () => {
    mockConstructEvent.mockReturnValue({
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_string_product",
          status: "active",
          items: {
            data: [{ price: { product: "prod_abc" } }],
          },
        },
      },
    });

    mockProductsRetrieve.mockResolvedValue({
      metadata: { tier: "premium" },
    });

    mockPoolQuery.mockResolvedValue({ rows: [] });

    const app = createApp();
    const res = await request(app)
      .post("/api/stripe/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "sig_valid")
      .send(JSON.stringify({}));

    expect(res.status).toBe(200);
    expect(mockProductsRetrieve).toHaveBeenCalledWith("prod_abc");
    expect(mockPoolQuery).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE workspaces"),
      ["premium", "sub_string_product"]
    );
  });
});

// ─── customer.subscription.deleted ──────────────────────────────────────────

describe("Stripe webhook — customer.subscription.deleted", () => {
  it("resets workspace to free plan and clears subscription ID", async () => {
    mockConstructEvent.mockReturnValue({
      type: "customer.subscription.deleted",
      data: { object: { id: "sub_deleted" } },
    });

    mockPoolQuery.mockResolvedValue({ rows: [] });

    const app = createApp();
    const res = await request(app)
      .post("/api/stripe/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "sig_valid")
      .send(JSON.stringify({}));

    expect(res.status).toBe(200);
    expect(mockPoolQuery).toHaveBeenCalledWith(
      expect.stringContaining("plan_tier = 'free'"),
      ["sub_deleted"]
    );
    expect(mockPoolQuery).toHaveBeenCalledWith(
      expect.stringContaining("stripe_subscription_id = NULL"),
      ["sub_deleted"]
    );
  });
});

// ─── invoice.payment_failed ─────────────────────────────────────────────────

describe("Stripe webhook — invoice.payment_failed", () => {
  it("returns 200 and logs warning (no DB mutation)", async () => {
    mockConstructEvent.mockReturnValue({
      type: "invoice.payment_failed",
      data: { object: { customer: "cus_fail", amount_due: 9900 } },
    });

    const app = createApp();
    const res = await request(app)
      .post("/api/stripe/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "sig_valid")
      .send(JSON.stringify({}));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
    expect(mockPoolQuery).not.toHaveBeenCalled();
  });
});

// ─── Unknown event ──────────────────────────────────────────────────────────

describe("Stripe webhook — unknown event type", () => {
  it("returns 200 for unhandled event types", async () => {
    mockConstructEvent.mockReturnValue({
      type: "some.future.event",
      data: { object: {} },
    });

    const app = createApp();
    const res = await request(app)
      .post("/api/stripe/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "sig_valid")
      .send(JSON.stringify({}));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
  });
});

// ─── Error handling ─────────────────────────────────────────────────────────

describe("Stripe webhook — error handling", () => {
  it("returns 500 when handler throws during event processing", async () => {
    mockConstructEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: {
        object: {
          customer_details: { email: "err@test.com" },
          customer: "cus_err",
          subscription: "sub_err",
        },
      },
    });

    mockSubscriptionsRetrieve.mockRejectedValue(
      new Error("Stripe API down")
    );

    const app = createApp();
    const res = await request(app)
      .post("/api/stripe/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "sig_valid")
      .send(JSON.stringify({}));

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Webhook handler error");
  });
});
