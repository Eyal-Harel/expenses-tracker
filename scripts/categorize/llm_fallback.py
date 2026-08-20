import os

from .categories import CANONICAL_CATEGORIES, normalize_category

_PROMPT_TEMPLATE = """You are categorizing a single personal expense transaction for an Israeli household budget.

Source: {source}
Merchant / description: {merchant}
Amount: {amount} ILS

Pick exactly ONE category from this list that best fits. Respond with ONLY the category name, nothing else — no punctuation, no explanation.

{categories}"""


def _build_prompt(merchant: str, amount: float, source: str) -> str:
    return _PROMPT_TEMPLATE.format(
        source=source,
        merchant=merchant,
        amount=amount,
        categories="\n".join(CANONICAL_CATEGORIES),
    )


def categorize_with_llm(merchant: str, amount: float, source: str, retries: int = 3) -> str:
    """Calls the Gemini API to categorize a transaction that no rule matched.
    Falls back to 'Others' if the model returns something unrecognized.
    Retries with backoff on transient server-side errors (e.g. 503 overloaded)."""
    import time

    from google import genai
    from google.genai import errors as genai_errors

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set")

    client = genai.Client(api_key=api_key)
    prompt = _build_prompt(merchant, amount, source)

    last_error = None
    for attempt in range(retries):
        try:
            response = client.models.generate_content(model="gemini-3.6-flash", contents=prompt)
            return normalize_category(response.text) or "Others"
        except genai_errors.ServerError as e:
            last_error = e
            if attempt < retries - 1:
                time.sleep(2 ** attempt)  # 1s, 2s, 4s...
    raise last_error
