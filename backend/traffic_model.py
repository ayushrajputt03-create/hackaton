"""Fast, explainable traffic calculations for the hackathon simulation."""

BASE_GREEN = 20
FIXED_GREEN = 30
AVG_SERVICE_TIME_SECONDS = 2
IDLE_FUEL_LPH = 0.6
CO2_KG_PER_LITER = 2.31


def calculate_green_time(densities: dict[str, int]) -> dict[str, int]:
    total = sum(max(0, int(value)) for value in densities.values())
    if total == 0:
        return {direction: BASE_GREEN for direction in densities}
    return {direction: int(BASE_GREEN + (max(0, int(count)) / total) * 60) for direction, count in densities.items()}


def calculate_fixed_time(densities: dict[str, int]) -> dict[str, int]:
    """Traditional controller: every approach receives the same green time."""
    return {direction: FIXED_GREEN for direction in densities}


def calculate_wait_time(densities: dict[str, int], green_times: dict[str, int]) -> float:
    """Estimate queue service time without ever dividing by zero."""
    total_vehicles = sum(max(0, int(value)) for value in densities.values())
    active_times = [max(1, int(value)) for value in green_times.values()]
    average_green = sum(active_times) / len(active_times) if active_times else FIXED_GREEN
    return round((total_vehicles * AVG_SERVICE_TIME_SECONDS) / average_green, 2)


def calculate_green_wave(junctions: list[dict], average_speed_kmph: float = 36) -> dict:
    """Return offsets based on distance between consecutive simulated junctions."""
    average_speed_mps = max(1, average_speed_kmph * 1000 / 3600)
    offsets = []
    for index, junction in enumerate(junctions):
        offset = 0 if index == 0 else round((index * 320) / average_speed_mps)
        offsets.append({"junction_id": junction["id"], "name": junction["name"], "offset_seconds": offset, "green_seconds": 30})
    return {"active": True, "average_speed_kmph": average_speed_kmph, "junctions": offsets}


def calculate_savings(total_vehicles: int, time_saved_seconds: float) -> dict:
    fuel_saved = max(0, total_vehicles) * max(0, time_saved_seconds) / 3600 * IDLE_FUEL_LPH
    return {"fuel_saved_liters": round(fuel_saved, 2), "co2_saved_kg": round(fuel_saved * CO2_KG_PER_LITER, 2), "vehicles": total_vehicles, "time_saved_seconds": time_saved_seconds}
