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

    const speciesCount = await countTotal(connection, 'Species');
    const areaCount = await countTotal(connection, 'GardenArea');
    console.log(`Seed complete. ${speciesCount} species, ${areaCount} areas.`);
  } finally {
    await connection.end();
  }
}

seed().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
