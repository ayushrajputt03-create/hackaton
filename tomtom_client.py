"""Small server-side TomTom Traffic Flow client.

The API key is intentionally loaded only from the environment. Never import
this module into browser code or expose TOMTOM_API_KEY in a frontend bundle.
"""

from __future__ import annotations

import json
import os
import ssl
from dataclasses import dataclass
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

try:
    from dotenv import load_dotenv
except ImportError:  # Keep the module usable when dependencies are not installed yet.
    load_dotenv = None

try:
    import certifi
except ImportError:  # Fall back to the operating system certificate store.
    certifi = None

try:
    import truststore
except ImportError:
    truststore = None


TOMTOM_FLOW_URL = "https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json"


class TomTomError(RuntimeError):
    """Expected TomTom configuration, API, or network failure."""


@dataclass(frozen=True)
class TrafficFlow:
    current_speed: float
    free_flow_speed: float
    current_travel_time: int
    road_closure: bool
    heavy_traffic: bool
    confidence: float | None = None


def _load_environment() -> None:
    if load_dotenv:
        load_dotenv()


def get_traffic_flow(latitude: float, longitude: float, timeout: float = 10) -> TrafficFlow:
    """Fetch and normalize TomTom flow data for one latitude/longitude pair."""
    _load_environment()
    api_key = os.getenv("TOMTOM_API_KEY")
    if not api_key:
        raise TomTomError("TOMTOM_API_KEY is missing. Add it to .env or the process environment.")

    try:
        lat = float(latitude)
        lon = float(longitude)
    except (TypeError, ValueError) as exc:
        raise TomTomError("Latitude and longitude must be numeric values.") from exc
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise TomTomError("Latitude or longitude is outside its valid range.")

    query = urlencode({"key": api_key, "point": f"{lat},{lon}", "unit": "KMPH"})
    request = Request(f"{TOMTOM_FLOW_URL}?{query}", headers={"Accept": "application/json"})
    try:
        if truststore:
            ssl_context = truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
        else:
            ssl_context = ssl.create_default_context(cafile=certifi.where()) if certifi else ssl.create_default_context()
        with urlopen(request, timeout=timeout, context=ssl_context) as response:
            payload = json.load(response)
    except HTTPError as exc:
        if exc.code in (401, 403):
            message = "TomTom rejected the API key. Check TOMTOM_API_KEY and its permissions."
        elif exc.code == 429:
            message = "TomTom rate limit reached. Retry after a short backoff."
        else:
            message = f"TomTom API returned HTTP {exc.code}."
        raise TomTomError(message) from exc
    except (URLError, TimeoutError) as exc:
        raise TomTomError(f"TomTom network request failed: {exc.reason if hasattr(exc, 'reason') else exc}") from exc
    except json.JSONDecodeError as exc:
        raise TomTomError("TomTom returned an invalid JSON response.") from exc

    try:
        data = payload["flowSegmentData"]
        current_speed = float(data["currentSpeed"])
        free_flow_speed = float(data["freeFlowSpeed"])
        current_travel_time = int(data["currentTravelTime"])
        road_closure = bool(data["roadClosure"])
        confidence = float(data["confidence"]) if data.get("confidence") is not None else None
    except (KeyError, TypeError, ValueError) as exc:
        raise TomTomError("TomTom response is missing expected flowSegmentData fields.") from exc

    return TrafficFlow(
        current_speed=current_speed,
        free_flow_speed=free_flow_speed,
        current_travel_time=current_travel_time,
        road_closure=road_closure,
        heavy_traffic=current_speed < free_flow_speed * 0.6,
        confidence=confidence,
    )
