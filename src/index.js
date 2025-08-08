import Fastify from "fastify";
import cors from "@fastify/cors";
import fetch from "node-fetch";

const app = Fastify();
const PORT = process.env.PORT || 3000;

await app.register(cors, {
  origin: "*",
});

// Health check
app.get("/health", async () => ({ ok: true }));

// Endpoint de chat
app.post("/api/chat", async (req, reply) => {
  try {
    const { message } = req.body;
    if (!message) {
      return reply.code(400).send({ error: "Mensagem obrigatória" });
    }

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          { role: "system", content: "És o agente inteligente dos Transportes Colectivos do Barreiro (TCB)." },
          { role: "user", content: message }
        ]
      })
    });

    const data = await resp.json();
    if (data.error) {
      return reply.code(500).send({ error: data.error.message });
    }

    reply.send({
      answer: data.choices?.[0]?.message?.content || "Sem resposta.",
      usedModel: process.env.OPENAI_MODEL || "gpt-4o-mini"
    });
  } catch (err) {
    console.error(err);
    reply.code(500).send({ error: "Erro no servidor" });
  }
});

// Página inicial com chat UI
app.get("/", async (req, reply) => {
  const html = `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>TCB Agent — Chat</title>
<style>
/* CSS simplificado */
body { font-family: sans-serif; background: #0f172a; color: #fff; display: flex; flex-direction: column; align-items: center; padding: 20px; }
#chat { width: 100%; max-width: 600px; height: 400px; overflow-y: auto; border: 1px solid #333; padding: 10px; margin-bottom: 10px; background: #111; }
.msg { margin: 5px 0; }
.user { color: #4ade80; }
.bot { color: #60a5fa; }
input, button { padding: 10px; border: none; border-radius: 5px; }
input { flex: 1; margin-right: 5px; }
form { display: flex; width: 100%; max-width: 600px; }
</style>
</head>
<body>
<h1>Agente TCB — Chat</h1>
<div id="chat"></div>
<form id="form">
  <input id="msg" type="text" placeholder="Escreve a tua pergunta..." autocomplete="off" />
  <button type="submit">Enviar</button>
</form>
<script>
const chatEl = document.getElementById("chat");
const form = document.getElementById("form");
const msgInput = document.getElementById("msg");

function addMsg(role, text) {
  const div = document.createElement("div");
  div.className = "msg " + role;
  div.textContent = role.toUpperCase() + ": " + text;
  chatEl.appendChild(div);
  chatEl.scrollTop = chatEl.scrollHeight;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const message = msgInput.value.trim();
  if (!message) return;
  addMsg("user", message);
  msgInput.value = "";
  const resp = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message })
  });
  const data = await resp.json();
  addMsg("bot", data.answer || "Erro na resposta");
});
</script>
</body>
</html>`;
  reply.type("text/html").send(html);
});

// Inicia o servidor
app.listen({ port: PORT, host: "0.0.0.0" })
  .then(() => console.log(`Servidor a correr na porta ${PORT}`))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
