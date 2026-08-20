"""Historical FX rate lookups via Frankfurter (free, no API key, ECB-based).
Falls back to a fixed approximate rate if the API is unreachable, so a
network hiccup doesn't take down the whole monthly import."""

import requests

FALLBACK_USD_TO_ILS = 2.97  # used only if the API call fails
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
        print(f"WARNING: FX rate lookup failed for {from_currency}->{to_currency} on {date} ({e}); using fallback rate {FALLBACK_USD_TO_ILS}")
        rate = FALLBACK_USD_TO_ILS

    _cache[key] = rate
    return rate
