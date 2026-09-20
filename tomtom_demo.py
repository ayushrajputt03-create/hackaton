"""Print TomTom traffic flow for the requested Delhi NCR locations."""

from tomtom_client import TomTomError, get_traffic_flow


LOCATIONS = [
    ("Connaught Place", 28.6328, 77.2197),
    ("India Gate", 28.6129, 77.2295),
    ("Cyber Hub, Gurugram", 28.4950, 77.0890),
    ("Noida Sector 18", 28.5697, 77.3260),
    ("Karol Bagh", 28.6519, 77.1909),
]


def main() -> None:
    print("ASTRERO / TomTom Traffic Flow\n")
    for name, latitude, longitude in LOCATIONS:
        try:
            flow = get_traffic_flow(latitude, longitude)
            status = "Heavy Traffic" if flow.heavy_traffic else "Normal Flow"
            if flow.road_closure:
                status = "Road Closure"
            print(f"{name}: {flow.current_speed:.0f} km/h current | {flow.free_flow_speed:.0f} km/h free flow | {status}")
        except TomTomError as exc:
            print(f"{name}: ERROR - {exc}")


if __name__ == "__main__":
    main()
