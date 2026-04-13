#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import shutil
import sys
import urllib.request
import zipfile
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "public" / "data" / "tokyo"
CACHE_DIR = PROJECT_ROOT / ".cache" / "official-station-data"

TOKYO_CORE_BOUNDS = {
    "west": 139.52,
    "east": 139.95,
    "south": 35.55,
    "north": 35.82,
}

SAME_NAME_MERGE_DISTANCE_M = 900
SEED_MATCH_DISTANCE_M = 1500

N02_DATASET = {
    "id": "N02-24",
    "url": "https://nlftp.mlit.go.jp/ksj/gml/data/N02/N02-24/N02-24_GML.zip",
    "member": "UTF-8/N02-24_Station.geojson",
    "metadata": "KS-META-N02-24.xml",
}

S12_DATASET = {
    "id": "S12-24",
    "url": "https://nlftp.mlit.go.jp/ksj/gml/data/S12/S12-24/S12-24_GML.zip",
    "member": "UTF-8/S12-24_NumberOfPassengers.geojson",
    "metadata": "KS-META-S12-24.xml",
    "latest_year": 2023,
    "latest_passenger_field": "S12_057",
    "latest_exists_field": "S12_054",
    "latest_duplicate_field": "S12_055",
}

RIDERSHIP_DUPLICATE_REPRESENTATIVE = 1
RIDERSHIP_DUPLICATE_NON_REPRESENTATIVE = 2
RIDERSHIP_EXISTS_CODE = 1


@dataclass
class OfficialStationGroup:
    name_ja: str
    station_code: str
    group_codes: list[str]
    lat: float
    lng: float
    operators: list[str]
    lines: list[str]
    ridership_daily: int
    ridership_covered: bool


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build Tokyo station master from MLIT official datasets.",
    )
    parser.add_argument(
        "--force-download",
        action="store_true",
        help="Re-download the official zip files even if cached locally.",
    )
    return parser.parse_args()


def download_if_needed(url: str, target: Path, force: bool) -> None:
    if target.exists() and not force:
        return

    target.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url) as response, target.open("wb") as output:
        shutil.copyfileobj(response, output)


def load_geojson_from_zip(zip_path: Path, member: str) -> dict[str, Any]:
    with zipfile.ZipFile(zip_path) as archive:
        return json.loads(archive.read(member))


def flatten_coordinates(geometry: dict[str, Any]) -> list[tuple[float, float]]:
    coordinates = geometry["coordinates"]
    geometry_type = geometry["type"]

    if geometry_type == "LineString":
        return [tuple(point) for point in coordinates]

    if geometry_type == "MultiLineString":
        return [tuple(point) for part in coordinates for point in part]

    raise ValueError(f"unsupported_geometry:{geometry_type}")


def mean_coordinate(points: list[tuple[float, float]]) -> tuple[float, float]:
    lng = sum(point[0] for point in points) / len(points)
    lat = sum(point[1] for point in points) / len(points)
    return lat, lng


def is_in_tokyo_core(lat: float, lng: float) -> bool:
    return (
        TOKYO_CORE_BOUNDS["west"] <= lng <= TOKYO_CORE_BOUNDS["east"]
        and TOKYO_CORE_BOUNDS["south"] <= lat <= TOKYO_CORE_BOUNDS["north"]
    )


def haversine_meters(lat_a: float, lng_a: float, lat_b: float, lng_b: float) -> float:
    radius = 6_371_000
    phi_1 = math.radians(lat_a)
    phi_2 = math.radians(lat_b)
    delta_phi = math.radians(lat_b - lat_a)
    delta_lambda = math.radians(lng_b - lng_a)

    value = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi_1) * math.cos(phi_2) * math.sin(delta_lambda / 2) ** 2
    )
    return 2 * radius * math.atan2(math.sqrt(value), math.sqrt(1 - value))


def slugify_station_id(name_ja: str, fallback_code: str) -> str:
    translated = []
    previous_dash = False

    for character in name_ja.lower():
        if "a" <= character <= "z" or "0" <= character <= "9":
            translated.append(character)
            previous_dash = False
            continue

        if character in {" ", "-", "_"}:
            if not previous_dash:
                translated.append("-")
            previous_dash = True
            continue

    slug = "".join(translated).strip("-")
    if slug:
        return slug

    return f"station-{fallback_code}"


def dedupe_sorted(values: list[str]) -> list[str]:
    return sorted({value for value in values if value})


def load_seed_overrides() -> list[dict[str, Any]]:
    path = DATA_DIR / "stations.seed.json"
    return json.loads(path.read_text(encoding="utf-8"))


def build_ridership_map(features: list[dict[str, Any]]) -> dict[str, int]:
    ridership_by_group: dict[str, int] = defaultdict(int)

    for feature in features:
        properties = feature["properties"]
        if properties.get(S12_DATASET["latest_exists_field"]) != RIDERSHIP_EXISTS_CODE:
            continue
        if (
            properties.get(S12_DATASET["latest_duplicate_field"])
            != RIDERSHIP_DUPLICATE_REPRESENTATIVE
        ):
            continue

        ridership = properties.get(S12_DATASET["latest_passenger_field"]) or 0
        ridership_by_group[properties["S12_001g"]] += int(ridership)

    return ridership_by_group


def build_official_station_groups(
    n02_features: list[dict[str, Any]],
    ridership_by_group: dict[str, int],
) -> list[OfficialStationGroup]:
    provisional: dict[str, dict[str, Any]] = {}

    for feature in n02_features:
        properties = feature["properties"]
        points = flatten_coordinates(feature["geometry"])
        lat, lng = mean_coordinate(points)

        if not is_in_tokyo_core(lat, lng):
            continue

        group_code = properties["N02_005g"]
        current = provisional.setdefault(
            group_code,
            {
                "name_ja": properties["N02_005"],
                "station_code": properties["N02_005c"],
                "group_codes": [group_code],
                "all_points": [],
                "operators": set(),
                "lines": set(),
            },
        )
        current["all_points"].extend(points)
        current["operators"].add(properties["N02_004"])
        current["lines"].add(properties["N02_003"])

    provisional_groups: list[OfficialStationGroup] = []
    for group_code, item in provisional.items():
        lat, lng = mean_coordinate(item["all_points"])
        provisional_groups.append(
            OfficialStationGroup(
                name_ja=item["name_ja"],
                station_code=item["station_code"],
                group_codes=item["group_codes"],
                lat=lat,
                lng=lng,
                operators=dedupe_sorted(list(item["operators"])),
                lines=dedupe_sorted(list(item["lines"])),
                ridership_daily=ridership_by_group.get(group_code, 0),
                ridership_covered=group_code in ridership_by_group,
            ),
        )

    by_name: dict[str, list[OfficialStationGroup]] = defaultdict(list)
    for item in provisional_groups:
        by_name[item.name_ja].append(item)

    merged_groups: list[OfficialStationGroup] = []
    for same_name_groups in by_name.values():
        clusters: list[list[OfficialStationGroup]] = []

        for station in same_name_groups:
            target_cluster: list[OfficialStationGroup] | None = None
            for cluster in clusters:
                if any(
                    haversine_meters(station.lat, station.lng, member.lat, member.lng)
                    <= SAME_NAME_MERGE_DISTANCE_M
                    for member in cluster
                ):
                    target_cluster = cluster
                    break
            if target_cluster is None:
                clusters.append([station])
            else:
                target_cluster.append(station)

        for cluster in clusters:
            merged_groups.append(merge_station_cluster(cluster))

    return merged_groups


def merge_station_cluster(cluster: list[OfficialStationGroup]) -> OfficialStationGroup:
    all_group_codes = dedupe_sorted([code for item in cluster for code in item.group_codes])
    lat = sum(item.lat for item in cluster) / len(cluster)
    lng = sum(item.lng for item in cluster) / len(cluster)

    return OfficialStationGroup(
        name_ja=cluster[0].name_ja,
        station_code=min(item.station_code for item in cluster),
        group_codes=all_group_codes,
        lat=lat,
        lng=lng,
        operators=dedupe_sorted([value for item in cluster for value in item.operators]),
        lines=dedupe_sorted([value for item in cluster for value in item.lines]),
        ridership_daily=sum(item.ridership_daily for item in cluster),
        ridership_covered=any(item.ridership_covered for item in cluster),
    )


def match_seed_overrides(
    official_stations: list[OfficialStationGroup],
    seed_overrides: list[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    matches: dict[str, dict[str, Any]] = {}
    unresolved: list[str] = []

    for seed in seed_overrides:
        seed_name = seed.get("nameJa") or seed.get("name")
        candidates = [
            station for station in official_stations if station.name_ja == seed_name
        ]

        if not candidates:
            unresolved.append(seed["id"])
            continue

        nearest = min(
            candidates,
            key=lambda station: haversine_meters(
                seed["lat"],
                seed["lng"],
                station.lat,
                station.lng,
            ),
        )

        distance = haversine_meters(seed["lat"], seed["lng"], nearest.lat, nearest.lng)
        if distance > SEED_MATCH_DISTANCE_M:
            unresolved.append(seed["id"])
            continue

        matches[nearest.station_code] = seed

    if unresolved:
        joined = ",".join(unresolved)
        raise SystemExit(f"failed_to_match_seed_overrides:{joined}")

    return matches


def calculate_heat_scores(stations: list[OfficialStationGroup]) -> dict[str, int]:
    ridership_values = [
        math.log1p(station.ridership_daily)
        for station in stations
        if station.ridership_daily > 0
    ]
    min_log = min(ridership_values) if ridership_values else 0
    max_log = max(ridership_values) if ridership_values else 1
    denominator = max(max_log - min_log, 1e-9)

    scores: dict[str, int] = {}
    for station in stations:
        if station.ridership_daily > 0:
            normalized = (math.log1p(station.ridership_daily) - min_log) / denominator
            base = 42 + normalized * 46
        else:
            base = 26

        transfer_bonus = min(12, max(0, len(station.lines) - 1) * 2.4)
        score = round(min(100, base + transfer_bonus))
        scores[station.station_code] = int(score)

    return scores


def build_label_tiers(
    stations: list[OfficialStationGroup],
    seed_matches: dict[str, dict[str, Any]],
) -> dict[str, str]:
    forced_major_codes = {
        station_code
        for station_code, seed in seed_matches.items()
        if seed.get("labelTier") == "major"
    }
    top_ridership = sorted(
        stations,
        key=lambda station: station.ridership_daily,
        reverse=True,
    )[:20]
    top_ridership_codes = {station.station_code for station in top_ridership}

    label_tiers: dict[str, str] = {}
    for station in stations:
        major = (
            station.station_code in forced_major_codes
            or station.station_code in top_ridership_codes
            or len(station.lines) >= 5
            or (station.ridership_daily >= 350_000 and len(station.lines) >= 3)
        )
        label_tiers[station.station_code] = "major" if major else "minor"

    return label_tiers


def generated_summary(station: OfficialStationGroup) -> str:
    if station.ridership_daily >= 800_000:
        return "真实客流高，属于东京核心换乘站。"
    if station.ridership_daily >= 250_000:
        return "官方车站主表已接入，属于东京核心通勤带里的高频站点。"
    return "官方车站主表已接入，当前以坐标和客流底座为主。"


def build_generated_stations(
    stations: list[OfficialStationGroup],
    seed_matches: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    heat_scores = calculate_heat_scores(stations)
    label_tiers = build_label_tiers(stations, seed_matches)

    generated: list[dict[str, Any]] = []
    for station in stations:
        seed = seed_matches.get(station.station_code)
        metrics_seed = seed.get("metrics", {}) if seed else {}
        coverage = {
            "price": bool(seed),
            "land": bool(seed),
            "ridership": station.ridership_covered,
            "schools": bool(seed),
            "population": bool(seed),
            "hazard": bool(seed),
        }

        note_prefix = (
            f"官方车站/客流来源：{N02_DATASET['id']} + {S12_DATASET['id']}（{S12_DATASET['latest_year']}）。"
        )
        if seed:
            note = f"{note_prefix} 房价、地价、学校和灾害暂时仍沿用当前种子覆盖层。"
        else:
            note = f"{note_prefix} 价格、地价、学校和灾害尚未覆盖到该站。"

        generated.append(
            {
                "id": seed["id"] if seed else slugify_station_id(station.name_ja, station.station_code),
                "name": seed["name"] if seed else station.name_ja,
                "nameJa": station.name_ja,
                "nameEn": seed["nameEn"] if seed else "",
                "lat": round(station.lat, 6),
                "lng": round(station.lng, 6),
                "operator": " / ".join(station.operators),
                "lines": station.lines,
                "ward": seed["ward"] if seed else "",
                "labelTier": seed["labelTier"] if seed else label_tiers[station.station_code],
                "summary": seed["summary"] if seed else generated_summary(station),
                "metrics": {
                    "district": metrics_seed.get("district") or station.name_ja,
                    "medianPriceMJPY": metrics_seed.get("medianPriceMJPY", 0),
                    "medianPriceManPerSqm": metrics_seed.get("medianPriceManPerSqm", 0),
                    "landValueManPerSqm": metrics_seed.get("landValueManPerSqm", 0),
                    "ridershipDaily": station.ridership_daily,
                    "heatScore": heat_scores[station.station_code],
                    "transferLines": len(station.lines),
                    "schoolsNearby": metrics_seed.get("schoolsNearby", 0),
                    "populationTrend": metrics_seed.get("populationTrend", "待补"),
                    "hazard": metrics_seed.get(
                        "hazard",
                        {
                            "flood": "unknown",
                            "liquefaction": "unknown",
                            "landslide": "unknown",
                        },
                    ),
                    "coverage": coverage,
                    "note": metrics_seed.get("note") or note,
                },
            }
        )

    return sorted(
        generated,
        key=lambda station: (
            0 if station["labelTier"] == "minor" else 1,
            station["metrics"]["ridershipDaily"],
            station["nameJa"],
        ),
    )


def build_metadata(stations: list[dict[str, Any]], seed_overrides: list[dict[str, Any]]) -> dict[str, Any]:
    price_covered = sum(1 for station in stations if station["metrics"]["coverage"]["price"])
    ridership_covered = sum(
        1 for station in stations if station["metrics"]["coverage"]["ridership"]
    )
    major_labels = sum(1 for station in stations if station["labelTier"] == "major")

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "stationDataset": N02_DATASET["id"],
        "ridershipDataset": S12_DATASET["id"],
        "ridershipYear": S12_DATASET["latest_year"],
        "bounds": TOKYO_CORE_BOUNDS,
        "stationCount": len(stations),
        "majorLabelCount": major_labels,
        "seedOverrideCount": len(seed_overrides),
        "priceCoverageCount": price_covered,
        "ridershipCoverageCount": ridership_covered,
    }


def main() -> None:
    args = parse_args()
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    n02_zip = CACHE_DIR / f"{N02_DATASET['id']}.zip"
    s12_zip = CACHE_DIR / f"{S12_DATASET['id']}.zip"

    download_if_needed(N02_DATASET["url"], n02_zip, force=args.force_download)
    download_if_needed(S12_DATASET["url"], s12_zip, force=args.force_download)

    n02_geojson = load_geojson_from_zip(n02_zip, N02_DATASET["member"])
    s12_geojson = load_geojson_from_zip(s12_zip, S12_DATASET["member"])
    seed_overrides = load_seed_overrides()

    ridership_by_group = build_ridership_map(s12_geojson["features"])
    official_stations = build_official_station_groups(
        n02_geojson["features"],
        ridership_by_group,
    )
    seed_matches = match_seed_overrides(official_stations, seed_overrides)
    generated_stations = build_generated_stations(official_stations, seed_matches)
    metadata = build_metadata(generated_stations, seed_overrides)

    stations_path = DATA_DIR / "stations.json"
    metadata_path = DATA_DIR / "stations.meta.json"

    stations_path.write_text(
        json.dumps(generated_stations, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    metadata_path.write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(
        json.dumps(
            {
                "stationCount": metadata["stationCount"],
                "majorLabelCount": metadata["majorLabelCount"],
                "priceCoverageCount": metadata["priceCoverageCount"],
                "ridershipCoverageCount": metadata["ridershipCoverageCount"],
                "output": str(stations_path),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
