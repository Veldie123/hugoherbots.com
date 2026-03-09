import Stripe from 'stripe';

const secretKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET;

if (!secretKey) {
  console.warn('[Stripe] No STRIPE_SECRET_KEY or STRIPE_SECRET found in environment — Stripe disabled');
}

export const stripe: Stripe | null = secretKey
  ? new Stripe(secretKey, { apiVersion: '2025-04-30.basil' as any })
  : null;

export function getStripeClient(): Stripe {
  if (!stripe) {
    throw new Error('Stripe not configured — set STRIPE_SECRET_KEY or STRIPE_SECRET env var');
  }
  return stripe;
}
