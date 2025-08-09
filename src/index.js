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
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model, temperature: 0.2,
        messages: [
          { role: "system", content: "És o agente dos TCB. Responde em PT-PT, curto e objetivo. Se não houver dados, diz isso sem inventar." },
          { role: "user", content: userText }
        ]
      })
    });

    const data = await resp.json();
    if (!resp.ok) {
      req.log.error({ status: resp.status, data }, "Erro OpenAI");
      return reply.code(502).send({ error: data?.error?.message || `Falha OpenAI (${resp.status})` });
    }

    return reply.send({
      answer: data.choices?.[0]?.message?.content || "Sem resposta.",
      usedModel: model,
      contextUsed: snippets.map(s => ({ source: s.source }))
    });
  } catch (e) {
    req.log.error(e);
    return reply.code(500).send({ error: "Erro no servidor" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen({ port: PORT, host: "0.0.0.0" })
  .then(() => console.log(`Servidor a correr na porta ${PORT}`))
  .catch(err => { console.error(err); process.exit(1); });

