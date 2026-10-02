'use strict';

// Original demo fragrances used to populate a fresh store. Replace them from the admin
// dashboard with the real catalogue. `color` drives the generated bottle illustration.
const sizes = (p30, p50, p100, [s30, s50, s100] = [12, 18, 9]) => [
  { label: '30 ml', price: p30, stock: s30 },
  { label: '50 ml', price: p50, stock: s50 },
  { label: '100 ml', price: p100, stock: s100 },
];

module.exports = [
  {
    name: 'Oud Nocturne', style: 'Woody', gender: 'Unisex', featured: true, color: ['#3b1f12', '#8a5a2b'],
    tagline: 'Smoked oud wrapped in saffron and warm amber.',
    description: 'A deep, after-dark composition. Saffron opens with a spiced glow before a heart of smoky agarwood and rose settles onto a base of amber and leather. Long-lasting and quietly magnetic.',
    notes: { top: 'Saffron, Pink Pepper', heart: 'Agarwood, Damask Rose', base: 'Amber, Leather, Patchouli' },
    variants: sizes(68, 118, 185),
  },
  {
    name: 'Golden Ember', style: 'Amber', gender: 'Unisex', featured: true, color: ['#7a3e06', '#e0a43a'],
    tagline: 'Glowing vanilla, tonka and toasted spice.',
    description: 'Warm as candlelight. Cinnamon and cardamom spark over a heart of honeyed tobacco leaf, melting into Madagascar vanilla and tonka bean.',
    notes: { top: 'Cinnamon, Cardamom', heart: 'Tobacco Leaf, Honey', base: 'Vanilla, Tonka Bean, Benzoin' },
    variants: sizes(62, 108, 168),
  },
  {
    name: 'Jade Garden', style: 'Fresh', gender: 'Unisex', featured: true, color: ['#1f4a3a', '#6fbf96'],
    tagline: 'Green tea leaves after spring rain.',
    description: 'Clean and serene. Crisp green tea and yuzu lead to a heart of bamboo and jasmine tea, resting on soft white musk and vetiver.',
    notes: { top: 'Yuzu, Green Tea', heart: 'Bamboo, Jasmine Tea', base: 'White Musk, Vetiver' },
    variants: sizes(54, 92, 140),
  },
  {
    name: 'Silk Peony', style: 'Floral', gender: 'For Her', featured: true, color: ['#7d2e4a', '#f1a7bd'],
    tagline: 'Peony petals, lychee and sheer rose.',
    description: 'Luminous and romantic. Juicy lychee meets a bouquet of peony and rose, finished with cashmere woods for a soft, skin-close trail.',
    notes: { top: 'Lychee, Bergamot', heart: 'Peony, Rose, Freesia', base: 'Cashmere Wood, Musk' },
    variants: sizes(58, 98, 150),
  },
  {
    name: 'Midnight Cedar', style: 'Woody', gender: 'For Him', color: ['#1d2526', '#5d6d6b'],
    tagline: 'Black pepper, cedar and smoky vetiver.',
    description: 'Sharp tailoring in scent form. Black pepper and grapefruit cut through a structured heart of Atlas cedar and violet leaf, grounded by vetiver and incense.',
    notes: { top: 'Black Pepper, Grapefruit', heart: 'Atlas Cedar, Violet Leaf', base: 'Vetiver, Incense' },
    variants: sizes(60, 102, 158),
  },
  {
    name: 'Imperial Rose', style: 'Floral', gender: 'Unisex', color: ['#5a0f1f', '#c2405a'],
    tagline: 'Turkish rose crowned with oud and patchouli.',
    description: 'Opulent and confident. A rich Turkish rose is darkened by oud and patchouli, lifted with raspberry and softened by labdanum.',
    notes: { top: 'Raspberry, Clove', heart: 'Turkish Rose, Oud', base: 'Patchouli, Labdanum' },
    variants: sizes(72, 124, 195),
  },
  {
    name: 'Citrus Lumière', style: 'Fresh', gender: 'Unisex', color: ['#8a6a07', '#f4d35e'],
    tagline: 'Sun-bright bergamot, neroli and mandarin.',
    description: 'A burst of Mediterranean light. Sparkling bergamot and mandarin over neroli and orange blossom, drying down to a clean ambrette musk.',
    notes: { top: 'Bergamot, Mandarin', heart: 'Neroli, Orange Blossom', base: 'Ambrette, Musk' },
    variants: sizes(48, 84, 128),
  },
  {
    name: 'Velvet Iris', style: 'Powdery', gender: 'For Her', color: ['#3f3466', '#a99bd6'],
    tagline: 'Orris butter, suede and violet.',
    description: 'Refined and tactile. Powdery orris and violet are wrapped in soft suede and a whisper of carrot seed, finishing on creamy musk.',
    notes: { top: 'Violet, Carrot Seed', heart: 'Orris Butter, Heliotrope', base: 'Suede, Musk' },
    variants: sizes(66, 112, 176),
  },
  {
    name: 'Sandalwood Mist', style: 'Woody', gender: 'Unisex', color: ['#5a4126', '#cfae82'],
    tagline: 'Creamy sandalwood with cardamom and fig.',
    description: 'Comforting and meditative. Green fig and cardamom drift over creamy Mysore-style sandalwood and a smooth cedar base.',
    notes: { top: 'Cardamom, Fig Leaf', heart: 'Sandalwood, Papyrus', base: 'Cedarwood, Ambroxan' },
    variants: sizes(64, 110, 172),
  },
  {
    name: 'Black Pearl', style: 'Amber', gender: 'For Him', color: ['#0f0f12', '#4b4b55'],
    tagline: 'Dark rum, labdanum and black vanilla.',
    description: 'Nocturnal and smooth. A splash of dark rum and plum gives way to labdanum and black vanilla for a velvety, lingering finish.',
    notes: { top: 'Dark Rum, Plum', heart: 'Labdanum, Davana', base: 'Black Vanilla, Oakmoss' },
    variants: sizes(70, 120, 188),
  },
  {
    name: 'White Orchid', style: 'Floral', gender: 'For Her', color: ['#6d6a72', '#efe9f2'],
    tagline: 'Night-blooming orchid and coconut milk.',
    description: 'Soft, creamy and luminous. Orchid and tuberose bloom over a gentle accord of coconut milk and sandalwood.',
    notes: { top: 'Pear, Pink Pepper', heart: 'Orchid, Tuberose', base: 'Coconut Milk, Sandalwood' },
    variants: sizes(56, 96, 148),
  },
  {
    name: 'Amber Lantern', style: 'Amber', gender: 'Unisex', color: ['#6b2c08', '#d47a2b'],
    tagline: 'Resinous amber and smoked incense. (Restocking soon)',
    description: 'A limited batch of our most requested amber. Myrrh and elemi over glowing amber resin and a thread of incense smoke. Currently sold out — check back soon.',
    notes: { top: 'Elemi, Orange Peel', heart: 'Myrrh, Incense', base: 'Amber Resin, Vanilla' },
    variants: sizes(66, 114, 178, [0, 0, 0]),
    inStock: false,
  },
];
