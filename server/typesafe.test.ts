import { afterEach, describe, expect, it, vi } from "vitest";
import { analyzeSignal } from "./typesafe";

const validPayload = {
  answers: {
    next_move: {
      type: "choice",
      choice: "clarify",
      probabilities: {
        launch: 0.12,
        clarify: 0.72,
        protect: 0.08,
        discover: 0.08,
      },
      confidence: 0.82,
    },
    time_sensitive: {
      type: "noul",
      noul: 0.09,
    },
    delivery_readiness: {
      type: "score",
      score: 1.74,
      legend: {},
      probabilities: {},
      confidence: 0.77,
    },
  },
  usage: {
    input_tokens: 18,
    output_tokens: 7,
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("analyzeSignal", () => {
  it("authenticates and returns a typed semantic judgment", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-token");
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json(validPayload));
    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzeSignal(
      "The checkout total differs from the product page."
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.typesafe.ai/v1/systemone",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
          "Content-Type": "application/json",
        }),
      })
    );
    expect(result).toMatchObject({
      intent: { type: "choice", choice: "clarify", confidence: 0.82 },
      urgency: { type: "noul", noul: 0.09 },
      readiness: { type: "score", score: 1.74, confidence: 0.77 },
      route: "advance",
      usage: { inputTokens: 18, outputTokens: 7 },
    });
  });

  it("fails clearly when no API key is configured", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "");

    await expect(
      analyzeSignal("A sufficiently long product note.")
    ).rejects.toThrow("TypeSafe AI is not configured on this server.");
  });

  it("rejects malformed provider responses", async () => {
    vi.stubEnv("TYPESAFE_API_KEY", "test-token");
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(Response.json({ answers: {} }))
    );

    await expect(
      analyzeSignal("A sufficiently long product note.")
    ).rejects.toThrow("TypeSafe AI returned an unexpected response shape.");
  });
});
