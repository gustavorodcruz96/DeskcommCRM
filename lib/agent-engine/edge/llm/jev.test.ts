import { describe, expect, it, vi } from "vitest";
import { generateText } from "ai";
import { createJevIntentModel, JEV_MODEL } from "./jev";

const input = {
  signal: "Minha tela quebrou",
  recentMessages: [{ direction: "inbound" as const, body: "Quero reparar meu telefone" }],
  choices: [
    { name: "assistencia", description: "Reparo de aparelhos", examples: ["tela quebrada"] },
    { name: "varejo", description: "Compra de aparelho", examples: [] },
  ],
};
const response = () => ({
  answers: {
    intent: {
      type: "choice",
      choice: "assistencia",
      confidence: 0.9,
      probabilities: { assistencia: 0.95, varejo: 0.03, none: 0.02 },
    },
  },
  usage: { input_tokens: 100, output_tokens: 20, cost: 0.0000042 },
});

describe("Jev decisions adapter", () => {
  it("uses typed decisions through the actual SDK, preserving usage and cost", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(response()));
    const result = await generateText({
      model: createJevIntentModel("test-key", input, fetcher),
      prompt: "unused",
    });
    const [url, request] = fetcher.mock.calls[0]!;
    expect(url).toBe("https://openrouter.ai/api/alpha/decisions");
    const body = JSON.parse(String(request?.body));
    expect(body).toMatchObject({
      model: JEV_MODEL,
      state: { message: input.signal, recent_messages: input.recentMessages },
      questions: { intent: { type: "choice" } },
    });
    expect(body.questions.intent.criteria).toHaveProperty("none");
    expect(body).not.toHaveProperty("messages");
    expect(JSON.parse(result.text)).toEqual({ intent: "assistencia", confidence: 0.9 });
    expect(result.usage.inputTokens).toBe(100);
    expect(result.providerMetadata?.openrouter?.costUsd).toBe(0.0000042);
    expect(request?.signal).toBeDefined();
  });
  it.each(["unknown-choice", "invalid-confidence", "missing-option", "malformed"])(
    "rejects %s",
    async (variant) => {
      const body = response();
      if (variant === "unknown-choice") body.answers.intent.choice = "admin";
      if (variant === "invalid-confidence") body.answers.intent.confidence = 2;
      if (variant === "missing-option")
        delete (
          body.answers.intent.probabilities as Partial<typeof body.answers.intent.probabilities>
        ).none;
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(Response.json(variant === "malformed" ? {} : body));
      await expect(
        generateText({
          model: createJevIntentModel("secret", input, fetcher),
          prompt: "unused",
          maxRetries: 0,
        }),
      ).rejects.toThrow(/Jev:/);
    },
  );
  it("does not log or propagate provider error bodies", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("secret and customer text", { status: 429 }));
    await expect(
      generateText({
        model: createJevIntentModel("secret", input, fetcher),
        prompt: "unused",
        maxRetries: 0,
      }),
    ).rejects.toThrow("Jev: OpenRouter HTTP 429");
  });
  it("rejects duplicate and reserved options before network", () => {
    expect(() =>
      createJevIntentModel("secret", { ...input, choices: [input.choices[0]!, input.choices[0]!] }),
    ).toThrow(/únicas/);
    expect(() =>
      createJevIntentModel("secret", {
        ...input,
        choices: [{ name: "none", description: "", examples: [] }],
      }),
    ).toThrow(/reservado/);
  });
});
