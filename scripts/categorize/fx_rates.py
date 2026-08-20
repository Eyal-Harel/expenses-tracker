"""Historical FX rate lookups via Frankfurter (free, no API key, ECB-based).
Falls back to a fixed approximate rate if the API is unreachable, so a
network hiccup doesn't take down the whole monthly import."""

import requests

# Only used if the live API call fails. USD is the only currency we've
# actually seen in real data, so it's the only one with a real fallback
# number — anything else falls back to 1:1 with a loud warning rather than
# a made-up rate, since a fabricated "close enough" number for a currency
# we've never priced would be worse than an obviously-wrong 1:1.
FALLBACK_RATES = {
    "USD": 2.97,
}
_cache: dict[tuple[str, str], float] = {}


def get_rate(date: str, from_currency: str, to_currency: str = "ILS") -> float:
    """date is YYYY-MM-DD. Returns units of to_currency per 1 unit of from_currency."""
    key = (date, from_currency)
    if key in _cache:
        return _cache[key]

    try:
        response = requests.get(
            f"https://api.frankfurter.dev/v1/{date}",
            params={"from": from_currency, "to": to_currency},
            timeout=10,
        )
        response.raise_for_status()
        rate = response.json()["rates"][to_currency]
    except Exception as e:
        rate = FALLBACK_RATES.get(from_currency)
        if rate is None:
            print(f"WARNING: FX rate lookup failed for {from_currency}->{to_currency} on {date} ({e}); no fallback rate known for {from_currency}, using 1:1 — fix this amount manually")
            rate = 1.0
        else:
            print(f"WARNING: FX rate lookup failed for {from_currency}->{to_currency} on {date} ({e}); using fallback rate {rate}")

    _cache[key] = rate
    return rate
