import { getUncachableStripeClient } from '../src/server/stripeClient';

async function seedProducts() {
  const stripe = await getUncachableStripeClient();
  console.log('[Stripe Seed] Connected to Stripe');

  const products = [
    {
      name: 'Pro',
      description: 'AI-avatar simulaties, persoonlijk dashboard, video platform met 54 technieken, transcript analyse, exports & rapportages.',
      metadata: { tier: 'pro', order: '1' },
      prices: [
        { unit_amount: 9800, currency: 'eur', interval: 'month' as const, metadata: { display: '€98/maand' } },
        { unit_amount: 58800, currency: 'eur', interval: 'year' as const, metadata: { display: '€49/maand (jaarlijks)' } },
      ],
    },
    {
      name: 'Founder',
      description: 'Alles van Pro + dagelijkse live sessies met Hugo, priority analyse, priority support, Founder community toegang.',
      metadata: { tier: 'founder', order: '2' },
      prices: [
        { unit_amount: 49800, currency: 'eur', interval: 'month' as const, metadata: { display: '€498/maand' } },
        { unit_amount: 298800, currency: 'eur', interval: 'year' as const, metadata: { display: '€249/maand (jaarlijks)' } },
      ],
    },
    {
      name: 'Inner Circle',
      description: 'Alles van Founder + exclusieve 1-op-1 coaching met Hugo, directe lijn, custom scenario\'s, dedicated onboarding.',
      metadata: { tier: 'inner_circle', order: '3' },
      prices: [
        { unit_amount: 249800, currency: 'eur', interval: 'month' as const, metadata: { display: '€2.498/maand' } },
        { unit_amount: 1498800, currency: 'eur', interval: 'year' as const, metadata: { display: '€1.249/maand (jaarlijks)' } },
      ],
    },
  ];

  for (const productDef of products) {
    const existing = await stripe.products.search({
      query: `name:'${productDef.name}'`,
    });

    if (existing.data.length > 0) {
      console.log(`[Stripe Seed] Product "${productDef.name}" already exists (${existing.data[0].id}), skipping.`);
      continue;
    }

    const product = await stripe.products.create({
      name: productDef.name,
      description: productDef.description,
      metadata: productDef.metadata,
    });
    console.log(`[Stripe Seed] Created product: ${product.name} (${product.id})`);

    for (const priceDef of productDef.prices) {
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: priceDef.unit_amount,
        currency: priceDef.currency,
        recurring: { interval: priceDef.interval },
        metadata: priceDef.metadata,
      });
      console.log(`  Created price: ${priceDef.metadata.display} (${price.id})`);
    }
  }

  console.log('[Stripe Seed] Done!');
}

seedProducts().catch((err) => {
  console.error('[Stripe Seed] Error:', err.message);
  process.exit(1);
});
