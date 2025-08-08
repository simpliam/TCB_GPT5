import Fastify from "fastify";
import cors from "@fastify/cors";
import fetch from "node-fetch";
import { ingestDoc, semanticSearch } from "./rag.js";

const app = Fastify({ logger: true });

// CORS
app.register(cors, {
  origin: process.env.CORS_ORIGIN || "*"
});

// Rota simples para teste
app.get("/", async () => {
  return { status: "ok", service: "TCB Agent" };
});

// Rota para ingestão de documentos no RAG (apenas com API key admin)
app.post("/api/ingest", async (req, reply) => {
  const auth = (req.headers.authorization || "").replace("Bearer ", "");
  if (!process.env.ADMIN_API_KEY || auth !== process.env.ADMIN_API_KEY) {
    return reply.code(401).send({ error: "Unauthorized" });
  }
  const { source, content } = req.body || {};
  if (!source || !content) return reply.code(400).send({ error: "source e content obrigatórios" });
  try {
    const id = await ingestDoc(source, content);
    return reply.send({ ok: true, id });
  } catch (e) {
    req.log.error(e);
    return reply.code(500).send({ error: String(e.message || e) });
  }
});

// Rota principal de chat com RAG
app.post("/api/chat", async (req, reply) => {
  try {
    const { message, topK } = req.body || {};
    if (!message) return reply.code(400).send({ error: "Mensagem obrigatória" });
    if (!process.env.OPENAI_API_KEY) return reply.code(500).send({ error: "OPENAI_API_KEY não configurada" });

    // Pesquisa semântica
    let snippets = [];
    const k = Number(topK || 0);
    if (k > 0 && process.env.DATABASE_URL) {
      try { snippets = await semanticSearch(message, Math.min(k, 10)); } catch (e) { req.log.warn(e); }
    }
    const contextBlock = snippets.length
      ? "Contexto (trechos relevantes):\n" + snippets.map((s,i)=>`[${i+1}] ${s.source}: ${s.content.slice(0,500)}`).join("\n\n")
      : "";

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const userText = contextBlock ? `${contextBlock}\n\nPergunta: ${message}` : message;

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST

