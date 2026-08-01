require('dotenv').config();

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Add it to backend/.env (Supabase > Settings > Database > Session pooler URI).');
  process.exit(1);
}

console.log('Schema migrations are managed in the Supabase SQL Editor for the Postgres database.');
console.log('Open the project, go to SQL Editor, and run backend/src/database/schema.postgres.sql.');
