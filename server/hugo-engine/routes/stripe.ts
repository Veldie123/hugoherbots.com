/**
 * Stripe payment routes — webhook, products, checkout, subscription, portal
 */
import express, { type Request, type Response, type Express } from "express";
import { getStripeClient } from "../../../src/server/stripeClient";
import { pool } from "../db";

/** Sanitize 500 errors: show details only in dev, generic message in production */
function sendError(res: Response, err: any, fallback = 'Stripe-fout') {
  console.error('[API Error]', err?.message || err);
  const isDev = process.env.NODE_ENV !== 'production';
  res.status(500).json({ error: isDev ? (err?.message || fallback) : fallback });
}

/**
 * Register the Stripe webhook route.
 * MUST be called BEFORE express.json() middleware because
 * webhook signature verification requires the raw (unparsed) request body.
 */
export function registerStripeWebhook(app: Express): void {
  app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'] as string | undefined;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!sig || !webhookSecret) {
      return res.status(400).json({ error: 'Missing stripe-signature header or STRIPE_WEBHOOK_SECRET' });
    }

    let event: any;
    try {
      const stripe = getStripeClient();
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      console.error('[Stripe Webhook] Signature verification failed:', err.message);
      return res.status(400).json({ error: 'Webhook signature verification failed' });
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          const customerEmail = session.customer_details?.email || session.customer_email;
          const customerId = session.customer;
          const subscriptionId = session.subscription;

          if (customerEmail && subscriptionId) {
            const stripe = getStripeClient();
            const subscription = await stripe.subscriptions.retrieve(subscriptionId as string, { expand: ['items.data.price.product'] });
            const product = subscription.items.data[0]?.price?.product as any;
            const tier = product?.metadata?.tier || 'pro';

            await pool.query(
              `UPDATE workspaces SET plan_tier = $1, stripe_customer_id = $2, stripe_subscription_id = $3
               WHERE owner_id = (SELECT id FROM auth.users WHERE email = $4 LIMIT 1)`,
              [tier, customerId, subscriptionId, customerEmail]
            );
            console.log(`[Stripe Webhook] checkout.session.completed — ${customerEmail} → ${tier}`);
          }
          break;
        }

        case 'customer.subscription.updated': {
          const subscription = event.data.object;
          const product = subscription.items?.data?.[0]?.price?.product;
          let tier = 'pro';
          if (typeof product === 'object' && product?.metadata?.tier) {
            tier = product.metadata.tier;
          } else if (typeof product === 'string') {
            const stripe = getStripeClient();
            const prod = await stripe.products.retrieve(product);
            tier = prod.metadata?.tier || 'pro';
          }

          await pool.query(
            `UPDATE workspaces SET plan_tier = $1 WHERE stripe_subscription_id = $2`,
            [subscription.status === 'active' ? tier : 'free', subscription.id]
          );
          console.log(`[Stripe Webhook] subscription.updated — ${subscription.id} → ${tier} (${subscription.status})`);
          break;
        }

        case 'customer.subscription.deleted': {
          const subscription = event.data.object;
          await pool.query(
            `UPDATE workspaces SET plan_tier = 'free', stripe_subscription_id = NULL WHERE stripe_subscription_id = $1`,
            [subscription.id]
          );
          console.log(`[Stripe Webhook] subscription.deleted — ${subscription.id} → free`);
          break;
        }

        case 'invoice.payment_failed': {
          const invoice = event.data.object;
          console.warn(`[Stripe Webhook] invoice.payment_failed — customer ${invoice.customer}, amount ${invoice.amount_due}`);
          break;
        }

        default:
          console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (err: any) {
      console.error(`[Stripe Webhook] Error handling ${event.type}:`, err.message);
      res.status(500).json({ error: 'Webhook handler error' });
    }
  });
}

/**
 * Register Stripe CRUD routes (products, checkout, subscription, portal).
 * Called AFTER express.json() and auth middleware are set up.
 */
export function registerStripeRoutes(app: Express): void {
  // GET /api/stripe/products — List active products with their prices
  app.get("/api/stripe/products", async (_req: Request, res: Response) => {
    try {
      const stripeClient = getStripeClient();
      const products = await stripeClient.products.list({ active: true, limit: 100 });
      const prices = await stripeClient.prices.list({ active: true, limit: 100 });

      const data = products.data.map((product) => ({
        id: product.id,
        name: product.name,
        description: product.description || "",
        active: product.active,
        metadata: product.metadata || null,
        prices: prices.data
          .filter((p) => p.product === product.id)
          .map((p) => ({
            id: p.id,
            unit_amount: p.unit_amount || 0,
            currency: p.currency,
            recurring: p.recurring ? { interval: p.recurring.interval } : null,
            active: p.active,
            metadata: p.metadata || null,
          })),
      }));

      res.json({ data });
    } catch (err: any) {
      console.error("[Stripe] Products error:", err.message);
      sendError(res, err);
    }
  });

  // POST /api/stripe/checkout — Create a checkout session
  app.post("/api/stripe/checkout", async (req: Request, res: Response) => {
    try {
      const stripeClient = getStripeClient();
      const { priceId, customerEmail, successUrl, cancelUrl } = req.body;
      if (!priceId) return res.status(400).json({ error: "priceId is vereist" });

      const email = customerEmail || (req as any).userEmail;

      // Find or create Stripe customer by email
      let customerId: string | undefined;
      if (email) {
        const existing = await stripeClient.customers.list({ email, limit: 1 });
        if (existing.data.length > 0) {
          customerId = existing.data[0].id;
        } else {
          const newCustomer = await stripeClient.customers.create({ email });
          customerId = newCustomer.id;
        }
      }

      const session = await stripeClient.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        customer: customerId,
        customer_email: customerId ? undefined : email,
        success_url: successUrl || `${req.headers.origin || "https://hugoherbots.com"}/settings?section=subscription&success=true`,
        cancel_url: cancelUrl || `${req.headers.origin || "https://hugoherbots.com"}/pricing`,
      });

      res.json({ url: session.url });
    } catch (err: any) {
      console.error("[Stripe] Checkout error:", err.message);
      sendError(res, err);
    }
  });

  // GET /api/stripe/subscription — Get current subscription for a user
  app.get("/api/stripe/subscription", async (req: Request, res: Response) => {
    try {
      const stripeClient = getStripeClient();
      // Only admins can look up other users' subscriptions
      const requestedEmail = req.query.email as string | undefined;
      const email = (req.isAdmin && requestedEmail) ? requestedEmail : (req as any).userEmail;
      if (!email) return res.json({ subscription: null });

      const customers = await stripeClient.customers.list({ email, limit: 1 });
      if (customers.data.length === 0) return res.json({ subscription: null });

      const customer = customers.data[0];
      const subscriptions = await stripeClient.subscriptions.list({
        customer: customer.id,
        status: "active",
        limit: 1,
        expand: ["data.items.data.price.product"],
      });

      if (subscriptions.data.length === 0) return res.json({ subscription: null });

      const sub = subscriptions.data[0];
      const item = sub.items.data[0];
      const price = item.price;
      const product = price.product as import("stripe").Stripe.Product;

      res.json({
        subscription: {
          id: sub.id,
          status: sub.status,
          currentPeriodEnd: new Date((sub as any).current_period_end * 1000).toISOString(),
          customerId: customer.id,
          product: { id: product.id, name: product.name },
          price: {
            unitAmount: price.unit_amount || 0,
            currency: price.currency,
            recurring: price.recurring ? { interval: price.recurring.interval } : null,
          },
        },
      });
    } catch (err: any) {
      console.error("[Stripe] Subscription error:", err.message);
      sendError(res, err);
    }
  });

  // POST /api/stripe/portal — Create a billing portal session
  app.post("/api/stripe/portal", async (req: Request, res: Response) => {
    try {
      const stripeClient = getStripeClient();
      const { customerId, returnUrl } = req.body;
      if (!customerId) return res.status(400).json({ error: "customerId is vereist" });

      const session = await stripeClient.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl || `${req.headers.origin || "https://hugoherbots.com"}/settings?section=subscription`,
      });

      res.json({ url: session.url });
    } catch (err: any) {
      console.error("[Stripe] Portal error:", err.message);
      sendError(res, err);
    }
  });
}
