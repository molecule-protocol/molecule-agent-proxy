// Scope matching: does an upstream call (provider:model) satisfy a delegation?
//
// Scope strings look like:
//   "openrouter:openai/*"            — any OpenAI model via OpenRouter
//   "openrouter:openai/gpt-4o-mini"  — exactly this model
//   "openrouter:*"                   — any model via OpenRouter
//   "openai:*"                       — any model via direct OpenAI
//
// Body shape we read: { model: "openai/gpt-4o-mini", ... } (OpenRouter convention)

export function matchScope(provider: string, model: string, scope: readonly string[]): boolean {
  const target = `${provider}:${model}`;
  for (const pattern of scope) {
    if (matchOne(pattern, target)) return true;
  }
  return false;
}

function matchOne(pattern: string, target: string): boolean {
  // Convert glob pattern to regex
  const re = new RegExp("^" + pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
  return re.test(target);
}
