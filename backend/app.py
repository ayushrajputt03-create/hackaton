from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from flask import Flask, jsonify, request

try:
    from .traffic_model import calculate_fixed_time, calculate_green_time, calculate_green_wave, calculate_savings, calculate_wait_time
except ImportError:
    from traffic_model import calculate_fixed_time, calculate_green_time, calculate_green_wave, calculate_savings, calculate_wait_time

app = Flask(__name__)
DATA_PATH = Path(__file__).with_name("mock_data.json")
with DATA_PATH.open(encoding="utf-8") as file:
    raw_junctions = json.load(file)

ai_mode = {"enabled": True}


def junction_list() -> list[dict]:
    return [{"id": key, **value} for key, value in raw_junctions.items()]


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    return response


@app.get("/api/traffic-status")
def traffic_status():
    requested_mode = request.args.get("mode", "ai").lower()
    use_ai = requested_mode != "fixed"
    result = []
    for junction in junction_list():
        densities = {key: junction[key] for key in ("North", "South", "East", "West")}
        green_times = calculate_green_time(densities) if use_ai else calculate_fixed_time(densities)
        result.append({"id": junction["id"], "name": junction["name"], "lat": junction["lat"], "lng": junction["lng"], "current_counts": densities, "densities": densities, "green_times": green_times, "recommended_green_times": green_times, "estimated_wait_time_seconds": calculate_wait_time(densities, green_times)})
    return jsonify({"mode": "ai" if use_ai else "fixed", "junctions": result})


def mode_snapshot(mode: str) -> dict:
    junctions = []
    total_wait = 0
    for junction in junction_list():
        densities = {key: junction[key] for key in ("North", "South", "East", "West")}
        green_times = calculate_green_time(densities) if mode == "ai" else calculate_fixed_time(densities)
        wait = calculate_wait_time(densities, green_times)
        junctions.append({"id": junction["id"], "name": junction["name"], "green_times": green_times, "wait_time": wait})
        total_wait += wait
    return {"green_times": {item["id"]: item["green_times"] for item in junctions}, "wait_time": round(total_wait, 2), "junctions": junctions}


@app.get("/api/compare-modes")
def compare_modes():
    fixed = mode_snapshot("fixed")
    ai = mode_snapshot("ai")
    improvement = max(0, round(((fixed["wait_time"] - ai["wait_time"]) / fixed["wait_time"]) * 100, 2)) if fixed["wait_time"] else 0
    return jsonify({"fixed": fixed, "ai": ai, "improvement_percent": improvement})


@app.get("/api/green-wave")
def green_wave():
    return jsonify(calculate_green_wave(junction_list(), float(request.args.get("speed", 36))))


@app.route("/api/toggle-mode", methods=["GET", "POST"])
def toggle_mode():
    if request.method == "POST":
        payload = request.get_json(silent=True) or {}
        if "enabled" in payload:
            if not isinstance(payload["enabled"], bool):
                return jsonify({"error": "enabled must be a boolean"}), 400
            ai_mode["enabled"] = payload["enabled"]
    return jsonify({"enabled": ai_mode["enabled"], "mode": "AI" if ai_mode["enabled"] else "FIXED"})


@app.get("/api/savings")
def savings():
    vehicles = sum(sum(j[key] for key in ("North", "South", "East", "West")) for j in junction_list())
    return jsonify(calculate_savings(vehicles, 142 if ai_mode["enabled"] else 0))


@app.post("/api/ai/traffic")
def ai_traffic():
    """Rule-based Tarrid assistant using the same live traffic dataset as the map."""
    payload = request.get_json(silent=True) or {}
    message = str(payload.get("message", "")).strip()
    if not message:
        return jsonify({"error": "message is required"}), 400
    records = []
    for junction in junction_list():
        counts = {key: int(junction[key]) for key in ("North", "South", "East", "West")}
        vehicles = sum(counts.values())
        level = "SEVERE" if vehicles >= 190 else "HIGH" if vehicles >= 130 else "MODERATE" if vehicles >= 90 else "LOW"
        records.append({"name": junction["name"], "vehicles": vehicles, "level": level, "lat": junction["lat"], "lng": junction["lng"]})
    text = message.lower()
    severe = [item for item in records if item["level"] in ("SEVERE", "HIGH")]
    if any(word in text for word in ("fastest", "route", "corridor", "emergency", "jaana")):
        fastest = min(records, key=lambda item: item["vehicles"])
        response = f"Live data ke according {fastest['name']} corridor sabse light hai, {fastest['vehicles']} vehicles monitored hain. Emergency corridor decision-support available hai; signal control automatically nahi kiya gaya hai."
    elif any(word in text for word in ("summary", "summarize", "health", "overall", "kaisa")):
        response = f"Network mein {len(severe)} junctions par high ya severe traffic hai. Sabse zyada load {max(records, key=lambda item: item['vehicles'])['name']} par hai; baaki locations ka data live monitoring mein hai."
    elif any(word in text for word in ("jam", "traffic", "congestion", "heavy", "road")):
        response = "Abhi live data ke according " + ("; ".join(f"{item['name']} par {item['level'].lower()} traffic ({item['vehicles']} vehicles)" for item in severe) if severe else "monitored junctions par traffic low ya moderate hai") + "."
    else:
        response = "Main live traffic data dekh sakta hoon. Aap pooch sakte hain: kahan jam hai, network summary, ya fastest corridor."
    return jsonify({"response": response, "traffic": records, "timestamp": datetime.now(timezone.utc).isoformat()})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)
