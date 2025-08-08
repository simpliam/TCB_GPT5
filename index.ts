src/index.ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import dotenv from "dotenv";
import { z } from "zod";
import { chatWithAgent } from "./lib/ai.js";

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const ORIGIN = process.env.CORS_ORIGIN || "*";

const app = Fastify({ logger: true });

// CORS
await app.register(cors, { origin: ORIGIN });

// Health check
app.get("/health", async () => ({ ok: true }));

// Chat endpoint
app.post("/api/chat", async (req, reply) => {
  const schema = z.object({
    message: z.string().min(1)
  });
  const body = schema.parse(req.body);
  const response = await chatWithAgent(body.message);
  return reply.send(response);
});

// Start server
app.listen({ port: PORT, host: "0.0.0.0" }).then(() => {
  app.log.info(`Server running on http://0.0.0.0:${PORT}`);
});
