import 'dotenv/config';
import mysql from 'mysql2/promise';
import { readDatabaseConfig } from '../src/db/config.js';

type SpeciesRow = {
  name: string;
  variety: string;
  category: string;
  scientificName: string;
  cycle: string;
  spacingCm: number;
  daysToFlower: number;
  daysToHarvest: number;
};

type AreaRow = {
  name: string;
  kind: string;
  widthCm: number;
  depthCm: number;
  gridX: number;
  gridY: number;
};

const species: SpeciesRow[] = [
  {
    name: 'Tomato',
    variety: 'Sungold',
    category: 'VEGETABLE',
    scientificName: 'Solanum lycopersicum',
    cycle: 'ANNUAL',
    spacingCm: 50,
    daysToFlower: 60,
    daysToHarvest: 75,
  },
  {
    name: 'Tomato',
    variety: 'Marmande',
    category: 'VEGETABLE',
    scientificName: 'Solanum lycopersicum',
    cycle: 'ANNUAL',
    spacingCm: 50,
    daysToFlower: 65,
    daysToHarvest: 80,
  },
  {
    name: 'Carrot',
    variety: 'Nantes',
    category: 'VEGETABLE',
    scientificName: 'Daucus carota',
    cycle: 'BIENNIAL',
    spacingCm: 5,
    daysToFlower: 0,
    daysToHarvest: 70,
  },
  {
    name: 'Lettuce',
    variety: 'Butterhead',
    category: 'VEGETABLE',
    scientificName: 'Lactuca sativa',
    cycle: 'ANNUAL',
    spacingCm: 25,
    daysToFlower: 0,
    daysToHarvest: 55,
  },
  {
    name: 'Courgette',
    variety: 'Defender',
    category: 'VEGETABLE',
    scientificName: 'Cucurbita pepo',
    cycle: 'ANNUAL',
    spacingCm: 90,
    daysToFlower: 45,
    daysToHarvest: 60,
  },
  {
    name: 'Onion',
    variety: 'Sturon',
    category: 'VEGETABLE',
    scientificName: 'Allium cepa',
    cycle: 'BIENNIAL',
    spacingCm: 10,
    daysToFlower: 0,
    daysToHarvest: 105,
  },
  {
    name: 'Basil',
    variety: 'Genovese',
    category: 'HERB',
    scientificName: 'Ocimum basilicum',
    cycle: 'ANNUAL',
    spacingCm: 20,
    daysToFlower: 0,
    daysToHarvest: 40,
  },
  {
    name: 'Marigold',
    variety: 'French Durango',
    category: 'FLOWER',
    scientificName: 'Tagetes patula',
    cycle: 'ANNUAL',
    spacingCm: 25,
    daysToFlower: 50,
    daysToHarvest: 0,
  },
  {
    name: 'Sweet pea',
    variety: 'Spencer Mix',
    category: 'FLOWER',
    scientificName: 'Lathyrus odoratus',
    cycle: 'ANNUAL',
    spacingCm: 20,
    daysToFlower: 65,
    daysToHarvest: 0,
  },
  {
    name: 'Strawberry',
    variety: 'Honeoye',
    category: 'FRUIT',
    scientificName: 'Fragaria x ananassa',
    cycle: 'PERENNIAL',
    spacingCm: 35,
    daysToFlower: 0,
    daysToHarvest: 90,
  },
];

const areas: AreaRow[] = [
  { name: 'Raised bed A', kind: 'RAISED_BED', widthCm: 240, depthCm: 120, gridX: 0, gridY: 0 },
  { name: 'Patio pots', kind: 'POT', widthCm: 180, depthCm: 60, gridX: 0, gridY: 1 },
  { name: 'North border', kind: 'BORDER', widthCm: 300, depthCm: 90, gridX: 1, gridY: 0 },
];

/**
 * The starter library: ten guides across the five shelves, each written from
 * a named source that is linked for the full article. The bodies are original
 * summaries, so nothing here is copied from the source itself.
 */
type GuideRow = {
  title: string;
  slug: string;
  category: string;
  summary: string;
  body: string;
  sourceName: string;
  sourceUrl: string;
  tags: string[];
};

const guides: GuideRow[] = [
  {
    title: 'How to grow tomatoes',
    slug: 'how-to-grow-tomatoes',
    category: 'VEGETABLE_GROWING',
    summary: 'Sowing, planting out and training the two types of tomato, with the watering and feeding that makes the crop.',
    body: `Tomatoes are started from seed indoors from late February to mid March for a greenhouse crop, or from late March to early April for plants that will live outside. Seed needs about 18 degrees to germinate, so a warm windowsill or a propagator does the job, and once seedlings appear they want as much light as possible so they stay stocky rather than leggy.

When each seedling has a couple of true leaves, move it into its own pot, holding it by a leaf rather than the stem. Plant out into the garden once the risk of frost has passed and days are reliably above 16 degrees, burying the stem up to the first pair of leaves so the buried part roots itself.

Cordon tomatoes are grown as one tall stem: tie them in, pinch out the side shoots every time you water, and stop the plant at seven trusses indoors or four outdoors. Bush tomatoes are left to their own devices and only need support when the crop makes them droop.

Water evenly for the whole season. Fluctuating moisture is what causes splitting and blossom end rot. Feed container plants every 10 to 14 days with a high potassium feed once the first fruits swell, and pick as soon as the fruit is fully coloured.`,
    sourceName: 'Royal Horticultural Society',
    sourceUrl: 'https://www.rhs.org.uk/vegetables/tomatoes/grow-your-own',
    tags: ['tomatoes', 'sowing', 'greenhouse', 'vegetables'],
  },
  {
    title: 'Five easy vegetables for a beginner',
    slug: 'five-easy-vegetables-for-beginners',
    category: 'VEGETABLE_GROWING',
    summary: 'The crops that forgive mistakes and still produce something worth eating in a first season.',
    body: `A first vegetable bed works best with crops that are quick, forgiving and hard to get wrong.

Lettuce and other cut-and-come-again leaves can be sown in shallow drills every few weeks from spring to autumn, and harvested by cutting the outer leaves so the plant keeps producing. Radishes are ready in about four weeks from a thin sowing, which makes them the fastest answer to a child asking when dinner will be ready.

Runner beans want a warm, sheltered spot and something to climb. Sow them in late spring and pick the pods while they are still young and flat, because the plant stops producing once the seeds swell.

Courgettes are greedy but undemanding: one plant in a bucket of compost or a corner of a bed, watered well, will produce more than one household can eat.

Potatoes can be grown in a bag or a deep bucket of compost. Cover the shoots with compost as they grow, and harvest the first new potatoes when the plants flower.`,
    sourceName: "BBC Gardeners' World Magazine",
    sourceUrl: 'https://www.gardenersworld.com/how-to/grow-plants/five-favourites-vegetables-for-a-beginner-gardener/',
    tags: ['vegetables', 'beginners', 'sowing'],
  },
  {
    title: 'How to grow sweet peas',
    slug: 'how-to-grow-sweet-peas',
    category: 'FLOWER_CARE',
    summary: 'Sowing, pinching and supporting the climbers, and picking them often enough to keep the flowers coming.',
    body: `Sweet peas are sown in autumn for an early display or in late winter for a longer season. Sow into deep pots or root trainers because they make a long root run, and keep them somewhere cool but frost free until spring.

Once the seedlings have three or four pairs of leaves, pinch out the growing tip. The plant responds by sending out more stems, which means more flowers rather than one long vine.

Plant them out in spring against a frame, netting or tall canes, and tie the stems in as they climb. They need a sunny spot, a moisture retentive soil, and a good mulch after planting to hold water in.

Pick the flowers every week. A sweet pea that is left to form seeds stops flowering, so a regular bunch for the kitchen table is what keeps the plant working until the first frosts. Water in dry spells and remove any pods you spot, and the display runs all summer.`,
    sourceName: "BBC Gardeners' World Magazine",
    sourceUrl: 'https://www.gardenersworld.com/how-to/grow-plants/how-to-grow-sweet-peas/',
    tags: ['sweet peas', 'flowers', 'cutting'],
  },
  {
    title: 'How to grow cosmos',
    slug: 'how-to-grow-cosmos',
    category: 'FLOWER_CARE',
    summary: 'A long flowering annual that wants sun, poor soil and frequent picking more than it wants feeding.',
    body: `Cosmos are one of the easiest flowers to grow from seed. Sow under cover in spring once the frost has passed, or directly into the ground in late spring, and cover the seed lightly because they like a bit of light to germinate.

Once the seedlings have their first set of true leaves, pinch out the tip to make a bushy plant rather than a single stem. Plant out into the sunniest spot you have. Rich soil makes cosmos tall and leafy at the expense of flowers, so leave the soil as it is rather than improving it.

Water them in while they establish, then they cope with dry periods. A support of some kind helps the taller varieties stay upright in wind.

Deadhead spent blooms down to the next leaf node to keep the plant flowering until the first frosts. If you want seed for next year, leave a few heads to mature on the plant and collect them once they have turned brown and dry.`,
    sourceName: "BBC Gardeners' World Magazine",
    sourceUrl: 'https://www.gardenersworld.com/how-to/grow-plants/how-to-grow-cosmos/',
    tags: ['cosmos', 'flowers', 'deadheading'],
  },
  {
    title: 'Tomato blight: recognise and limit it',
    slug: 'tomato-blight',
    category: 'PESTS_AND_DISEASE',
    summary: 'The warm wet weather disease that blackens tomato foliage and rots the fruit, and what to do when it arrives.',
    body: `Blight is caused by a fungus like the one behind potato blight, and it moves on the wind in warm, wet weather. On tomatoes it starts as brown patches on the leaves, often with a pale ring around them, then spreads down the stems and turns the fruit firm and brown.

Act early. Cut off affected leaves and stems and take them off the site rather than composting them, because the fungus overwinters on dead material. Water at the roots rather than over the foliage, and keep the plants moving air around them by removing lower leaves.

If the season is advanced, pick any fruit that has a chance of ripening and let it finish in a warm, dark place. Green tomatoes can be ripened in a drawer with a banana.

Blight is far less of a problem under cover, so greenhouse tomatoes are the easier route. Where plants must go outside, choosing a resistant variety and rotating the bed so tomatoes and potatoes never follow each other are the two habits that make the difference.`,
    sourceName: 'Royal Horticultural Society',
    sourceUrl: 'https://www.rhs.org.uk/disease/tomato-blight',
    tags: ['blight', 'tomatoes', 'disease'],
  },
  {
    title: 'Slugs on seedlings',
    slug: 'slugs-on-seedlings',
    category: 'PESTS_AND_DISEASE',
    summary: 'Why young plants vanish overnight and the barriers, traps and timing that stop it happening again.',
    body: `Slugs work at night and leave a trail of silver slime and seedlings cut off at soil level. The plants most at risk are those with soft, tender growth, which is exactly what a newly sown tray offers.

Water in the morning rather than the evening so the soil is not damp when the slugs come out, and clear away anything they can hide under: boards, dense leaves and leftover pots all become daytime hotels.

A barrier of sharp grit, crushed shell or copper tape around a tray or a bed stops most of them crossing it. Beer traps sunk to soil level take a surprising number, and a patrol with a torch after dark is the most reliable method of all.

Where damage keeps happening, ferric phosphate pellets are the least harmful option and can be scattered where children and pets reach. The plants that matter most are worth transplanting a little later and a little larger, because a bigger seedling survives a night of grazing that a small one does not.`,
    sourceName: "BBC Gardeners' World Magazine",
    sourceUrl: 'https://www.gardenersworld.com/news/are-slugs-eating-your-seedlings/',
    tags: ['slugs', 'seedlings', 'pests'],
  },
  {
    title: 'How to start composting at home',
    slug: 'how-to-start-composting',
    category: 'SOIL_AND_COMPOST',
    summary: 'Greens and browns, air and moisture: the four things a heap needs to turn kitchen scraps into soil.',
    body: `Composting is rotting with a plan. The ingredients fall into two groups: green material such as grass clippings, vegetable peelings and fresh leaves, which give nitrogen, and brown material such as cardboard, straw, wood chip and dry leaves, which give carbon and structure.

Aim for roughly equal volumes of each. Alternate layers as you add them so the heap never becomes a soggy mass of one thing, and break big pieces down first so they rot faster.

Air and moisture are what people get wrong. The heap needs oxygen for the organisms doing the work, so turn it every few weeks or push a length of pipe through it to let air in, and keep it as damp as a wrung out sponge. Wet and airless turns sour and smells; dry and it simply stops.

Leave meat, dairy and cooked food out of it, along anything that will grow on: perennial weeds and diseased plants belong on the bin rather than in it. The compost is ready when it is dark, crumbly and smells of woodland floor, which takes anywhere from three months to a year.`,
    sourceName: "BBC Gardeners' World Magazine",
    sourceUrl: 'https://www.gardenersworld.com/how-to/maintain-the-garden/how-to-compost/',
    tags: ['compost', 'soil', 'recycling'],
  },
  {
    title: 'Five reasons to feed your soil',
    slug: 'five-reasons-to-feed-your-soil',
    category: 'SOIL_AND_COMPOST',
    summary: 'Why organic matter matters more than any packet of fertiliser: structure, water, life, nutrients and protection.',
    body: `Plants do not eat soil, the soil life does. Feeding the soil with organic matter means feeding the bacteria, fungi, worms and beetles that in turn make nutrients available to roots, so the food chain starts under your boots rather than in a bottle.

Organic matter improves structure. In heavy ground it opens the clay so roots can push through and water drains away; in sandy ground it acts like a sponge that holds moisture and nutrients instead of letting them wash past the roots.

It also stores water. A soil with a good organic content gets through a dry week that would have a poor one wilting by Wednesday, and it feeds plants slowly rather than in a surge that produces soft, floppy growth.

Finally it protects the surface. A mulch of compost or well rotted manure keeps rain off bare soil so it cannot compact, keeps the sun off so it cannot dry out, and keeps weed seeds in the dark where they cannot germinate.

Feed it once a year at least: a layer of compost in autumn or spring, mulches that break down slowly, and green manures over the winter months.`,
    sourceName: "BBC Gardeners' World Magazine",
    sourceUrl: 'https://www.gardenersworld.com/how-to/grow-plants/five-reasons-to-feed-your-soil/',
    tags: ['soil', 'organic matter', 'mulch'],
  },
  {
    title: 'Seed saving: the basics',
    slug: 'seed-saving-basics',
    category: 'SEED_SAVING',
    summary: 'Open pollinated or hybrid, when seed is actually mature, how to clean it and how to store it.',
    body: `Start with the right plant. Only open pollinated varieties come true from seed; the offspring of a hybrid will be a mix of its parents, so a saved seed of a hybrid F1 buys you something new rather than something familiar.

Then know when the seed is ready, which is not the same as when the fruit is ready to eat. Carrots and onions are biennials that must stand through a second season before they flower and set seed, while a tomato seed is ready the moment the tomato is.

Crops divide into dry seeded and wet seeded. Beans, peas and lettuce are simply picked when the pods or heads are brown and dry, then rubbed free of the chaff. Tomatoes and squash need the seed lifted out of the fruit: tomato seed wants a few days of fermentation in its own juice to clear the gel coat, then a rinse, and the good seed sinks while the pulp floats off.

Dry the seed completely before it goes anywhere near a jar, because any remaining moisture turns to mould in storage. Keep it cool, dark and airtight, and label every packet with the variety and the date. Tomatoes and beans keep for years this way; onion and carrot seed is tired within a season or two.`,
    sourceName: 'Seed Savers Exchange',
    sourceUrl: 'https://seedsavers.org/learn/seed-saving/',
    tags: ['seed saving', 'storage', 'open pollinated'],
  },
  {
    title: 'Growing and saving flower seeds',
    slug: 'growing-and-saving-flower-seeds',
    category: 'SEED_SAVING',
    summary: 'Leave the best blooms to go to seed, gather them on a dry day, and clean and store them for next spring.',
    body: `Seed saving from flowers starts in the summer while you are still picking. As the season goes on, leave the healthiest, most typical blooms of each variety untouched so they can mature into seed heads, and keep cutting everything else.

Harvest on a dry day once the heads or pods have turned brown and the stem below them is dry. Collect into a paper or cloth bag rather than plastic, which traps moisture, and bring them somewhere sheltered to finish.

Cleaning is three steps. Thresh by rubbing or shaking the heads to knock the seed loose. Screen it through a sieve to drop the seed away from the stalks and chaff. Then winnow it, letting a gentle airflow carry off the lightest debris while the heavier seed falls.

Dry the cleaned seed in a thin layer for a few weeks, turning it now and then so air reaches every grain. When it is brittle rather than bendy it is ready to store in an airtight container with the variety and the harvest date written on it.

Keep varieties of the same species apart if you want them to stay true, since bees carry pollen further than most people expect.`,
    sourceName: 'Seed Savers Exchange',
    sourceUrl: 'https://seedsavers.org/learn/growing-guides/growing-and-saving-flower-seeds/',
    tags: ['flowers', 'seed saving', 'harvesting'],
  },
];

// The no-op update makes the statement idempotent, so running the seed twice
// does not duplicate anything. updatedAt has no database default because
// Prisma normally sets it from the client, so raw inserts must supply it.
const insertSpecies = `
  INSERT INTO Species (name, variety, category, scientificName, cycle, spacingCm, daysToFlower, daysToHarvest, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(3))
  ON DUPLICATE KEY UPDATE id = id
`;

const insertArea = `
  INSERT INTO GardenArea (name, kind, widthCm, depthCm, gridX, gridY, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(3))
  ON DUPLICATE KEY UPDATE id = id
`;

// The slug is the stable key here, so a repeat run finds the same row.
const insertGuide = `
  INSERT INTO Guide (title, slug, category, summary, body, sourceName, sourceUrl, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP(3))
  ON DUPLICATE KEY UPDATE id = id
`;

// LAST_INSERT_ID(id) makes the driver hand back the id of a tag that already
// existed, so a repeat run links rather than duplicates.
const insertTag = 'INSERT INTO Tag (name) VALUES (?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)';

const linkTag = 'INSERT IGNORE INTO _GuideToTag (A, B) VALUES (?, ?)';

async function countTotal(connection: mysql.Connection, table: string): Promise<number> {
  const [rows] = await connection.execute(`SELECT COUNT(*) AS total FROM ${table}`);
  const first = (rows as Array<{ total: unknown }>)[0];
  return Number(first?.total ?? 0);
}

async function seed(): Promise<void> {
  const connection = await mysql.createConnection(readDatabaseConfig());

  try {
    for (const entry of species) {
      await connection.execute(insertSpecies, [
        entry.name,
        entry.variety,
        entry.category,
        entry.scientificName,
        entry.cycle,
        entry.spacingCm,
        entry.daysToFlower,
        entry.daysToHarvest,
      ]);
    }

    for (const entry of areas) {
      await connection.execute(insertArea, [
        entry.name,
        entry.kind,
        entry.widthCm,
        entry.depthCm,
        entry.gridX,
        entry.gridY,
      ]);
    }

    for (const guide of guides) {
      await connection.execute(insertGuide, [
        guide.title,
        guide.slug,
        guide.category,
        guide.summary,
        guide.body,
        guide.sourceName,
        guide.sourceUrl,
      ]);

      const [guideRows] = await connection.execute('SELECT id FROM Guide WHERE slug = ?', [guide.slug]);
      const guideId = Number((guideRows as Array<{ id: unknown }>)[0]?.id);

      for (const tag of guide.tags) {
        const [tagRows] = await connection.execute(insertTag, [tag]);
        const tagId = Number((tagRows as { insertId: unknown }).insertId);
        await connection.execute(linkTag, [guideId, tagId]);
      }
    }

    const speciesCount = await countTotal(connection, 'Species');
    const areaCount = await countTotal(connection, 'GardenArea');
    const guideCount = await countTotal(connection, 'Guide');
    const tagCount = await countTotal(connection, 'Tag');
    console.log(
      `Seed complete. ${speciesCount} species, ${areaCount} areas, ${guideCount} guides, ${tagCount} tags.`,
    );
  } finally {
    await connection.end();
  }
}

seed().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
