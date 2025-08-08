import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL || "gpt-5";

export async function chatWithAgent(userMessage: string) {
  const systemPrompt = [
    "És um agente de apoio aos clientes dos Transportes Colectivos do Barreiro (TCB).",
    "Responde em português de Portugal, de forma direta e objetiva.",
    "Se não souberes a resposta, diz que não tens essa informação."
  ].join("\n");

  const messages = [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: userMessage }
  ];

  const completion = await client.chat.completions.create({
    model: MODEL,
    messages,
    temperature: 0.2
  });

  return {
    answer: completion.choices[0]?.message?.content ?? "",
    usedModel: MODEL
  };
}
