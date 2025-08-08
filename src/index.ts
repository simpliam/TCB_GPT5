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

// Página inicial com chat UI (sem template literals aninhados)
app.get("/", async (_req, reply) => {
  const html = `<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>TCB Agent — Chat</title>
<style>
:root{
  --bg:#0f172a; --panel:#111827cc; --accent:#22c55e; --accent-2:#16a34a;
  --text:#e5e7eb; --muted:#9ca3af; --bot:#1f2937; --user:#0b5cff;
}
*{box-sizing:border-box} html,body{height:100%}
body{ margin:0; background: radial-gradient(1000px 600px at 10% -10%, #1e293b 0%, #0b1220 50%, #06090f 100%);
  color:var(--text); font:16px/1.4 system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,"Helvetica Neue",Arial;
  display:flex; flex-direction:column; align-items:center; }
.wrap{width:100%;max-width:900px;height:100%;display:flex;flex-direction:column;padding:16px;gap:12px}
header{ display:flex;align-items:center;justify-content:space-between; background:linear-gradient(180deg,#151a26,#0e1420);
  border:1px solid #1f2937;border-radius:16px; padding:12px 16px; box-shadow:0 10px 30px #00000055,inset 0 1px 0 #ffffff10; }
.brand{display:flex;align-items:center;gap:12px;}
.logo{width:36px;height:36px;border-radius:10px; background:conic-gradient(from 140deg at 50% 50%,#22c55e,#0ea5e9,#8b5cf6,#22c55e); box-shadow:0 6px 18px #22c55e44;}
.title{font-weight:700;letter-spacing:.3px;}
.badge{font-size:12px;color:var(--muted); background:#0b1220;border:1px solid #1f2937; padding:4px 8px;border-radius:999px;}
.controls{display:flex;align-items:center;gap:8px}
.endpoint{ width:340px;max-width:52vw; background:#0b1220;color:var(--text); border:1px solid #1f2937;border-radius:10px; padding:8px 10px;font-size:12px;}
.chat{ flex:1;min-height:0;background:var(--panel); border:1px solid #1f2937;border-radius:16px; padding:14px;overflow:auto;scroll-behavior:smooth;}
.msg{display:flex;gap:10px;margin:10px 0;align-items:flex-end;}
.msg .bubble{ max-width:75%;padding:10px 12px;border-radius:12px; border:1px solid #1f2937; white-space:pre-wrap;word-wrap:break-word;}
.msg.user{justify-content:flex-end;}
.msg.user .bubble{ background:linear-gradient(180deg,#0b5cff,#0a49cc); color:#eaf2ff;border-color:#0a3ea8; box-shadow:0 6px 20px #0b5cff44; }
.msg.bot .avatar{ width:28px;height:28px;border-radius:8px;flex:0 0 28px; background:linear-gradient(135deg,#22c55e,#16a34a); box-shadow:0 6px 14px #22c55e55;}
.msg.bot .bubble{ background:var(--bot); }
.time{font-size:11px;color:var(--muted);margin-top:4px}
.composer{ display:flex;gap:10px;align-items:center; background:linear-gradient(180deg,#151a26,#0e1420);
  border:1px solid #1f2937;border-radius:16px; padding:10px; box-shadow:0 10px 30px #00000055,inset 0 1px 0 #ffffff10;}
textarea{ flex:1;resize:none;height:52px; background:#0b1220;color:var(--text); border:1px solid #1f2937;border-radius:12px; padding:10px 12px;outline:none;}
button{ background:linear-gradient(180deg,var(--accent),var(--accent-2)); color:#06210f;font-weight:700; border:none;border-radius:12px;padding:12px 16px;
  cursor:pointer;transition:.15s transform ease,.15s opacity ease; box-shadow:0 10px 22px #22c55e55;}
button:disabled{opacity:.6;cursor:not-allowed;box-shadow:none;} button:active{transform:translateY(1px);}
.spin{ width:14px;height:14px;border-radius:50%; border:2px solid #b3f1c8;border-top-color:transparent; display:inline-block;animation:rot .8s linear infinite;margin-right:8px;}
@keyframes rot{to{transform:rotate(360deg)}} .tips{font-size:12px;color:var(--muted);text-align:center;margin-top:4px}
@media (max-width:640px){ .endpoint{width:52vw} .msg .bubble{max-width:90%} textarea{height:56px} }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="brand">
      <div class="logo" aria-hidden="true"></div>
      <div>
        <div class="title">TCB Agent</div>
        <div class="badge">GPT-5 • Demo UI</div>
      </div>
    </div>
    <div class="controls">
      <input id="endpoint" class="endpoint" type="text"
             value="https://tcbgpt5-production.up.railway.app/api/chat"
             title="Endpoint da API"/>
      <button id="saveEp">Guardar</button>
    </div>
  </header>

  <main id="chat" class="chat" aria-live="polite"></main>

  <div class="composer">
    <textarea id="input" placeholder="Escreve a tua pergunta… (Enter para enviar, Shift+Enter para nova linha)"></textarea>
    <button id="send"><span id="sendIcon">Enviar</span></button>
  </div>
  <div class="tips">Dica: pergunta “Horários da Linha 1” ou “Tarifário pré-comprado”</div>
</div>

<script>
const chatEl = document.getElementById("chat");
const inputEl = document.getElementById("input");
const sendBtn = document.getElementById("send");
const sendIcon = document.getElementById("sendIcon");
const endpointEl = document.getElementById("endpoint");
const saveEpBtn = document.getElementById("saveEp");

const saved = localStorage.getItem("tcb_endpoint");
if (saved) endpointEl.value = saved;
saveEpBtn.onclick = () => {
  localStorage.setItem("tcb_endpoint", endpointEl.value.trim());
  toast("Endpoint atualizado.");
};

function toast(msg){
  sendBtn.disabled = true;
  const old = sendIcon.textContent;
  sendIcon.textContent = msg;
  setTimeout(()=>{ sendIcon.textContent = old; sendBtn.disabled = false; }, 1200);
}

function timeNow(){
  const d = new Date();
  return d.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
}

function addMsg(role, text){
  const row = document.createElement("div");
  row.className = "msg " + role;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;
  const time = document.createElement("div");
  time.className = "time";
  time.textContent = timeNow();

  if (role === "bot"){
    const avatar = document.createElement("div");
    avatar.className = "avatar";
    row.appendChild(avatar);
    const col = document.createElement("div");
    col.appendChild(bubble);
    col.appendChild(time);
    row.appendChild(col);
  } else {
    const col = document.createElement("div");
    col.appendChild(bubble);
    col.appendChild(time);
    row.appendChild(col);
  }

  chatEl.appendChild(row);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function setLoading(on){
  if (on){
    sendBtn.disabled = true;
    sendIcon.innerHTML = '<span class="spin"></span>A responder…';
  } else {
    sendBtn.disabled = false;
    sendIcon.textContent = 'Enviar';
  }
}

async function send(){
  const message = inputEl.value.trim();
  if (!message) return;
  addMsg("user", message);
  inputEl.value = "";
  setLoading(true);
  try{
    const resp = await fetch(endpointEl.value.trim(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });
    const data = await resp.json();
    if (!resp.ok){
      addMsg("bot", "Erro " + resp.status + ": " + (data && (data.error || JSON.stringify(data))));
    } else {
      addMsg("bot", (data && data.answer) ? data.answer : JSON.stringify(data));
    }
  } catch (e){
    addMsg("bot", "Erro de rede. Confirma o endpoint e as variáveis na Railway.");
  } finally {
    setLoading(false);
  }
}

inputEl.addEventListener("keydown", (e)=>{
  if (e.key === "Enter" && !e.shiftKey){
    e.preventDefault();
    send();
  }
});
sendBtn.onclick = send;

addMsg("bot", "Olá! Sou o agente TCB. Faz a tua pergunta 👋");
</script>
</body>
</html>`;
  reply.type("text/html").send(html);
});

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
