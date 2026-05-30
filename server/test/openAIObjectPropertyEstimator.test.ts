import { describe, expect, it, vi } from "vitest";
import { OpenAIObjectPropertyEstimator } from "../src/providers/OpenAIObjectPropertyEstimator.js";

const profile = {
  objectId: "duck_01",
  label: "rubber duck",
  category: "toy",
  material: "rubber",
  massKg: 0.2,
  restitution: 0.7,
  friction: 0.55,
  static: false,
  breakable: false,
  collider: "cuboid",
  confidence: 0.8,
  notes: "Estimated from prompt."
};

const jsonResponse = (body: unknown, ok = true, status = ok ? 200 : 500) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });

describe("OpenAIObjectPropertyEstimator", () => {
  it("requests a strict structured object physics profile", async () => {
    const fetch = vi.fn(async () =>
      jsonResponse({
        output: [
          {
            type: "message",
            content: [
              {
                type: "output_text",
                text: JSON.stringify(profile)
              }
            ]
          }
        ]
      })
    );
    const estimator = new OpenAIObjectPropertyEstimator({
      apiKey: "secret",
      model: "gpt-4.1-mini",
      baseUrl: "https://api.openai.com/v1",
      fetch
    });

    await expect(
      estimator.estimate({
        objectId: "duck_01",
        label: "rubber duck",
        sourcePrompt: "rubber duck",
        dimensions: [0.24, 0.18, 0.2]
      })
    ).resolves.toEqual(profile);

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/responses");
    expect(init).toMatchObject({
      method: "POST",
      headers: {
        Authorization: "Bearer secret",
        "Content-Type": "application/json"
      }
    });

    const body = JSON.parse(String(init?.body));
    expect(body.model).toBe("gpt-4.1-mini");
    expect(body.text.format).toMatchObject({
      type: "json_schema",
      name: "object_physics_profile",
      strict: true
    });
    expect(JSON.stringify(body.input)).toContain("rubber duck");
  });

  it("surfaces OpenAI API errors with response details", async () => {
    const fetch = vi.fn(async () =>
      jsonResponse({ error: { message: "bad key" } }, false, 401)
    );
    const estimator = new OpenAIObjectPropertyEstimator({
      apiKey: "secret",
      fetch
    });

    await expect(
      estimator.estimate({ objectId: "duck_01", label: "rubber duck" })
    ).rejects.toThrow("OpenAI request failed with status 401: bad key");
  });

  it("rejects responses that do not contain parseable profile JSON", async () => {
    const fetch = vi.fn(async () => jsonResponse({ output: [] }));
    const estimator = new OpenAIObjectPropertyEstimator({
      apiKey: "secret",
      fetch
    });

    await expect(
      estimator.estimate({ objectId: "duck_01", label: "rubber duck" })
    ).rejects.toThrow("OpenAI response did not include output text");
  });
});
