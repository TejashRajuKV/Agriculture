// Labels for the on-device CLIP model and the facts we attach to each result.
// Each class has a few prompts; their probabilities are summed ("prompt ensembling").
// Prices are typical buyer ranges per tonne - edit them here as rates change.

export const VISION_MODEL = 'Xenova/clip-vit-base-patch32';

// Burning 1 tonne of crop residue releases roughly 1,460 kg of CO2
export const CO2_KG_PER_TONNE_BURNED = 1460;

export const RESIDUE_TYPES = {
  paddy_straw: {
    residueType: 'Paddy Straw',
    prompts: [
      'a photo of paddy straw',
      'a photo of rice straw lying in a harvested field',
      'a photo of rice stubble left in a field after harvest',
      'a photo of rice straw bales'
    ],
    pricePerTonMin: 1500,
    pricePerTonMax: 2500,
    suggestedUses: ['Biomass power / CBG plant', 'Mushroom cultivation', 'Cardboard & packaging'],
    transportFeasibility: 'Medium',
    environmentalImpactScore: 10
  },
  wheat_straw: {
    residueType: 'Wheat Straw',
    prompts: [
      'a photo of wheat straw',
      'a photo of wheat stubble in a harvested field',
      'a photo of golden wheat straw bales',
      'a photo of a heap of chopped wheat straw'
    ],
    pricePerTonMin: 4000,
    pricePerTonMax: 7000,
    suggestedUses: ['Cattle fodder (bhusa)', 'Paper & board', 'Biomass pellets'],
    transportFeasibility: 'High',
    environmentalImpactScore: 8
  },
  sugarcane_trash: {
    residueType: 'Sugarcane Trash / Bagasse',
    prompts: [
      'a photo of sugarcane bagasse',
      'a photo of dry sugarcane leaves and trash',
      'a photo of crushed sugarcane fibre'
    ],
    pricePerTonMin: 1500,
    pricePerTonMax: 3000,
    suggestedUses: ['Boiler fuel', 'Paper pulp', 'Compost'],
    transportFeasibility: 'Medium',
    environmentalImpactScore: 7
  },
  cotton_stalks: {
    residueType: 'Cotton Stalks',
    prompts: [
      'a photo of dry cotton stalks',
      'a photo of cotton plant stalks after harvest',
      'a photo of a pile of cotton sticks'
    ],
    pricePerTonMin: 1200,
    pricePerTonMax: 2200,
    suggestedUses: ['Biomass pellets & briquettes', 'Particle board', 'Industrial fuel'],
    transportFeasibility: 'Medium',
    environmentalImpactScore: 8
  },
  maize_stalks: {
    residueType: 'Maize Stover',
    prompts: [
      'a photo of dry maize stalks',
      'a photo of corn stover in a field',
      'a photo of dry corn stalks and leaves'
    ],
    pricePerTonMin: 1500,
    pricePerTonMax: 2500,
    suggestedUses: ['Silage & fodder', 'Biogas plant', 'Biomass pellets'],
    transportFeasibility: 'High',
    environmentalImpactScore: 7
  },
  mustard_stalks: {
    residueType: 'Mustard Stalks',
    prompts: [
      'a photo of dry mustard stalks',
      'a photo of mustard crop residue after harvest'
    ],
    pricePerTonMin: 1500,
    pricePerTonMax: 2500,
    suggestedUses: ['Briquettes & boiler fuel', 'Biomass power plant', 'Compost'],
    transportFeasibility: 'Medium',
    environmentalImpactScore: 7
  },
  residue_burning: {
    residueType: 'Crop Residue (burning detected)',
    prompts: [
      'a photo of crop residue being burned in a field',
      'a photo of stubble burning with smoke and fire'
    ],
    pricePerTonMin: 1200,
    pricePerTonMax: 2000,
    suggestedUses: ['Stop burning - sell unburnt residue to a biomass plant', 'Use a Happy Seeder / mulcher', 'Compost in the field'],
    transportFeasibility: 'Medium',
    environmentalImpactScore: 10,
    notes: 'Burning detected. Unburnt residue can be sold - stop the fire and bale what is left.'
  }
};

// Anything that clearly isn't crop residue
export const NOT_RESIDUE_PROMPTS = [
  'a photo of a person',
  'a selfie',
  'a photo of food on a plate',
  'a close-up photo of grain seeds',
  'a photo of a green growing crop field',
  'a photo of an animal',
  'a photo of a room indoors',
  'a photo of a building',
  'a photo of a car',
  'a screenshot of text'
];

// Farmer picks moisture on the result screen; wet residue sells for less
export const MOISTURE_LEVELS = [
  { key: 'dry', label: 'Dry', detail: 'below ~15%', priceFactor: 1 },
  { key: 'damp', label: 'Slightly damp', detail: '~15–25%', priceFactor: 0.85 },
  { key: 'wet', label: 'Wet', detail: 'above ~25%', priceFactor: 0.65 }
];

// ---------------------------------------------------------------------------
// Learning Hub: crop / soil / fertilizer
// ---------------------------------------------------------------------------
export const FARM_INPUT_TYPES = {
  crop_healthy: {
    type: 'CROP',
    name: 'Healthy crop',
    healthScore: 85,
    prompts: ['a photo of a healthy green crop plant', 'a photo of healthy green leaves'],
    summary: 'The leaves look green and healthy. Keep up your current care routine.',
    tips: [
      'Keep irrigation regular; avoid waterlogging',
      'Walk the field weekly and check the underside of leaves for pests',
      'Apply the next fertilizer dose as per the crop stage',
      'Remove weeds early, before they compete for nutrients'
    ]
  },
  crop_disease: {
    type: 'CROP',
    name: 'Possible leaf disease (spots / blight)',
    healthScore: 45,
    prompts: ['a photo of plant leaves with brown spots', 'a photo of a diseased crop leaf with blight'],
    summary: 'Spots or blight-like patches are visible on the leaves. This is often a fungal or bacterial disease.',
    tips: [
      'Remove and destroy badly affected leaves; do not leave them in the field',
      'Avoid overhead watering and improve drainage',
      'Show a sample to your nearest Krishi Vigyan Kendra (KVK) before buying any spray',
      'Call the Kisan Call Centre on 1800-180-1551 (free) for spray advice'
    ]
  },
  crop_yellowing: {
    type: 'CROP',
    name: 'Yellowing leaves',
    healthScore: 55,
    prompts: ['a photo of yellowing plant leaves', 'a photo of a crop with pale yellow leaves'],
    summary: 'Pale or yellow leaves usually point to a nitrogen shortage, waterlogging, or poor roots.',
    tips: [
      'Check whether the field is waterlogged and drain excess water',
      'Older leaves yellowing first often means low nitrogen – apply as per soil test',
      'Get a free soil test through the Soil Health Card scheme',
      'Do not over-apply urea; split it into smaller doses'
    ]
  },
  crop_pest: {
    type: 'CROP',
    name: 'Pest damage',
    healthScore: 50,
    prompts: ['a photo of insects on plant leaves', 'a photo of leaves with holes eaten by pests'],
    summary: 'Holes or insects on leaves suggest pest attack.',
    tips: [
      'Count pests on 10 plants to judge how serious it is before spraying',
      'Use yellow sticky traps or pheromone traps for early control',
      'Try neem-based sprays first for light attacks',
      'Ask your KVK which pesticide is approved for this crop'
    ]
  },
  soil_dry: {
    type: 'SOIL',
    name: 'Dry, cracked soil',
    healthScore: 40,
    prompts: ['a photo of dry cracked soil', 'a photo of parched cracked earth'],
    summary: 'The soil is very dry and cracking, so it is losing moisture quickly.',
    tips: [
      'Mulch with crop residue instead of burning it – it holds moisture in the soil',
      'Irrigate in the early morning or evening',
      'Add compost or farmyard manure to improve water holding',
      'Consider drip irrigation for row crops'
    ]
  },
  soil_black: {
    type: 'SOIL',
    name: 'Black (clay-rich) soil',
    healthScore: 75,
    prompts: ['a photo of dark black soil', 'a photo of black cotton soil'],
    summary: 'Dark black soil is usually fertile and holds water well, but it can get sticky and crack when dry.',
    tips: [
      'Good for cotton, soybean, wheat and pulses',
      'Avoid over-watering; ensure drainage in the rainy season',
      'Plough at the right moisture – not too wet, not too dry',
      'Add organic matter to improve structure'
    ]
  },
  soil_red: {
    type: 'SOIL',
    name: 'Red soil',
    healthScore: 60,
    prompts: ['a photo of red soil', 'a photo of red laterite soil'],
    summary: 'Red soil drains well but is often low in nitrogen, phosphorus and organic matter.',
    tips: [
      'Add compost or green manure every season',
      'Get a soil test for pH; red soils are often acidic',
      'Suits groundnut, millets, pulses and horticulture',
      'Mulch to reduce moisture loss'
    ]
  },
  soil_sandy: {
    type: 'SOIL',
    name: 'Sandy soil',
    healthScore: 50,
    prompts: ['a photo of sandy soil', 'a photo of light sandy earth'],
    summary: 'Sandy soil drains very fast and loses water and nutrients quickly.',
    tips: [
      'Irrigate little and often, or use drip irrigation',
      'Add plenty of compost or farmyard manure',
      'Split fertilizer into several small doses',
      'Suits bajra, groundnut, and some vegetables'
    ]
  },
  soil_wet: {
    type: 'SOIL',
    name: 'Wet / waterlogged soil',
    healthScore: 45,
    prompts: ['a photo of wet muddy soil', 'a photo of waterlogged soil'],
    summary: 'The soil looks waterlogged. Roots can suffocate and nutrients get washed away.',
    tips: [
      'Open drainage channels to remove standing water',
      'Avoid running tractors on wet soil – it compacts it',
      'Delay fertilizer until the water drains',
      'Raised beds help in low-lying fields'
    ]
  },
  fert_bag: {
    type: 'FERTILIZER',
    name: 'Fertilizer bag',
    healthScore: 70,
    prompts: ['a photo of a fertilizer bag', 'a photo of a sack of fertilizer'],
    summary: 'A fertilizer product. Use it according to a soil test, not by guesswork.',
    tips: [
      'Check the N-P-K numbers printed on the bag',
      'Buy only from licensed dealers and keep the bill',
      'Match the dose to your Soil Health Card recommendation',
      'Store it dry and away from children and animal feed'
    ]
  },
  fert_granules: {
    type: 'FERTILIZER',
    name: 'Chemical fertilizer granules',
    healthScore: 70,
    prompts: ['a photo of white fertilizer granules', 'a photo of urea pellets in a hand'],
    summary: 'These look like chemical fertilizer granules, such as urea or DAP.',
    tips: [
      'Apply urea in 2–3 split doses rather than all at once',
      'Apply when the soil is moist, not before heavy rain',
      'Wear gloves and wash hands after handling',
      'Neem-coated urea reduces losses'
    ]
  },
  fert_compost: {
    type: 'FERTILIZER',
    name: 'Compost / manure',
    healthScore: 85,
    prompts: ['a photo of compost', 'a photo of cow dung manure'],
    summary: 'Organic manure improves soil structure, water holding and long-term fertility.',
    tips: [
      'Use only well-decomposed compost; fresh manure can burn roots',
      'Mix crop residue into your compost pit instead of burning it',
      'Apply 5–10 tonnes per acre before sowing',
      'Keep the compost pit moist and turn it every few weeks'
    ]
  },
  other: {
    type: 'UNKNOWN',
    name: 'Not recognised',
    healthScore: undefined,
    prompts: ['a photo of a person', 'a photo of a room indoors', 'a screenshot of text', 'a photo of a vehicle', 'a photo of food'],
    summary: 'This does not look like a crop, soil or fertilizer. Try a clear, close-up photo in daylight.',
    tips: [
      'Fill most of the photo with the leaf, soil or product',
      'Take the photo in daylight, without flash',
      'Keep the camera steady and in focus'
    ]
  }
};
