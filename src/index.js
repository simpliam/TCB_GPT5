import Fastify from "fastify";
import cors from "@fastify/cors";
import fetch from "node-fetch";

const app = Fastify({ logger: true });
const PORT = process.env.PORT || 3000;

await app.register(cors, { origin: "*" });

// --- Health
app.get("/health", async () => ({ ok: true }));

// --- Debug (para verificar envs no container)
app.get("/debug", async () => ({
  model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  hasKey: Boolean(process.env.OPENAI_API_KEY)
}));

// --- Chat (com erros claros)
app.post("/api/chat", async (req, reply) => {
  try {
    const { message } = req.body || {};
    if (!message) return reply.code(400).send({ error: "Mensagem obrigatória" });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return reply.code(500).send({ error: "OPENAI_API_KEY não configurada" });

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          { role: "system", content: "És o agente dos TCB. Responde em PT-PT, direto e objetivo." },
          { role: "user", content: message }
        ]
      })
    });

    const data = await resp.json();
    if (!resp.ok) {
      req.log.error({ status: resp.status, data }, "Erro OpenAI");
      return reply.code(502).send({ error: data?.error?.message || `Falha OpenAI (${resp.status})` });
    }

    return reply.send({ answer: data.choices?.[0]?.message?.content || "Sem resposta.", usedModel: model });
  } catch (e) {
    req.log.error(e);
    return reply.code(500).send({ error: "Erro no servidor" });
  }
});

// --- UI simples na raiz
app.get("/", async (_req, reply) => {
  const html = `<!doctype html><meta charset="utf-8"><title>Agente TCB — Chat</title>
  <style>body{font:16px system-ui;margin:0;background:#0f172a;color:#fff;display:flex;flex-direction:column;align-items:center}
  h1{margin:32px 0} #chat{width:90%;max-width:800px;height:420px;overflow:auto;background:#111;border:1px solid #333;padding:10px}
  .msg{margin:6px 0}.user{color:#4ade80}.bot{color:#60a5fa}
  form{display:flex;gap:8px;width:90%;max-width:800px;margin:10px 0}
  input{flex:1;padding:10px;border-radius:6px;border:1px solid #333}button{padding:10px 16px;border:0;border-radius:6px;background:#22c55e;color:#06210f;font-weight:700}</style>
  <h1>Agente TCB — Chat</h1>
  <div id="chat"></div>
  <form id="f"><input id="m" placeholder="Escreve a tua pergunta..." autofocus><button>Enviar</button></form>
  <script>
  const chat=document.getElementById("chat"),f=document.getElementById("f"),m=document.getElementById("m");
  function add(role,t){const d=document.createElement("div");d.className="msg "+role;d.textContent=role.toUpperCase()+": "+t;chat.appendChild(d);chat.scrollTop=chat.scrollHeight;}
  f.addEventListener("submit",async e=>{e.preventDefault();const msg=m.value.trim();if(!msg)return;add("user",msg);m.value="";
    const r=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:msg})});
    const j=await r.json(); if(!r.ok){add("bot","Erro: "+(j&&j.error||("HTTP "+r.status)));} else {add("bot",j.answer||"Sem resposta.");}
  }); add("bot","Olá! Sou o agente TCB. Faz a tua pergunta 👋");
  </script>`;
  reply.type("text/html").send(html);
});

app.listen({ port: PORT, host: "0.0.0.0" })
  .then(() => app.log.info(`Servidor a correr na porta ${PORT}`))
  .catch(err => { app.log.error(err); process.exit(1); });
