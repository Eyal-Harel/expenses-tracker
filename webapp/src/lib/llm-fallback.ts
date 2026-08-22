import { ApiError, GoogleGenAI } from "@google/genai";
import { normalizeCategory } from "./categories";

const PROMPT_TEMPLATE = (source: string, merchant: string, amount: number, categories: readonly string[]) => `You are categorizing a single personal expense transaction for an Israeli household budget.

Source: ${source}
Merchant / description: ${merchant}
Amount: ${amount} ILS

Pick exactly ONE category from this list that best fits. Respond with ONLY the category name, nothing else — no punctuation, no explanation.

${categories.join("\n")}`;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Calls the Gemini API to categorize a transaction that no rule matched.
 * Falls back to 'Others' if the model returns something unrecognized.
 * Retries with backoff on transient server-side errors (e.g. 503 overloaded). */
export async function categorizeWithLlm(
  merchant: string,
  amount: number,
  source: string,
  apiKey: string,
  categories: readonly string[],
  retries = 3,
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  const prompt = PROMPT_TEMPLATE(source, merchant, amount, categories);

  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await ai.models.generateContent({ model: "gemini-3.6-flash", contents: prompt });
      return normalizeCategory(response.text, categories) ?? "Others";
    } catch (e) {
      const isServerError = e instanceof ApiError && e.status >= 500;
      if (!isServerError) throw e;
      lastError = e;
      if (attempt < retries - 1) {
        await sleep(2 ** attempt * 1000); // 1s, 2s, 4s...
      }
    }
  }
  throw lastError;
}
