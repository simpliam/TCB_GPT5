import pg from "pg";
const { Client } = pg;

const SQL = `
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS documents(
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(3072),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_embedding
  ON documents USING ivfflat (embedding vector_l2_ops) WITH (lists = 100);
`;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não definida");
  const c = new Client({ connectionString: url });
  await c.connect();
  await c.query(SQL);
  console.log("Migração aplicada com sucesso.");
  await c.end();
}
main().catch(e => { console.error(e); process.exit(1); });
