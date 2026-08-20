/** Historical FX rate lookups via Frankfurter (free, no API key, ECB-based).
 * Falls back to a fixed approximate rate if the API is unreachable, so a
 * network hiccup doesn't take down the whole monthly import. */

// Only used if the live API call fails. USD is the only currency we've
// actually seen in real data, so it's the only one with a real fallback
// number — anything else falls back to 1:1 with a loud warning rather than
// a made-up rate, since a fabricated "close enough" number for a currency
// we've never priced would be worse than an obviously-wrong 1:1.
const FALLBACK_RATES: Record<string, number> = {
  USD: 2.97,
};

const cache = new Map<string, number>();

/** date is YYYY-MM-DD. Returns units of toCurrency per 1 unit of fromCurrency. */
export async function getRate(date: string, fromCurrency: string, toCurrency = "ILS"): Promise<number> {
  const key = `${date}|${fromCurrency}|${toCurrency}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  let rate: number;
  try {
    const response = await fetch(
      `https://api.frankfurter.dev/v1/${date}?from=${fromCurrency}&to=${toCurrency}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    rate = data.rates[toCurrency];
  } catch (e) {
    const fallback = FALLBACK_RATES[fromCurrency];
    if (fallback === undefined) {
      console.warn(
        `FX rate lookup failed for ${fromCurrency}->${toCurrency} on ${date} (${e}); no fallback rate known for ${fromCurrency}, using 1:1 — fix this amount manually`,
      );
      rate = 1.0;
    } else {
      console.warn(
        `FX rate lookup failed for ${fromCurrency}->${toCurrency} on ${date} (${e}); using fallback rate ${fallback}`,
      );
      rate = fallback;
    }
  }

  cache.set(key, rate);
  return rate;
}
