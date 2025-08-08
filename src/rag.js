import fetch from "node-fetch";
import pg from "pg";
const { Client } = pg;

const EMBED_MODEL = process.env.EMBEDDINGS_MODEL || "text-embedding-3-large";
const EMBED_DIM = Number(process.env.EMBEDDINGS_DIM || 3072);

const db = new Client({ connectionString: process.env.DATABASE_URL });
let connected = false;
async function ensureDb() {
  if (!connected) { await db.connect(); connected = true; }
}

export async function embed(text) {
  const r = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: text })
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message || "Erro a gerar embedding");
  return j.data[0].embedding;
}

export async function ingestDoc(source, content) {
  await ensureDb();
  const vec = await embed(content);
  if (vec.length !== EMBED_DIM) throw new Error(`Dimensão errada: ${vec.length} != ${EMBED_DIM}`);
  const res = await db.query(
    "INSERT INTO documents (source, content, embedding) VALUES ($1,$2,$3) RETURNING id",
    [source, content, vec]
  );
  return res.rows[0].id;
}

export async function semanticSearch(query, topK = 5) {
  await ensureDb();
  const qvec = await embed(query);
  if (qvec.length !== EMBED_DIM) throw new Error(`Dimensão errada: ${qvec.length} != ${EMBED_DIM}`);
  const res = await db.query(
    "SELECT source, content FROM documents ORDER BY embedding <=> $1 LIMIT $2",
    [qvec, topK]
  );
  return res.rows;
}
