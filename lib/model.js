/*
 * The model providers, in one place.
 *
 * This was written inside app/api/match and stayed there while it had one
 * caller. It has three now (matching, suggestion dedup, and research drafts),
 * and three copies of a provider chain is how one of them ends up without the
 * fallback, or pinned to a model nobody meant to keep using.
 *
 * ANTHROPIC_API_KEY and OPENAI_API_KEY are read here and nowhere else. Nothing
 * in this file may be imported by a client component: the browser talks to our
 * own routes, and the keys stay on the server. That is invariant 2 in
 * CLAUDE.md and it is the reason this is a lib rather than a fetch written
 * inline wherever a model is wanted.
 *
 * Anthropic first, OpenAI second, either order pinnable with MATCH_PROVIDER.
 * Whichever is preferred, the other is tried when the first fails, so one
 * provider having a bad afternoon degrades a feature rather than removing it.
 * With no key at all `configured()` is false and every caller is expected to
 * have a non-model path, because a directory that stops accepting suggestions
 * when a vendor's API is down is worse than one that matches on domain names.
 */

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o";

async function askAnthropic({ system, prompt, maxTokens, signal }) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
    signal,
  });
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
}

async function askOpenAI({ system, prompt, maxTokens, signal }) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
    signal,
  });
  if (!res.ok) throw new Error(`openai ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

export function providers() {
  const available = [];
  if (process.env.ANTHROPIC_API_KEY) available.push({ name: "anthropic", ask: askAnthropic });
  if (process.env.OPENAI_API_KEY) available.push({ name: "openai", ask: askOpenAI });
  const preferred = (process.env.MATCH_PROVIDER || "").toLowerCase();
  if (preferred) {
    available.sort((a, b) => (a.name === preferred ? -1 : b.name === preferred ? 1 : 0));
  }
  return available;
}

export const configured = () => providers().length > 0;

/**
 * Ask whichever provider answers first, and say which one did.
 *
 * Returns `{ text, provider }`, or throws with every provider's failure
 * attached. The caller decides whether that is fatal: the matcher 502s, the
 * suggestion route falls back to matching on names and domains.
 */
export async function askModel({ system, prompt, maxTokens = 1000, timeoutMs = 60_000 }) {
  const chain = providers();
  if (!chain.length) throw new Error("no model provider configured");

  const failures = [];
  for (const provider of chain) {
    try {
      const text = await provider.ask({
        system, prompt, maxTokens,
        signal: AbortSignal.timeout(timeoutMs),
      });
      return { text, provider: provider.name };
    } catch (e) {
      failures.push(`${provider.name}: ${e.message}`);
      console.error("[model] provider failed —", provider.name, e.message);
    }
  }
  throw new Error(failures.join(" | ") || "no provider answered");
}

/**
 * The same, parsed as JSON.
 *
 * Anthropic is not in a JSON mode, so it can wrap the object in a fence or a
 * sentence however firmly it was asked not to. Stripping fences and then
 * taking the outermost braces is cheaper than being strict and losing an
 * otherwise good answer to a stray "Here is the JSON:".
 */
export async function askJson({ system, prompt, maxTokens, timeoutMs }) {
  const { text, provider } = await askModel({ system, prompt, maxTokens, timeoutMs });
  const cleaned = String(text).replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const slice = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  return { data: JSON.parse(slice), provider, raw: text };
}
