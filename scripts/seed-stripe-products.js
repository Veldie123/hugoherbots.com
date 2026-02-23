#!/usr/bin/env node

require('tsx/cjs/api');
const path = require('path');
const { getUncachableStripeClient } = require(path.resolve(__dirname, '../src/server/stripeClient.ts'));

const PRODUCTS = [
  {
    name: 'Pro',
    description: 'AI-avatar simulaties, persoonlijk dashboard & feedback, video platform',
    metadata: { tier: 'pro' },
    prices: [
      { unit_amount: 4900, currency: 'eur', interval: 'month', metadata: { interval: 'month' } },
      { unit_amount: 34800, currency: 'eur', interval: 'year', metadata: { interval: 'year' } },
    ],
  },
  {
    name: 'Founder',
    description: 'Alles van Pro + dagelijkse live sessies met Hugo, Founder community',
    metadata: { tier: 'founder', max_seats: '100' },
    prices: [
      { unit_amount: 49900, currency: 'eur', interval: 'month', metadata: { interval: 'month' } },
      { unit_amount: 299400, currency: 'eur', interval: 'year', metadata: { interval: 'year' } },
    ],
  },
  {
    name: 'Inner Circle',
    description: 'Alles van Founder + exclusieve 1-op-1 coaching, directe lijn met Hugo',
    metadata: { tier: 'inner_circle', max_seats: '20' },
    prices: [
      { unit_amount: 149900, currency: 'eur', interval: 'month', metadata: { interval: 'month' } },
      { unit_amount: 1498800, currency: 'eur', interval: 'year', metadata: { interval: 'year' } },
    ],
  },
];

async function seed() {
  const stripe = await getUncachableStripeClient();
  console.log('Connected to Stripe');

  for (const productDef of PRODUCTS) {
    const existing = await stripe.products.search({
      query: `name:'${productDef.name}'`,
    });

    if (existing.data.length > 0) {
      console.log(`Product "${productDef.name}" bestaat al (${existing.data[0].id}), overgeslagen`);
      continue;
    }

    const product = await stripe.products.create({
      name: productDef.name,
      description: productDef.description,
      metadata: productDef.metadata,
    });
    console.log(`Product aangemaakt: ${product.name} (${product.id})`);

    for (const priceDef of productDef.prices) {
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: priceDef.unit_amount,
        currency: priceDef.currency,
        recurring: { interval: priceDef.interval },
        metadata: priceDef.metadata,
      });
      console.log(`  Prijs aangemaakt: ${price.id} — €${(priceDef.unit_amount / 100).toFixed(2)}/${priceDef.interval}`);
    }
  }

  console.log('Seed voltooid!');
}

seed().catch(err => {
  console.error('Seed fout:', err.message);
  process.exit(1);
});
