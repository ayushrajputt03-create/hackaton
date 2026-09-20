from __future__ import annotations

import json
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


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
