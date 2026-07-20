// Central AI provider registry — single source of truth for every platform
// the key vault supports. Adding a provider here automatically enables it in
// the admin dropdown, key testing, and env fallback. Modular by design.

export type ProviderId =
  | "openrouter"
  | "gemini"
  | "openai"
  | "anthropic"
  | "groq"
  | "mistral"
  | "deepseek"
  | "xai"
  | "together";

export type ProviderDef = {
  id: ProviderId;
  label: string;
  envVar: string;
  // How to verify a key with a real call.
  test:
    | { kind: "openai-models"; baseUrl: string } // GET {baseUrl}/models, Bearer
    | { kind: "anthropic" }
    | { kind: "gemini" }
    | { kind: "openrouter" };
  keyHint: string;
  signupUrl: string;
};

export const PROVIDERS: ProviderDef[] = [
  {
    id: "openrouter",
    label: "OpenRouter (primary — free vision models)",
    envVar: "OPENROUTER_API_KEY",
    test: { kind: "openrouter" },
    keyHint: "sk-or-v1-…",
    signupUrl: "openrouter.ai/keys",
  },
  {
    id: "gemini",
    label: "Google Gemini (AI Studio)",
    envVar: "GEMINI_API_KEY",
    test: { kind: "gemini" },
    keyHint: "AIza…",
    signupUrl: "aistudio.google.com/app/apikey",
  },
  {
    id: "openai",
    label: "OpenAI",
    envVar: "OPENAI_API_KEY",
    test: { kind: "openai-models", baseUrl: "https://api.openai.com/v1" },
    keyHint: "sk-…",
    signupUrl: "platform.openai.com",
  },
  {
    id: "anthropic",
    label: "Anthropic Claude",
    envVar: "ANTHROPIC_API_KEY",
    test: { kind: "anthropic" },
    keyHint: "sk-ant-…",
    signupUrl: "console.anthropic.com",
  },
  {
    id: "groq",
    label: "Groq (fast, free tier)",
    envVar: "GROQ_API_KEY",
    test: { kind: "openai-models", baseUrl: "https://api.groq.com/openai/v1" },
    keyHint: "gsk_…",
    signupUrl: "console.groq.com/keys",
  },
  {
    id: "mistral",
    label: "Mistral AI",
    envVar: "MISTRAL_API_KEY",
    test: { kind: "openai-models", baseUrl: "https://api.mistral.ai/v1" },
    keyHint: "…",
    signupUrl: "console.mistral.ai",
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    envVar: "DEEPSEEK_API_KEY",
    test: { kind: "openai-models", baseUrl: "https://api.deepseek.com" },
    keyHint: "sk-…",
    signupUrl: "platform.deepseek.com",
  },
  {
    id: "xai",
    label: "xAI Grok",
    envVar: "XAI_API_KEY",
    test: { kind: "openai-models", baseUrl: "https://api.x.ai/v1" },
    keyHint: "xai-…",
    signupUrl: "console.x.ai",
  },
  {
    id: "together",
    label: "Together AI",
    envVar: "TOGETHER_API_KEY",
    test: { kind: "openai-models", baseUrl: "https://api.together.xyz/v1" },
    keyHint: "…",
    signupUrl: "api.together.ai",
  },
];

export const PROVIDER_IDS = PROVIDERS.map((p) => p.id);

export function getProvider(id: string): ProviderDef | undefined {
  return PROVIDERS.find((p) => p.id === id);
}
