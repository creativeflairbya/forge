// Modular vision-analysis orchestrator.
//
// Provider priority: OpenRouter (free vision model chain) → Gemini → error.
// The application layer (analyze-chart route) only calls analyzeImage() and
// never knows which provider/model produced the answer, so providers can be
// added, removed, or reordered here without changing application logic.

import { openrouterEnabled, openrouterVision } from "./openrouter";
import { geminiEnabled, geminiVision } from "./gemini";

export type VisionResult = {
  text: string;
  provider: "openrouter" | "gemini";
  model: string;
};

export async function visionAvailable(): Promise<boolean> {
  return (await openrouterEnabled()) || (await geminiEnabled());
}

export async function analyzeImage(
  prompt: string,
  imageBase64: string,
  mimeType: string
): Promise<VisionResult> {
  const errors: string[] = [];

  // 1. OpenRouter — primary
  if (await openrouterEnabled()) {
    try {
      const r = await openrouterVision(prompt, imageBase64, mimeType);
      return { text: r.text, provider: "openrouter", model: r.model };
    } catch (e) {
      errors.push(
        `OpenRouter: ${e instanceof Error ? e.message : "failed"}`
      );
    }
  }

  // 2. Gemini — secondary
  if (await geminiEnabled()) {
    try {
      const text = await geminiVision(prompt, imageBase64, mimeType);
      return {
        text,
        provider: "gemini",
        model: process.env.GEMINI_MODEL || "gemini(auto)",
      };
    } catch (e) {
      errors.push(`Gemini: ${e instanceof Error ? e.message : "failed"}`);
    }
  }

  throw new Error(
    errors.length
      ? `All vision providers failed. ${errors.join(" | ").slice(0, 500)}`
      : "No vision provider configured. Add an OpenRouter or Gemini key in the admin dashboard."
  );
}
