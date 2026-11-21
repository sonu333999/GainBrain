import 'dotenv/config';
import { ensureSeedData } from '../server/seed.ts';

async function main() {
  console.log('Running database seed...');
  await ensureSeedData();
  console.log('Database seed complete.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Failed to seed database:', err);
  process.exit(1);
});
