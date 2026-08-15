import { NextRequest, NextResponse } from "next/server";

const NVIDIA_BASE = "https://integrate.api.nvidia.com/v1";
const MODEL = "meta/llama-3.1-8b-instruct";

// --- Rate limiter: 10 requests per minute per IP ---
const RATE_LIMIT = 10;
const WINDOW_MS = 60_000;
const hits = new Map<string, number[]>();

// --- Conversation window bounds ---
// The client re-sends the full chat history on every turn. Cap the window so
// long sessions never balloon the request payload or outgrow the model
// context, and cap each message's length.
const MAX_HISTORY = 12; // 6 exchanges
const MAX_MESSAGE_LEN = 2_000;

function boundMessages(messages: { role: string; content: string }[]) {
  return messages
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_LEN) }));
}

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = hits.get(ip) ?? [];
  const recent = timestamps.filter((t) => now - t < WINDOW_MS);
  if (recent.length >= RATE_LIMIT) return false;
  recent.push(now);
  hits.set(ip, recent);
  // Cleanup stale entries every 100 requests
  if (hits.size > 100) {
    for (const [key, val] of hits) {
      const fresh = val.filter((t) => now - t < WINDOW_MS);
      if (fresh.length === 0) hits.delete(key);
      else hits.set(key, fresh);
    }
  }
  return true;
}

const SYSTEM_PROMPT = `You are the AI assistant inside SKYNET // AI LAB OS — a personal portfolio built as an interactive operating system. You represent Pallav Dholariya, a CS student specializing in AI/ML at Newton School of Technology, Pune.

Key facts about Pallav:
- Builds AI-powered applications, intelligent agents, and full-stack systems
- Strong projects: Synapse (RAG system), DeployForge (CI/CD), Omnitrix OS (WebGL), CineVault (movie platform)
- Tech: Python, TypeScript, React, Next.js, Three.js, FastAPI, LLMs, RAG, Knowledge Graphs
- Philosophy: "Learn something. Build something. Break it. Understand why. Build it better."

Rules:
- Be concise and helpful — this is a terminal, not a chatbot UI
- Keep answers under 200 words unless asked for detail
- You can answer questions about Pallav's projects, skills, experience, or general tech topics
- If asked about hiring Pallav, direct them to the contact info
- Be professional but personable — this is a portfolio, not a corporate site
- Format responses for terminal readability (no markdown headers, use plain text)`;

const MOCK_ANSWERS: Record<string, string> = {
  about: `I represent Pallav Dholariya, a CS student specializing in AI/ML at Newton School of Technology, Pune. He builds AI-powered applications, intelligent agents, and full-stack systems. Check his about section or type 'about' in the terminal for his full bio.`,
  projects: `Pallav's major projects include:\n- Synapse: An industrial intelligence RAG platform utilizing knowledge graphs.\n- DeployForge: A self-hosted automation deployment platform.\n- Omnitrix OS: A WebGL 3D interactive portfolio OS.\n- CineVault: An immersive cinematic movie discovery platform.\n- Marlboro Red: A premium editorial-style brand showcase.`,
  contact: `You can reach Pallav via:\n- Email: pallavdholariya@gmail.com\n- GitHub: https://github.com/Shivala-08\n- LinkedIn: https://www.linkedin.com/in/pallavdholariya`,
  hire: `To hire Pallav, please contact him directly at: pallavdholariya@gmail.com. He is open to internship and full-time opportunities in AI/ML development and engineering!`,
  default: `I am running in local fallback mode. Pallav is a builder of AI agents and full-stack systems specializing in ML/DL. Try asking about his projects, contact details, or type 'help' to see other terminal commands.`
};

function getMockResponse(question: string): string {
  const q = question.toLowerCase();
  if (q.includes("about") || q.includes("whoami") || q.includes("who are you")) return MOCK_ANSWERS.about;
  if (q.includes("project") || q.includes("build") || q.includes("work")) return MOCK_ANSWERS.projects;
  if (q.includes("contact") || q.includes("email") || q.includes("github") || q.includes("linkedin")) return MOCK_ANSWERS.contact;
  if (q.includes("hire") || q.includes("job") || q.includes("hiring")) return MOCK_ANSWERS.hire;
  return MOCK_ANSWERS.default;
}

function streamMockResponse(text: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Honest framing: this is a local fallback, never presented as live AI.
      controller.enqueue(
        encoder.encode("◌ offline fallback — the live AI model is unreachable right now. Try again in a moment.\n\n"),
      );
      const words = text.split(/\s+/);
      for (const word of words) {
        controller.enqueue(encoder.encode(word + " "));
        await new Promise((r) => setTimeout(r, 45)); // smooth typing simulation
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  });
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(ip)) {
    return NextResponse.json({ error: "Rate limit exceeded. Try again in a minute." }, { status: 429 });
  }

  const { messages } = await req.json();
  const bounded = boundMessages(messages ?? []);
  const userMessage = bounded[bounded.length - 1]?.content ?? "";

  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    return streamMockResponse(getMockResponse(userMessage));
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000); // first-token timeout (cold starts are slow)

    const response = await fetch(`${NVIDIA_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...bounded,
        ],
        temperature: 0.6,
        top_p: 0.9,
        max_tokens: 512,
        stream: true,
      }),
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return streamMockResponse(getMockResponse(userMessage));
    }

    // Stream the response back to the client
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith("data: ")) continue;
              const data = trimmed.slice(6);
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  controller.enqueue(encoder.encode(content));
                }
              } catch {
                // Skip malformed JSON lines
              }
            }
          }
        } catch (err) {
          controller.error(err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });

  } catch {
    return streamMockResponse(getMockResponse(userMessage));
  }
}
