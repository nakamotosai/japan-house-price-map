#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import csv
import io
import json
import math
import os
import statistics
import subprocess
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
import zipfile
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "public" / "data" / "tokyo"
CACHE_DIR = PROJECT_ROOT / ".cache" / "phase5-core-layers"

TOKYO_CORE_BOUNDS = {
    "west": 139.52,
    "east": 139.95,
    "south": 35.55,
    "north": 35.82,
}

TRANSACTION_API_BASE = "https://www.reinfolib.mlit.go.jp/in-api"
TRANSACTION_CSV_API = (
    f"{TRANSACTION_API_BASE}/api-aur/aur/csv/transactionPrices"
)
TRANSACTION_QUERY = {
    "areaCondition": "address",
    "prefecture": "13",
    "transactionPrice": "true",
    "kind": "residential",
    "seasonFrom": "20241",
    "seasonTo": "20244",
    "language": "ja",
}
TRANSACTION_STATION_MAX_MINUTES = 15
TRANSACTION_MIN_SAMPLE_COUNT = 5
TRANSACTION_SUMMARY_PATH = DATA_DIR / "price-summary.json"
TRANSACTION_CACHE_PATH = CACHE_DIR / "reinfolib-transaction-tokyo-2024.json"
TRANSACTION_CITY_CACHE_DIR = CACHE_DIR / "transaction-city-rows"

DATASETS = {
    "municipalities": {
        "url": "https://nlftp.mlit.go.jp/ksj/gml/data/N03/N03-2023/N03-20230101_13_GML.zip",
        "cache": CACHE_DIR / "N03-2023.zip",
        "member_suffix": "N03-23_13_230101.geojson",
    },
    "land": {
        "url": "https://nlftp.mlit.go.jp/ksj/gml/data/L01/L01-25/L01-25_13_GML.zip",
        "cache": CACHE_DIR / "L01-25_13.zip",
        "member_suffix": "L01-25_13.geojson",
    },
    "schools": {
        "url": "https://nlftp.mlit.go.jp/ksj/gml/data/P29/P29-23/P29-23_13_GML.zip",
        "cache": CACHE_DIR / "P29-23_13.zip",
        "member_suffix": "P29-23_13.geojson",
    },
    "medical": {
        "url": "https://nlftp.mlit.go.jp/ksj/gml/data/P04/P04-20/P04-20_13_GML.zip",
        "cache": CACHE_DIR / "P04-20_13.zip",
        "member_suffix": "P04-20_13.geojson",
    },
    "public_facilities": {
        "url": "https://nlftp.mlit.go.jp/ksj/gml/data/P05/P05-22/P05-22_13_GML.zip",
        "cache": CACHE_DIR / "P05-22_13.zip",
        "member_suffix": "P05-22_13.geojson",
    },
    "hazard": {
        "url": "https://nlftp.mlit.go.jp/ksj/gml/data/A31a/A31a-24/A31a-24_13_20_GEOJSON.zip",
        "cache": CACHE_DIR / "A31a-24_13_20_GEOJSON.zip",
    },
    "population": {
        "url": "https://nlftp.mlit.go.jp/ksj/gml/data/m500r6/m500r6-24/500m_mesh_2024_13_GEOJSON.zip",
        "cache": CACHE_DIR / "500m_mesh_2024_13_GEOJSON.zip",
        "member_suffix": "500m_mesh_2024_13.geojson",
    },
}

SCHOOL_ASSIGN_DISTANCE_M = 1500
CONVENIENCE_ASSIGN_DISTANCE_M = 1500
LAND_ASSIGN_DISTANCE_M = 1200

WATER_DEPTH_LABELS = {
    1: "0-0.5m",
    2: "0.5-3m",
    3: "3-5m",
    4: "5-10m",
    5: "10-20m",
    6: "20m+",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build Tokyo Phase A data layers from official datasets.",
    )
    parser.add_argument(
        "--force-download",
        action="store_true",
        help="Re-download official source archives and refresh cached transaction pages.",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=3,
        help="Concurrent workers for transaction result pagination.",
    )
    parser.add_argument(
        "--skip-station-master",
        action="store_true",
        help="Reuse the current stations.json instead of rebuilding the official station base first.",
    )
    return parser.parse_args()


def download_if_needed(url: str, target: Path, force: bool = False) -> None:
    if target.exists() and not force:
        return

    target.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url) as response, target.open("wb") as output:
        output.write(response.read())


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def load_geojson_member(zip_path: Path, member_suffix: str) -> dict[str, Any]:
    with zipfile.ZipFile(zip_path) as archive:
        for member in archive.namelist():
            normalized = member.replace("\\", "/")
            if normalized.endswith(member_suffix):
                return json.loads(archive.read(member))
    raise SystemExit(f"missing_member:{zip_path}:{member_suffix}")


def iter_geojson_members(zip_path: Path) -> list[tuple[str, dict[str, Any]]]:
    result: list[tuple[str, dict[str, Any]]] = []
    with zipfile.ZipFile(zip_path) as archive:
        for member in archive.namelist():
            if member.endswith(".geojson"):
                result.append((member, json.loads(archive.read(member))))
    return result


def run_station_master(force_download: bool) -> None:
    command = [sys.executable, str(PROJECT_ROOT / "scripts" / "build_tokyo_station_master.py")]
    if force_download:
        command.append("--force-download")
    subprocess.run(command, cwd=PROJECT_ROOT, check=True)


def normalize_station_name(value: str) -> str:
    normalized = unicodedata.normalize("NFKC", value or "")
    for old, new in [
        ("駅", ""),
        ("ヶ", "ケ"),
        ("ヵ", "カ"),
        ("ノ", "の"),
        ("・", ""),
        (" ", ""),
        ("　", ""),
    ]:
        normalized = normalized.replace(old, new)
    return normalized.strip()


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


def point_in_ring(x: float, y: float, ring: list[list[float]]) -> bool:
    inside = False
    last_index = len(ring) - 1
    for index, (point_x, point_y) in enumerate(ring):
        prev_x, prev_y = ring[last_index]
        intersects = ((point_y > y) != (prev_y > y)) and (
            x < (prev_x - point_x) * (y - point_y) / ((prev_y - point_y) or 1e-12) + point_x
        )
        if intersects:
            inside = not inside
        last_index = index
    return inside


def point_in_polygon(x: float, y: float, coordinates: list[list[list[float]]]) -> bool:
    if not point_in_ring(x, y, coordinates[0]):
        return False
    for hole in coordinates[1:]:
        if point_in_ring(x, y, hole):
            return False
    return True


def point_in_geometry(
    lng: float,
    lat: float,
    geometry: dict[str, Any],
) -> bool:
    geometry_type = geometry["type"]
    if geometry_type == "Polygon":
        return point_in_polygon(lng, lat, geometry["coordinates"])
    if geometry_type == "MultiPolygon":
        return any(point_in_polygon(lng, lat, polygon) for polygon in geometry["coordinates"])
    return False


def geometry_bbox(geometry: dict[str, Any]) -> tuple[float, float, float, float]:
    if geometry["type"] == "Polygon":
        polygons = [geometry["coordinates"]]
    else:
        polygons = geometry["coordinates"]

    min_x = float("inf")
    min_y = float("inf")
    max_x = float("-inf")
    max_y = float("-inf")
    for polygon in polygons:
        for ring in polygon:
            for lng, lat in ring:
                min_x = min(min_x, lng)
                max_x = max(max_x, lng)
                min_y = min(min_y, lat)
                max_y = max(max_y, lat)
    return min_x, min_y, max_x, max_y


def station_points_in_bbox(
    stations: list[dict[str, Any]],
    bbox: tuple[float, float, float, float],
) -> list[dict[str, Any]]:
    min_x, min_y, max_x, max_y = bbox
    return [
        station
        for station in stations
        if min_x <= station["lng"] <= max_x and min_y <= station["lat"] <= max_y
    ]


def nearest_station(
    stations: list[dict[str, Any]],
    lat: float,
    lng: float,
    max_distance_m: float,
) -> dict[str, Any] | None:
    nearest: dict[str, Any] | None = None
    nearest_distance = max_distance_m
    for station in stations:
        distance = haversine_meters(lat, lng, station["lat"], station["lng"])
        if distance <= nearest_distance:
            nearest = station
            nearest_distance = distance
    return nearest


def infer_school_category(name: str) -> tuple[str, str]:
    if "幼稚園" in name:
        return "kindergarten", "幼稚园"
    if "小学校" in name:
        return "elementary", "小学"
    if "中学校" in name:
        return "junior_high", "中学"
    if "高等学校" in name or "高校" in name:
        return "high_school", "高中"
    if "大学" in name:
        return "university", "大学"
    if "専門学校" in name:
        return "vocational", "专门学校"
    return "other", "其他"


def infer_public_facility_category(name: str) -> tuple[str, str]:
    if "図書館" in name:
        return "library", "图书馆"
    if "区民館" in name or "集会室" in name or "公民館" in name:
        return "community", "社区设施"
    if "スポーツ" in name or "体育" in name:
        return "sports", "体育设施"
    return "public_service", "公共服务"


def price_band_summary(price_mjpy: int) -> str:
    if price_mjpy >= 120:
        return "总价带很高，属于核心高门槛站。"
    if price_mjpy >= 85:
        return "总价带偏高，但仍在东京核心改善盘常见区间。"
    if price_mjpy >= 60:
        return "总价带处在东京中位改善带。"
    return "总价带相对可切入。"


def convenience_band_summary(score: int) -> str:
    if score >= 75:
        return "医疗和公共服务密度都偏强，生活便利度高。"
    if score >= 50:
        return "生活便利度中上，日常功能基本齐。"
    if score >= 25:
        return "便利度有一定支撑，但配套密度不算强。"
    return "便利度偏弱，需要单独核查配套。"


def population_trend_label(change_rate: float | None) -> str:
    if change_rate is None:
        return "待补"
    if change_rate >= 0.05:
        return "增长"
    if change_rate <= -0.08:
        return "收缩"
    return "稳定"


def risk_level_from_depth_rank(rank: int | None) -> str:
    if rank is None:
        return "unknown"
    if rank >= 3:
        return "high"
    if rank >= 2:
        return "medium"
    return "low"


def request_json(url: str, *, key: str | None = None, retries: int = 6) -> dict[str, Any]:
    headers = {
        "Content-Type": "application/json;charset=utf-8",
        "User-Agent": "japan-house-price-map/phase-a-builder",
    }
    if key:
        headers["Ocp-Apim-Subscription-Key"] = key

    for attempt in range(retries):
        request = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return json.loads(response.read())
        except Exception:
            if attempt == retries - 1:
                raise
            time.sleep(0.8 * (attempt + 1))
    raise RuntimeError("unreachable")


def fetch_transaction_summary(
    force_download: bool,
    workers: int,
    city_codes: list[str],
) -> list[dict[str, Any]]:
    if TRANSACTION_SUMMARY_PATH.exists() and not force_download:
        return load_json(TRANSACTION_SUMMARY_PATH)

    subscription_key = os.environ.get("REINFOLIB_SUBSCRIPTION_KEY", "").strip()
    if not subscription_key:
        if TRANSACTION_SUMMARY_PATH.exists():
            return load_json(TRANSACTION_SUMMARY_PATH)
        raise SystemExit(
            "missing_REINFOLIB_SUBSCRIPTION_KEY_for_price_refresh:"
            "set env var or keep existing public/data/tokyo/price-summary.json"
        )

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    if TRANSACTION_CACHE_PATH.exists() and not force_download:
        transaction_records = load_json(TRANSACTION_CACHE_PATH)
    else:
        TRANSACTION_CITY_CACHE_DIR.mkdir(parents=True, exist_ok=True)

        def fetch_city_csv(city_code: str) -> list[dict[str, str]]:
            city_cache_path = TRANSACTION_CITY_CACHE_DIR / f"{city_code}.json"
            if city_cache_path.exists() and not force_download:
                return load_json(city_cache_path)

            params = dict(TRANSACTION_QUERY)
            params["city"] = city_code
            query = urllib.parse.urlencode(params)
            payload = request_json(
                f"{TRANSACTION_CSV_API}?{query}",
                key=subscription_key,
            )
            if not payload.get("isExists") and not payload.get("isBase64Encoded"):
                return []

            if payload.get("isBase64Encoded"):
                archive_bytes = base64.b64decode(payload["body"])
            elif payload.get("url"):
                with urllib.request.urlopen(payload["url"]) as response:
                    archive_bytes = response.read()
            else:
                return []

            archive = zipfile.ZipFile(io.BytesIO(archive_bytes))
            csv_member = next(
                member for member in archive.namelist() if member.lower().endswith(".csv")
            )
            text = archive.read(csv_member).decode("cp932")
            rows = list(csv.DictReader(io.StringIO(text)))
            write_json(city_cache_path, rows)
            return rows

        transaction_records: list[dict[str, Any]] = []
        completed = 0
        with ThreadPoolExecutor(max_workers=max(1, workers)) as executor:
            futures = {
                executor.submit(fetch_city_csv, city_code): city_code for city_code in city_codes
            }
            for future in as_completed(futures):
                transaction_records.extend(future.result())
                completed += 1
                if completed % 10 == 0 or completed == len(city_codes):
                    print(
                        json.dumps(
                            {
                                "priceCityProgress": completed,
                                "priceCityTotal": len(city_codes),
                            },
                            ensure_ascii=False,
                        ),
                        flush=True,
                    )

        write_json(TRANSACTION_CACHE_PATH, transaction_records)

    by_station: dict[str, list[dict[str, float]]] = defaultdict(list)
    for record in transaction_records:
        station_name = normalize_station_name(record.get("最寄駅：名称", ""))
        distance = record.get("最寄駅：距離（分）")
        total_price = record.get("取引価格（総額）")
        area = record.get("面積（㎡）")

        if not station_name or total_price in (None, "", 0) or area in (None, "", 0):
            continue
        if distance in (None, ""):
            continue
        distance_text = str(distance).strip()
        if not distance_text.isdigit():
            continue
        if int(distance_text) > TRANSACTION_STATION_MAX_MINUTES:
            continue
        if area == "2,000㎡以上":
            continue

        total_price_value = float(total_price)
        area_value = float(area)
        by_station[station_name].append(
            {
                "total_price": total_price_value,
                "unit_price_man_per_sqm": total_price_value / area_value / 10_000,
            }
        )

    summary: list[dict[str, Any]] = []
    for station_name, rows in by_station.items():
        if len(rows) < TRANSACTION_MIN_SAMPLE_COUNT:
            continue

        total_prices = [row["total_price"] for row in rows]
        unit_prices = [row["unit_price_man_per_sqm"] for row in rows]
        summary.append(
            {
                "stationNameJa": station_name,
                "sampleCount": len(rows),
                "medianPriceMJPY": round(statistics.median(total_prices) / 1_000_000),
                "medianPriceManPerSqm": round(statistics.median(unit_prices)),
            }
        )

    summary.sort(key=lambda item: (-item["sampleCount"], item["stationNameJa"]))
    write_json(TRANSACTION_SUMMARY_PATH, summary)
    return summary


def load_stations() -> list[dict[str, Any]]:
    return load_json(DATA_DIR / "stations.json")


def build_tokyo_station_set(
    stations: list[dict[str, Any]],
    municipality_features: list[dict[str, Any]],
) -> tuple[set[str], set[str]]:
    tokyo_station_ids: set[str] = set()
    city_codes: set[str] = set()
    for station in stations:
        for feature in municipality_features:
            bbox = geometry_bbox(feature["geometry"])
            if not (bbox[0] <= station["lng"] <= bbox[2] and bbox[1] <= station["lat"] <= bbox[3]):
                continue
            if point_in_geometry(station["lng"], station["lat"], feature["geometry"]):
                station["ward"] = station["ward"] or feature["properties"].get("N03_004", "")
                tokyo_station_ids.add(station["id"])
                if feature["properties"].get("N03_007"):
                    city_codes.add(str(feature["properties"]["N03_007"]))
                break
    return tokyo_station_ids, city_codes


def apply_price_metrics(
    stations: list[dict[str, Any]],
    tokyo_station_ids: set[str],
    price_summary: list[dict[str, Any]],
) -> None:
    by_name = {
        normalize_station_name(station["nameJa"]): station
        for station in stations
    }
    for item in price_summary:
        station = by_name.get(normalize_station_name(item["stationNameJa"]))
        if not station:
            continue
        station["metrics"]["medianPriceMJPY"] = item["medianPriceMJPY"]
        station["metrics"]["medianPriceManPerSqm"] = item["medianPriceManPerSqm"]
        station["metrics"]["priceSampleCount"] = item["sampleCount"]
        station["metrics"]["coverage"]["price"] = True

    for station in stations:
        if station["id"] not in tokyo_station_ids:
            station["metrics"]["coverage"]["price"] = False
            station["metrics"]["priceSampleCount"] = 0
        else:
            station["metrics"].setdefault("priceSampleCount", 0)


def apply_land_metrics(
    stations: list[dict[str, Any]],
    tokyo_station_ids: set[str],
    land_features: list[dict[str, Any]],
) -> None:
    values_by_station: dict[str, list[float]] = defaultdict(list)
    count_by_station: Counter[str] = Counter()
    target_stations = [station for station in stations if station["id"] in tokyo_station_ids]

    for feature in land_features:
        lng, lat = feature["geometry"]["coordinates"]
        station = nearest_station(target_stations, lat, lng, LAND_ASSIGN_DISTANCE_M)
        if not station:
            continue

        values_by_station[station["id"]].append(float(feature["properties"]["L01_008"]) / 10_000)
        count_by_station[station["id"]] += 1

    for station in stations:
        if station["id"] not in tokyo_station_ids:
            station["metrics"]["coverage"]["land"] = False
            station["metrics"]["landSampleCount"] = 0
            continue

        samples = values_by_station.get(station["id"], [])
        station["metrics"]["landSampleCount"] = count_by_station.get(station["id"], 0)
        if not samples:
            station["metrics"]["coverage"]["land"] = False
            continue

        station["metrics"]["landValueManPerSqm"] = round(statistics.median(samples))
        station["metrics"]["coverage"]["land"] = True


def build_school_points(
    stations: list[dict[str, Any]],
    tokyo_station_ids: set[str],
    school_features: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    target_stations = [station for station in stations if station["id"] in tokyo_station_ids]
    counts: Counter[str] = Counter()
    points: list[dict[str, Any]] = []

    for feature in school_features:
        lng, lat = feature["geometry"]["coordinates"]
        station = nearest_station(target_stations, lat, lng, SCHOOL_ASSIGN_DISTANCE_M)
        if not station:
            continue

        name = feature["properties"]["P29_004"]
        category_id, category_label = infer_school_category(name)
        point = {
            "id": feature["properties"]["P29_002"],
            "name": name,
            "categoryId": category_id,
            "categoryLabel": category_label,
            "lat": round(lat, 6),
            "lng": round(lng, 6),
            "stationId": station["id"],
            "note": feature["properties"].get("P29_005", ""),
        }
        points.append(point)
        counts[station["id"]] += 1

    for station in stations:
        station["metrics"]["schoolsNearby"] = counts.get(station["id"], 0)
        station["metrics"]["coverage"]["schools"] = (
            station["id"] in tokyo_station_ids and counts.get(station["id"], 0) > 0
        )

    points.sort(key=lambda item: (item["categoryId"], item["name"]))
    return points


def build_convenience_points(
    stations: list[dict[str, Any]],
    tokyo_station_ids: set[str],
    medical_features: list[dict[str, Any]],
    public_facility_features: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    target_stations = [station for station in stations if station["id"] in tokyo_station_ids]
    medical_counts: Counter[str] = Counter()
    public_counts: Counter[str] = Counter()
    points: list[dict[str, Any]] = []

    for feature in medical_features:
        lng, lat = feature["geometry"]["coordinates"]
        station = nearest_station(target_stations, lat, lng, CONVENIENCE_ASSIGN_DISTANCE_M)
        if not station:
            continue

        point = {
            "id": f"medical-{feature['properties']['P04_001']}-{len(points)}",
            "name": feature["properties"]["P04_002"].strip(),
            "categoryId": "medical",
            "categoryLabel": "医疗",
            "lat": round(lat, 6),
            "lng": round(lng, 6),
            "stationId": station["id"],
            "note": feature["properties"].get("P04_004", ""),
        }
        points.append(point)
        medical_counts[station["id"]] += 1

    for feature in public_facility_features:
        lng, lat = feature["geometry"]["coordinates"]
        station = nearest_station(target_stations, lat, lng, CONVENIENCE_ASSIGN_DISTANCE_M)
        if not station:
            continue

        category_id, category_label = infer_public_facility_category(
            feature["properties"]["P05_003"]
        )
        point = {
            "id": f"public-{feature['properties']['P05_001']}-{len(points)}",
            "name": feature["properties"]["P05_003"],
            "categoryId": category_id,
            "categoryLabel": category_label,
            "lat": round(lat, 6),
            "lng": round(lng, 6),
            "stationId": station["id"],
            "note": feature["properties"].get("P05_004", ""),
        }
        points.append(point)
        public_counts[station["id"]] += 1

    for station in stations:
        school_count = int(station["metrics"].get("schoolsNearby", 0))
        medical_count = int(medical_counts.get(station["id"], 0))
        public_count = int(public_counts.get(station["id"], 0))
        total_count = medical_count + public_count

        station["metrics"]["convenienceNearby"] = total_count
        station["metrics"]["convenienceBreakdown"] = {
            "medical": medical_count,
            "publicService": public_count,
        }

        if station["id"] not in tokyo_station_ids:
            station["metrics"]["coverage"]["convenience"] = False
            station["metrics"]["convenienceScore"] = 0
            continue

        score = min(
            100,
            min(medical_count, 12) * 4 + min(public_count, 8) * 5 + min(school_count, 8) * 3,
        )
        station["metrics"]["convenienceScore"] = int(score)
        station["metrics"]["coverage"]["convenience"] = total_count > 0

    points.sort(key=lambda item: (item["categoryId"], item["name"]))
    return points


def build_population_areas(
    stations: list[dict[str, Any]],
    tokyo_station_ids: set[str],
    population_features: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    areas: list[dict[str, Any]] = []

    for feature in population_features:
        candidate_stations = station_points_in_bbox(stations, geometry_bbox(feature["geometry"]))
        matching_station_ids = [
            station["id"]
            for station in candidate_stations
            if station["id"] in tokyo_station_ids
            and point_in_geometry(station["lng"], station["lat"], feature["geometry"])
        ]

        if not matching_station_ids:
            continue

        population_2020 = float(feature["properties"].get("PTN_2020") or 0)
        population_2040 = float(feature["properties"].get("PTN_2040") or 0)
        change_rate = None
        if population_2020 > 0:
            change_rate = (population_2040 - population_2020) / population_2020

        trend = population_trend_label(change_rate)
        areas.append(
            {
                "id": feature["properties"]["MESH_ID"],
                "name": f"人口mesh {feature['properties']['MESH_ID']}",
                "categoryId": trend,
                "categoryLabel": trend,
                "summary": (
                    f"2020→2040 变化率 {change_rate * 100:.1f}%"
                    if change_rate is not None
                    else "缺少可比人口基数"
                ),
                "stationIds": matching_station_ids,
                "metricValue": round(change_rate * 100, 1) if change_rate is not None else None,
                "metricLabel": "2040较2020",
                "geometry": feature["geometry"],
            }
        )

        for station in stations:
            if station["id"] not in matching_station_ids:
                continue
            station["metrics"]["populationTrend"] = trend
            station["metrics"]["populationChangeRate"] = (
                round(change_rate * 100, 1) if change_rate is not None else None
            )
            station["metrics"]["coverage"]["population"] = True

    for station in stations:
        if station["id"] in tokyo_station_ids and "populationChangeRate" not in station["metrics"]:
            station["metrics"]["populationChangeRate"] = None
            station["metrics"]["coverage"]["population"] = False

    return areas


def build_hazard_areas(
    stations: list[dict[str, Any]],
    tokyo_station_ids: set[str],
    hazard_geojson_members: list[tuple[str, dict[str, Any]]],
) -> list[dict[str, Any]]:
    areas: list[dict[str, Any]] = []

    for _, collection in hazard_geojson_members:
        for feature in collection["features"]:
            depth_rank = feature["properties"].get("A31a_205")
            if depth_rank is None:
                continue

            candidate_stations = station_points_in_bbox(stations, geometry_bbox(feature["geometry"]))
            matching_station_ids = [
                station["id"]
                for station in candidate_stations
                if station["id"] in tokyo_station_ids
                and point_in_geometry(station["lng"], station["lat"], feature["geometry"])
            ]
            if not matching_station_ids:
                continue

            depth_rank_int = int(depth_rank)
            depth_label = WATER_DEPTH_LABELS.get(depth_rank_int, "待补")
            river_name = feature["properties"].get("A31a_202", "洪水风险区")
            areas.append(
                {
                    "id": f"{feature['properties'].get('A31a_201', 'hazard')}-{len(areas)}",
                    "name": f"{river_name} {depth_label}",
                    "categoryId": risk_level_from_depth_rank(depth_rank_int),
                    "categoryLabel": "洪水浸水",
                    "summary": f"想定最大規模浸水深 {depth_label}",
                    "stationIds": matching_station_ids,
                    "metricValue": depth_rank_int,
                    "metricLabel": "浸水深rank",
                    "geometry": feature["geometry"],
                }
            )

            for station in stations:
                if station["id"] not in matching_station_ids:
                    continue
                previous_rank = station["metrics"].get("hazardMaxDepthRank")
                if previous_rank is None or depth_rank_int > previous_rank:
                    station["metrics"]["hazardMaxDepthRank"] = depth_rank_int
                    station["metrics"]["hazard"]["flood"] = risk_level_from_depth_rank(depth_rank_int)
                station["metrics"]["coverage"]["hazard"] = True

    for station in stations:
        if station["id"] in tokyo_station_ids and "hazardMaxDepthRank" not in station["metrics"]:
            station["metrics"]["hazardMaxDepthRank"] = None
            station["metrics"]["hazard"]["flood"] = "low"
            station["metrics"]["coverage"]["hazard"] = True

    return areas


def enrich_station_copy(station: dict[str, Any]) -> None:
    metrics = station["metrics"]
    summary_parts: list[str] = []
    note_parts: list[str] = []

    if metrics["coverage"]["price"]:
        summary_parts.append(price_band_summary(metrics["medianPriceMJPY"]))
        note_parts.append(f"成交价样本 {metrics.get('priceSampleCount', 0)} 条")
    else:
        note_parts.append("成交价未覆盖")

    if metrics["coverage"]["land"]:
        note_parts.append(f"地价样本 {metrics.get('landSampleCount', 0)} 点")
    else:
        note_parts.append("公示地价未覆盖")

    if metrics["coverage"]["convenience"]:
        summary_parts.append(convenience_band_summary(metrics["convenienceScore"]))
        note_parts.append(
            f"医疗 {metrics['convenienceBreakdown']['medical']} / 公共服务 {metrics['convenienceBreakdown']['publicService']}"
        )

    if metrics["coverage"]["population"]:
        note_parts.append(
            f"2040人口较2020 {metrics['populationChangeRate']}%"
            if metrics["populationChangeRate"] is not None
            else "人口趋势已接入"
        )

    if metrics["coverage"]["hazard"]:
        depth_rank = metrics.get("hazardMaxDepthRank")
        if depth_rank is None:
            note_parts.append("当前未落入东京洪水浸水区")
        else:
            note_parts.append(f"洪水浸水深度 {WATER_DEPTH_LABELS.get(depth_rank, '待补')}")

    station["summary"] = " ".join(summary_parts) if summary_parts else "官方车站底座已接入，当前以正式图层聚合结果为主。"
    station["metrics"]["note"] = "；".join(note_parts) + "。"


def build_metadata(
    stations: list[dict[str, Any]],
    schools: list[dict[str, Any]],
    convenience: list[dict[str, Any]],
    hazards: list[dict[str, Any]],
    population: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "stationCount": len(stations),
        "priceCoverageCount": sum(1 for station in stations if station["metrics"]["coverage"]["price"]),
        "landCoverageCount": sum(1 for station in stations if station["metrics"]["coverage"]["land"]),
        "schoolsCoverageCount": sum(1 for station in stations if station["metrics"]["coverage"]["schools"]),
        "convenienceCoverageCount": sum(
            1 for station in stations if station["metrics"]["coverage"]["convenience"]
        ),
        "hazardCoverageCount": sum(1 for station in stations if station["metrics"]["coverage"]["hazard"]),
        "populationCoverageCount": sum(
            1 for station in stations if station["metrics"]["coverage"]["population"]
        ),
        "schoolsPointCount": len(schools),
        "conveniencePointCount": len(convenience),
        "hazardAreaCount": len(hazards),
        "populationAreaCount": len(population),
        "sources": {
            "price": "reinfolib transaction prices 2024 residential",
            "land": "L01-25",
            "schools": "P29-23",
            "convenience": ["P04-20", "P05-22"],
            "hazard": "A31a-24_13_20",
            "population": "500m_mesh_2024_13",
        },
    }


def main() -> None:
    args = parse_args()
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    if not args.skip_station_master:
        run_station_master(force_download=args.force_download)

    for dataset in DATASETS.values():
        download_if_needed(dataset["url"], dataset["cache"], force=args.force_download)

    stations = load_stations()
    municipality_geojson = load_geojson_member(
        DATASETS["municipalities"]["cache"],
        DATASETS["municipalities"]["member_suffix"],
    )
    tokyo_station_ids, station_city_codes = build_tokyo_station_set(
        stations,
        municipality_geojson["features"],
    )
    city_codes = sorted(station_city_codes)

    price_summary = fetch_transaction_summary(
        force_download=args.force_download,
        workers=args.workers,
        city_codes=city_codes,
    )
    apply_price_metrics(stations, tokyo_station_ids, price_summary)

    land_geojson = load_geojson_member(
        DATASETS["land"]["cache"],
        DATASETS["land"]["member_suffix"],
    )
    apply_land_metrics(stations, tokyo_station_ids, land_geojson["features"])

    school_geojson = load_geojson_member(
        DATASETS["schools"]["cache"],
        DATASETS["schools"]["member_suffix"],
    )
    schools = build_school_points(stations, tokyo_station_ids, school_geojson["features"])

    medical_geojson = load_geojson_member(
        DATASETS["medical"]["cache"],
        DATASETS["medical"]["member_suffix"],
    )
    public_facility_geojson = load_geojson_member(
        DATASETS["public_facilities"]["cache"],
        DATASETS["public_facilities"]["member_suffix"],
    )
    convenience = build_convenience_points(
        stations,
        tokyo_station_ids,
        medical_geojson["features"],
        public_facility_geojson["features"],
    )

    population_geojson = load_geojson_member(
        DATASETS["population"]["cache"],
        DATASETS["population"]["member_suffix"],
    )
    population = build_population_areas(
        stations,
        tokyo_station_ids,
        population_geojson["features"],
    )

    hazard = build_hazard_areas(
        stations,
        tokyo_station_ids,
        iter_geojson_members(DATASETS["hazard"]["cache"]),
    )

    for station in stations:
        enrich_station_copy(station)

    metadata = build_metadata(stations, schools, convenience, hazard, population)

    write_json(DATA_DIR / "stations.json", stations)
    write_json(DATA_DIR / "stations.meta.json", metadata)
    write_json(DATA_DIR / "schools.json", schools)
    write_json(DATA_DIR / "convenience.json", convenience)
    write_json(DATA_DIR / "hazards.json", hazard)
    write_json(DATA_DIR / "population.json", population)

    print(
        json.dumps(
            {
                "stationCount": metadata["stationCount"],
                "priceCoverageCount": metadata["priceCoverageCount"],
                "landCoverageCount": metadata["landCoverageCount"],
                "schoolsPointCount": metadata["schoolsPointCount"],
                "conveniencePointCount": metadata["conveniencePointCount"],
                "hazardAreaCount": metadata["hazardAreaCount"],
                "populationAreaCount": metadata["populationAreaCount"],
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
