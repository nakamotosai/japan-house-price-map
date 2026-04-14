#!/usr/bin/env python3
from __future__ import annotations

import argparse
import base64
import csv
import io
import json
import math
import os
import shutil
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
RUNTIME_DIR = DATA_DIR / "runtime"
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
    "landslide": {
        "url": "https://nlftp.mlit.go.jp/ksj/gml/data/A33/A33-24/A33-24_13_GEOJSON.zip",
        "cache": CACHE_DIR / "A33-24_13_GEOJSON.zip",
    },
    "liquefaction": {
        "url": "https://www.opendata.metro.tokyo.lg.jp/soumu/9_ekijyouka250m_tosinnnannbutyokka.csv",
        "cache": CACHE_DIR / "tokyo-liquefaction-250m.csv",
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
LANDSLIDE_ASSIGN_DISTANCE_M = 75

WATER_DEPTH_LABELS = {
    1: "0-0.5m",
    2: "0.5-3m",
    3: "3-5m",
    4: "5-10m",
    5: "10-20m",
    6: "20m+",
}

RUNTIME_POINT_DETAIL_CHUNK_LON = 0.035
RUNTIME_POINT_DETAIL_CHUNK_LAT = 0.025
RUNTIME_POINT_SUMMARY_CHUNK_LON = 0.22
RUNTIME_POINT_SUMMARY_CHUNK_LAT = 0.14
RUNTIME_POINT_OVERVIEW_CHUNK_LON = 0.11
RUNTIME_POINT_OVERVIEW_CHUNK_LAT = 0.08
POINT_SUMMARY_AGG_LON = 0.14
POINT_SUMMARY_AGG_LAT = 0.1
POINT_OVERVIEW_AGG_LON = 0.05
POINT_OVERVIEW_AGG_LAT = 0.04
RUNTIME_AREA_SUMMARY_CHUNK_LON = 0.15
RUNTIME_AREA_SUMMARY_CHUNK_LAT = 0.1
RUNTIME_AREA_OVERVIEW_CHUNK_LON = 0.07
RUNTIME_AREA_OVERVIEW_CHUNK_LAT = 0.05
AREA_DETAIL_ZOOM_THRESHOLD = 12.3
POINT_DETAIL_ZOOM_THRESHOLD = 12.8
POINT_SUMMARY_ZOOM_THRESHOLD = 11.9
AREA_SUMMARY_ZOOM_THRESHOLD = 11.8
LIQUEFACTION_MESH_LON_STEP = 0.003125
LIQUEFACTION_MESH_LAT_STEP = 0.002083333


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


def load_csv_rows(path: Path, *, encoding: str = "utf-8-sig") -> list[dict[str, str]]:
    with path.open("r", encoding=encoding, newline="") as handle:
        return list(csv.DictReader(handle))


def write_json(path: Path, payload: Any, *, indent: int | None = 2) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if indent is None:
        text = json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n"
    else:
        text = json.dumps(payload, ensure_ascii=False, indent=indent) + "\n"
    path.write_text(
        text,
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


def expand_bbox_by_meters(
    bbox: tuple[float, float, float, float],
    padding_m: float,
) -> tuple[float, float, float, float]:
    min_x, min_y, max_x, max_y = bbox
    center_lat = (min_y + max_y) / 2
    lat_padding = padding_m / 111_000
    lng_padding = padding_m / (111_000 * max(math.cos(math.radians(center_lat)), 0.01))
    return (
        min_x - lng_padding,
        min_y - lat_padding,
        max_x + lng_padding,
        max_y + lat_padding,
    )


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


def point_to_segment_distance_m(
    lng: float,
    lat: float,
    start_lng: float,
    start_lat: float,
    end_lng: float,
    end_lat: float,
) -> float:
    reference_lat = math.radians((lat + start_lat + end_lat) / 3)
    scale_x = 111_000 * max(math.cos(reference_lat), 0.01)
    scale_y = 111_000

    point_x = lng * scale_x
    point_y = lat * scale_y
    start_x = start_lng * scale_x
    start_y = start_lat * scale_y
    end_x = end_lng * scale_x
    end_y = end_lat * scale_y

    segment_x = end_x - start_x
    segment_y = end_y - start_y
    segment_length_squared = segment_x**2 + segment_y**2

    if segment_length_squared == 0:
        return math.hypot(point_x - start_x, point_y - start_y)

    projection = (
        (point_x - start_x) * segment_x + (point_y - start_y) * segment_y
    ) / segment_length_squared
    projection = max(0.0, min(1.0, projection))

    nearest_x = start_x + projection * segment_x
    nearest_y = start_y + projection * segment_y
    return math.hypot(point_x - nearest_x, point_y - nearest_y)


def point_to_polygon_distance_m(
    lng: float,
    lat: float,
    coordinates: list[list[list[float]]],
) -> float:
    if point_in_polygon(lng, lat, coordinates):
        return 0.0

    best_distance = float("inf")
    for ring in coordinates:
        ring_segments = zip(ring, ring[1:] + ring[:1])
        for (start_lng, start_lat), (end_lng, end_lat) in ring_segments:
            best_distance = min(
                best_distance,
                point_to_segment_distance_m(
                    lng,
                    lat,
                    start_lng,
                    start_lat,
                    end_lng,
                    end_lat,
                ),
            )
    return best_distance


def point_to_geometry_distance_m(
    lng: float,
    lat: float,
    geometry: dict[str, Any],
) -> float:
    geometry_type = geometry["type"]
    if geometry_type == "Polygon":
        return point_to_polygon_distance_m(lng, lat, geometry["coordinates"])
    if geometry_type == "MultiPolygon":
        return min(
            point_to_polygon_distance_m(lng, lat, polygon)
            for polygon in geometry["coordinates"]
        )
    return float("inf")


def matching_station_ids_for_geometry(
    stations: list[dict[str, Any]],
    tokyo_station_ids: set[str],
    geometry: dict[str, Any],
    *,
    fallback_distance_m: float | None = None,
) -> list[str]:
    bbox = geometry_bbox(geometry)
    candidate_bbox = (
        expand_bbox_by_meters(bbox, fallback_distance_m)
        if fallback_distance_m
        else bbox
    )
    candidate_stations = [
        station
        for station in station_points_in_bbox(stations, candidate_bbox)
        if station["id"] in tokyo_station_ids
    ]

    matching_station_ids = [
        station["id"]
        for station in candidate_stations
        if point_in_geometry(station["lng"], station["lat"], geometry)
    ]
    if matching_station_ids or fallback_distance_m is None:
        return matching_station_ids

    nearest_station_id: str | None = None
    nearest_distance = fallback_distance_m
    for station in candidate_stations:
        distance = point_to_geometry_distance_m(
            station["lng"],
            station["lat"],
            geometry,
        )
        if distance <= nearest_distance:
            nearest_station_id = station["id"]
            nearest_distance = distance

    return [nearest_station_id] if nearest_station_id else []


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


def risk_level_from_liquefaction_pl(value: float) -> str:
    if value >= 15:
        return "high"
    if value >= 5:
        return "medium"
    return "low"


def higher_risk_level(left: str, right: str) -> str:
    order = {"unknown": 0, "low": 1, "medium": 2, "high": 3}
    return left if order.get(left, 0) >= order.get(right, 0) else right


def rectangle_geometry(
    lng: float,
    lat: float,
    *,
    half_width: float,
    half_height: float,
) -> dict[str, Any]:
    return {
        "type": "Polygon",
        "coordinates": [
            [
                [round(lng - half_width, 6), round(lat - half_height, 6)],
                [round(lng + half_width, 6), round(lat - half_height, 6)],
                [round(lng + half_width, 6), round(lat + half_height, 6)],
                [round(lng - half_width, 6), round(lat + half_height, 6)],
                [round(lng - half_width, 6), round(lat - half_height, 6)],
            ]
        ],
    }


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


def build_flood_hazard_areas(
    stations: list[dict[str, Any]],
    tokyo_station_ids: set[str],
    hazard_geojson_members: list[tuple[str, dict[str, Any]]],
) -> list[dict[str, Any]]:
    areas: list[dict[str, Any]] = []

    for member_name, collection in hazard_geojson_members:
        if "A31a-20-" not in member_name:
            continue
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

    return areas


def build_liquefaction_areas(
    stations: list[dict[str, Any]],
    tokyo_station_ids: set[str],
    liquefaction_rows: list[dict[str, str]],
) -> list[dict[str, Any]]:
    areas: list[dict[str, Any]] = []

    for row in liquefaction_rows:
        lng = float(row["Lon（250mメッシュ中心経度）"])
        lat = float(row["Lat（250mメッシュ中心緯度）"])
        if not (
            TOKYO_CORE_BOUNDS["west"] <= lng <= TOKYO_CORE_BOUNDS["east"]
            and TOKYO_CORE_BOUNDS["south"] <= lat <= TOKYO_CORE_BOUNDS["north"]
        ):
            continue

        pl_value = float(row["Plcorrecte（液状化危険度（PL値））"] or 0)
        if pl_value <= 0:
            continue

        geometry = rectangle_geometry(
            lng,
            lat,
            half_width=LIQUEFACTION_MESH_LON_STEP / 2,
            half_height=LIQUEFACTION_MESH_LAT_STEP / 2,
        )
        matching_station_ids = matching_station_ids_for_geometry(
            stations,
            tokyo_station_ids,
            geometry,
        )
        if not matching_station_ids:
            continue

        risk_level = risk_level_from_liquefaction_pl(pl_value)
        areas.append(
            {
                "id": f"liquefaction-{row['250mメッシュコード']}",
                "name": f"液状化 mesh {row['250mメッシュコード']}",
                "categoryId": risk_level,
                "categoryLabel": "液状化",
                "summary": f"液状化危険度 PL値 {pl_value:.2f}",
                "stationIds": matching_station_ids,
                "metricValue": round(pl_value, 2),
                "metricLabel": "PL值",
                "geometry": geometry,
            }
        )

        for station in stations:
            if station["id"] not in matching_station_ids:
                continue
            station["metrics"]["hazard"]["liquefaction"] = higher_risk_level(
                station["metrics"]["hazard"].get("liquefaction", "low"),
                risk_level,
            )

    return areas


def build_landslide_areas(
    stations: list[dict[str, Any]],
    tokyo_station_ids: set[str],
    landslide_geojson: dict[str, Any],
) -> list[dict[str, Any]]:
    areas: list[dict[str, Any]] = []

    for feature in landslide_geojson["features"]:
        geometry = feature["geometry"]
        matching_station_ids = matching_station_ids_for_geometry(
            stations,
            tokyo_station_ids,
            geometry,
            fallback_distance_m=LANDSLIDE_ASSIGN_DISTANCE_M,
        )
        if not matching_station_ids:
            continue

        is_special_warning = int(feature["properties"].get("A33_008") or 0) > 0
        risk_level = "high" if is_special_warning else "medium"
        area_name = feature["properties"].get("A33_006") or feature["properties"].get("A33_004") or "土砂災害警戒区域"
        areas.append(
            {
                "id": f"landslide-{feature['properties'].get('A33_004', len(areas))}",
                "name": area_name,
                "categoryId": risk_level,
                "categoryLabel": "土砂災害",
                "summary": "土砂災害特別警戒区域" if is_special_warning else "土砂災害警戒区域",
                "stationIds": matching_station_ids,
                "metricValue": 2 if is_special_warning else 1,
                "metricLabel": "警戒等级",
                "geometry": geometry,
            }
        )

        for station in stations:
            if station["id"] not in matching_station_ids:
                continue
            station["metrics"]["hazard"]["landslide"] = higher_risk_level(
                station["metrics"]["hazard"].get("landslide", "low"),
                risk_level,
            )

    return areas


def build_hazard_areas(
    stations: list[dict[str, Any]],
    tokyo_station_ids: set[str],
    hazard_geojson_members: list[tuple[str, dict[str, Any]]],
    landslide_geojson: dict[str, Any],
    liquefaction_rows: list[dict[str, str]],
) -> list[dict[str, Any]]:
    flood_areas = build_flood_hazard_areas(stations, tokyo_station_ids, hazard_geojson_members)
    liquefaction_areas = build_liquefaction_areas(stations, tokyo_station_ids, liquefaction_rows)
    landslide_areas = build_landslide_areas(stations, tokyo_station_ids, landslide_geojson)

    for station in stations:
        if station["id"] not in tokyo_station_ids:
            continue
        station["metrics"]["hazardMaxDepthRank"] = station["metrics"].get("hazardMaxDepthRank")
        station["metrics"]["hazard"]["flood"] = station["metrics"]["hazard"].get("flood", "low")
        station["metrics"]["hazard"]["liquefaction"] = station["metrics"]["hazard"].get("liquefaction", "low")
        station["metrics"]["hazard"]["landslide"] = station["metrics"]["hazard"].get("landslide", "low")
        station["metrics"]["coverage"]["hazard"] = True

    return flood_areas + liquefaction_areas + landslide_areas


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
        if metrics["hazard"].get("liquefaction") in {"medium", "high"}:
            note_parts.append(f"液状化风险 {metrics['hazard']['liquefaction']}")
        if metrics["hazard"].get("landslide") in {"medium", "high"}:
            note_parts.append(f"土砂风险 {metrics['hazard']['landslide']}")

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
            "hazard": "A31a-24_13_20 + 东京液状化250m + A33-24_13",
            "population": "500m_mesh_2024_13",
        },
    }


def to_public_path(path: Path) -> str:
    return "/" + path.relative_to(PROJECT_ROOT / "public").as_posix()


def clamp_int(value: int, lower: int, upper: int) -> int:
    return max(lower, min(upper, value))


def chunk_grid_dimensions(step_lon: float, step_lat: float) -> tuple[int, int]:
    cols = math.ceil((TOKYO_CORE_BOUNDS["east"] - TOKYO_CORE_BOUNDS["west"]) / step_lon)
    rows = math.ceil((TOKYO_CORE_BOUNDS["north"] - TOKYO_CORE_BOUNDS["south"]) / step_lat)
    return cols, rows


def chunk_bounds_for_key(
    chunk_x: int,
    chunk_y: int,
    *,
    step_lon: float,
    step_lat: float,
) -> dict[str, float]:
    west = TOKYO_CORE_BOUNDS["west"] + chunk_x * step_lon
    south = TOKYO_CORE_BOUNDS["south"] + chunk_y * step_lat
    east = min(TOKYO_CORE_BOUNDS["east"], west + step_lon)
    north = min(TOKYO_CORE_BOUNDS["north"], south + step_lat)
    return {
        "west": round(west, 6),
        "south": round(south, 6),
        "east": round(east, 6),
        "north": round(north, 6),
    }


def bounds_intersect(left: dict[str, float], right: dict[str, float]) -> bool:
    return not (
        left["east"] < right["west"]
        or left["west"] > right["east"]
        or left["north"] < right["south"]
        or left["south"] > right["north"]
    )


def point_chunk_key(lng: float, lat: float, *, step_lon: float, step_lat: float) -> tuple[int, int]:
    cols, rows = chunk_grid_dimensions(step_lon, step_lat)
    chunk_x = clamp_int(
        int((lng - TOKYO_CORE_BOUNDS["west"]) / step_lon),
        0,
        cols - 1,
    )
    chunk_y = clamp_int(
        int((lat - TOKYO_CORE_BOUNDS["south"]) / step_lat),
        0,
        rows - 1,
    )
    return chunk_x, chunk_y


def mean_point_coordinates(points: list[dict[str, Any]]) -> tuple[float, float]:
    lng = sum(float(point["lng"]) for point in points) / len(points)
    lat = sum(float(point["lat"]) for point in points) / len(points)
    return lat, lng


def build_point_overview_features(
    points: list[dict[str, Any]],
    *,
    mode_id: str,
    level: str,
    agg_lon: float,
    agg_lat: float,
) -> list[dict[str, Any]]:
    grouped: dict[tuple[int, int], list[dict[str, Any]]] = defaultdict(list)
    for point in points:
        grouped[
            point_chunk_key(
                point["lng"],
                point["lat"],
                step_lon=agg_lon,
                step_lat=agg_lat,
            )
        ].append(point)

    label_base = "学校" if mode_id == "schools" else "设施"
    overview_points: list[dict[str, Any]] = []

    for chunk_key, members in sorted(grouped.items()):
        chunk_x, chunk_y = chunk_key
        lat, lng = mean_point_coordinates(members)
        category_counts = Counter(member["categoryLabel"] for member in members)
        dominant_category_id, dominant_category_count = Counter(
            member["categoryId"] for member in members
        ).most_common(1)[0]
        dominant_category_label = next(
            member["categoryLabel"]
            for member in members
            if member["categoryId"] == dominant_category_id
        )
        top_categories = category_counts.most_common(2)
        category_summary = " / ".join(
            f"{label} {count}" for label, count in top_categories
        )

        overview_points.append(
            {
                "id": f"{mode_id}-{level}-{chunk_x:02d}-{chunk_y:02d}",
                "name": f"{len(members)} 个{label_base}聚合",
                "categoryId": dominant_category_id,
                "categoryLabel": dominant_category_label,
                "lat": round(lat, 6),
                "lng": round(lng, 6),
                "stationId": None,
                "note": (
                    f"默认视口摘要层：{category_summary}"
                    if level == "summary"
                    else f"低缩放总览层：{category_summary}"
                ),
                "count": len(members),
                "level": level,
            }
        )

    return overview_points


def point_runtime_copy(point: dict[str, Any], *, level: str) -> dict[str, Any]:
    return {
        **point,
        "count": int(point.get("count", 1)),
        "level": level,
    }


def geometry_point_count(geometry: dict[str, Any]) -> int:
    geometry_type = geometry["type"]
    if geometry_type == "Polygon":
        return sum(len(ring) for ring in geometry["coordinates"])
    if geometry_type == "MultiPolygon":
        return sum(len(ring) for polygon in geometry["coordinates"] for ring in polygon)
    return 0


def squared_distance(point_a: list[float], point_b: list[float]) -> float:
    delta_x = point_a[0] - point_b[0]
    delta_y = point_a[1] - point_b[1]
    return delta_x * delta_x + delta_y * delta_y


def perpendicular_distance(
    point: list[float],
    line_start: list[float],
    line_end: list[float],
) -> float:
    if line_start == line_end:
        return math.sqrt(squared_distance(point, line_start))

    x0, y0 = point
    x1, y1 = line_start
    x2, y2 = line_end

    numerator = abs((y2 - y1) * x0 - (x2 - x1) * y0 + x2 * y1 - y2 * x1)
    denominator = math.sqrt((y2 - y1) ** 2 + (x2 - x1) ** 2)
    return numerator / (denominator or 1e-12)


def rdp_simplify(points: list[list[float]], tolerance: float) -> list[list[float]]:
    if len(points) <= 2:
        return points[:]

    max_distance = -1.0
    split_index = 0
    for index in range(1, len(points) - 1):
        distance = perpendicular_distance(points[index], points[0], points[-1])
        if distance > max_distance:
            max_distance = distance
            split_index = index

    if max_distance <= tolerance:
        return [points[0], points[-1]]

    left = rdp_simplify(points[: split_index + 1], tolerance)
    right = rdp_simplify(points[split_index:], tolerance)
    return left[:-1] + right


def simplify_ring(ring: list[list[float]], tolerance: float, digits: int) -> list[list[float]]:
    if len(ring) <= 4:
        return [
            [round(point[0], digits), round(point[1], digits)]
            for point in ring
        ]

    core_points = ring[:-1] if ring[0] == ring[-1] else ring[:]
    simplified = rdp_simplify(core_points, tolerance)
    if len(simplified) < 3:
        simplified = core_points[:3]

    simplified = [
        [round(point[0], digits), round(point[1], digits)]
        for point in simplified
    ]
    if simplified[0] != simplified[-1]:
        simplified.append(simplified[0])

    while len(simplified) < 4:
        simplified.insert(-1, simplified[-2])

    return simplified


def simplify_geometry(
    geometry: dict[str, Any],
    *,
    tolerance: float,
    digits: int,
) -> dict[str, Any]:
    geometry_type = geometry["type"]
    if geometry_type == "Polygon":
        return {
            "type": "Polygon",
            "coordinates": [
                simplify_ring(ring, tolerance, digits) for ring in geometry["coordinates"]
            ],
        }
    if geometry_type == "MultiPolygon":
        return {
            "type": "MultiPolygon",
            "coordinates": [
                [simplify_ring(ring, tolerance, digits) for ring in polygon]
                for polygon in geometry["coordinates"]
            ],
        }
    return geometry


def station_base_copy(station: dict[str, Any]) -> dict[str, Any]:
    metrics = station["metrics"]
    return {
        "id": station["id"],
        "name": station["name"],
        "nameJa": station["nameJa"],
        "nameEn": station["nameEn"],
        "lat": station["lat"],
        "lng": station["lng"],
        "operator": station["operator"],
        "lines": station["lines"],
        "ward": station["ward"],
        "labelTier": station["labelTier"],
        "metrics": {
            "district": metrics.get("district", ""),
            "medianPriceMJPY": metrics.get("medianPriceMJPY", 0),
            "medianPriceManPerSqm": metrics.get("medianPriceManPerSqm", 0),
            "landValueManPerSqm": metrics.get("landValueManPerSqm", 0),
            "ridershipDaily": metrics.get("ridershipDaily", 0),
            "heatScore": metrics.get("heatScore", 0),
            "transferLines": metrics.get("transferLines", 1),
            "schoolsNearby": metrics.get("schoolsNearby", 0),
            "convenienceScore": metrics.get("convenienceScore", 0),
            "populationTrend": metrics.get("populationTrend", "待补"),
            "hazardMaxDepthRank": metrics.get("hazardMaxDepthRank"),
            "hazard": metrics.get(
                "hazard",
                {
                    "flood": "unknown",
                    "liquefaction": "unknown",
                    "landslide": "unknown",
                },
            ),
            "coverage": metrics.get(
                "coverage",
                {
                    "price": False,
                    "land": False,
                    "ridership": False,
                    "schools": False,
                    "convenience": False,
                    "population": False,
                    "hazard": False,
                },
            ),
        },
    }


def build_station_runtime_payloads(stations: list[dict[str, Any]]) -> dict[str, Any]:
    station_bases = [station_base_copy(station) for station in stations]
    station_bases.sort(key=lambda item: item["name"])

    shard_size = 40
    detail_shards: list[dict[str, Any]] = []
    station_to_shard: dict[str, str] = {}
    sorted_stations = sorted(stations, key=lambda item: item["id"])
    for index in range(0, len(sorted_stations), shard_size):
        shard_stations = sorted_stations[index : index + shard_size]
        shard_id = f"shard-{index // shard_size:02d}"
        detail_map = {
            station["id"]: station
            for station in shard_stations
        }
        detail_shards.append(
            {
                "id": shard_id,
                "path": f"stations/details/{shard_id}.json",
                "payload": detail_map,
                "stationCount": len(shard_stations),
            }
        )
        for station in shard_stations:
            station_to_shard[station["id"]] = shard_id

    manifest = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "shardCount": len(detail_shards),
        "stationToShard": station_to_shard,
        "shards": [
            {
                "id": shard["id"],
                "path": f"/data/tokyo/runtime/{shard['path']}",
                "stationCount": shard["stationCount"],
            }
            for shard in detail_shards
        ],
    }

    return {
        "stationsBase": station_bases,
        "detailsManifest": manifest,
        "detailShards": detail_shards,
    }


def build_point_chunk_manifest(
    points: list[dict[str, Any]],
    *,
    mode_id: str,
    level: str,
    step_lon: float,
    step_lat: float,
) -> dict[str, Any]:
    chunk_map: dict[tuple[int, int], list[dict[str, Any]]] = defaultdict(list)
    for point in points:
        chunk_map[
            point_chunk_key(
                point["lng"],
                point["lat"],
                step_lon=step_lon,
                step_lat=step_lat,
            )
        ].append(point)

    chunks: list[dict[str, Any]] = []
    chunk_dir = RUNTIME_DIR / mode_id / level / "chunks"
    for chunk_key in sorted(chunk_map):
        chunk_x, chunk_y = chunk_key
        chunk_id = f"{chunk_x:02d}-{chunk_y:02d}"
        chunk_path = chunk_dir / f"{chunk_id}.json"
        payload = sorted(
            [point_runtime_copy(item, level=level) for item in chunk_map[chunk_key]],
            key=lambda item: (item["categoryId"], item["name"]),
        )
        write_json(chunk_path, payload, indent=None)
        chunks.append(
            {
                "id": chunk_id,
                "path": to_public_path(chunk_path),
                "bounds": chunk_bounds_for_key(
                    chunk_x,
                    chunk_y,
                    step_lon=step_lon,
                    step_lat=step_lat,
                ),
                "featureCount": len(payload),
            }
        )

    manifest_path = RUNTIME_DIR / mode_id / f"{level}.manifest.json"
    manifest = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "modeId": mode_id,
        "kind": "point",
        "level": level,
        "chunkCount": len(chunks),
        "featureCount": len(points),
        "weightedFeatureCount": sum(int(point.get("count", 1)) for point in points),
        "chunks": chunks,
    }
    write_json(manifest_path, manifest, indent=None)
    return manifest


def build_area_chunk_manifest(
    areas: list[dict[str, Any]],
    *,
    mode_id: str,
    level: str,
    tolerance: float,
    digits: int,
    step_lon: float,
    step_lat: float,
) -> dict[str, Any]:
    chunk_map: dict[tuple[int, int], set[str]] = defaultdict(set)
    cols, rows = chunk_grid_dimensions(step_lon, step_lat)
    simplified_areas: list[dict[str, Any]] = []

    for area in areas:
        area_copy = {
            **area,
            "geometry": simplify_geometry(
                area["geometry"],
                tolerance=tolerance,
                digits=digits,
            ),
            "level": level,
        }
        simplified_areas.append(area_copy)
        min_x, min_y, max_x, max_y = geometry_bbox(area_copy["geometry"])
        chunk_x_start = clamp_int(
            int((min_x - TOKYO_CORE_BOUNDS["west"]) / step_lon),
            0,
            cols - 1,
        )
        chunk_x_end = clamp_int(
            int((max_x - TOKYO_CORE_BOUNDS["west"]) / step_lon),
            0,
            cols - 1,
        )
        chunk_y_start = clamp_int(
            int((min_y - TOKYO_CORE_BOUNDS["south"]) / step_lat),
            0,
            rows - 1,
        )
        chunk_y_end = clamp_int(
            int((max_y - TOKYO_CORE_BOUNDS["south"]) / step_lat),
            0,
            rows - 1,
        )

        for chunk_x in range(chunk_x_start, chunk_x_end + 1):
            for chunk_y in range(chunk_y_start, chunk_y_end + 1):
                chunk_bounds = chunk_bounds_for_key(
                    chunk_x,
                    chunk_y,
                    step_lon=step_lon,
                    step_lat=step_lat,
                )
                area_bounds = {
                    "west": min_x,
                    "south": min_y,
                    "east": max_x,
                    "north": max_y,
                }
                if bounds_intersect(area_bounds, chunk_bounds):
                    chunk_map[(chunk_x, chunk_y)].add(area_copy["id"])

    chunks: list[dict[str, Any]] = []
    chunk_dir = RUNTIME_DIR / mode_id / level / "chunks"
    catalog_path = RUNTIME_DIR / mode_id / f"{level}.catalog.json"
    write_json(
        catalog_path,
        {
            area["id"]: area
            for area in sorted(simplified_areas, key=lambda item: item["id"])
        },
        indent=None,
    )

    for chunk_key in sorted(chunk_map):
        chunk_x, chunk_y = chunk_key
        chunk_id = f"{chunk_x:02d}-{chunk_y:02d}"
        chunk_path = chunk_dir / f"{chunk_id}.json"
        payload = sorted(chunk_map[chunk_key])
        write_json(chunk_path, payload, indent=None)
        chunks.append(
            {
                "id": chunk_id,
                "path": to_public_path(chunk_path),
                "bounds": chunk_bounds_for_key(
                    chunk_x,
                    chunk_y,
                    step_lon=step_lon,
                    step_lat=step_lat,
                ),
                "featureCount": len(payload),
            }
        )

    manifest_path = RUNTIME_DIR / mode_id / f"{level}.manifest.json"
    manifest = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "modeId": mode_id,
        "kind": "area",
        "level": level,
        "chunkCount": len(chunks),
        "featureCount": len(simplified_areas),
        "geometryPointCount": sum(
            geometry_point_count(area["geometry"]) for area in simplified_areas
        ),
        "catalogPath": to_public_path(catalog_path),
        "chunks": chunks,
    }
    write_json(manifest_path, manifest, indent=None)
    return manifest


def write_runtime_payloads(
    stations: list[dict[str, Any]],
    schools: list[dict[str, Any]],
    convenience: list[dict[str, Any]],
    hazards: list[dict[str, Any]],
    population: list[dict[str, Any]],
    metadata: dict[str, Any],
) -> dict[str, Any]:
    if RUNTIME_DIR.exists():
        shutil.rmtree(RUNTIME_DIR)

    station_payloads = build_station_runtime_payloads(stations)
    write_json(RUNTIME_DIR / "stations.base.json", station_payloads["stationsBase"], indent=None)
    write_json(
        RUNTIME_DIR / "stations" / "details" / "manifest.json",
        station_payloads["detailsManifest"],
        indent=None,
    )
    for shard in station_payloads["detailShards"]:
        write_json(RUNTIME_DIR / shard["path"], shard["payload"], indent=None)

    school_summary_points = build_point_overview_features(
        schools,
        mode_id="schools",
        level="summary",
        agg_lon=POINT_SUMMARY_AGG_LON,
        agg_lat=POINT_SUMMARY_AGG_LAT,
    )
    school_overview_points = build_point_overview_features(
        schools,
        mode_id="schools",
        level="overview",
        agg_lon=POINT_OVERVIEW_AGG_LON,
        agg_lat=POINT_OVERVIEW_AGG_LAT,
    )
    convenience_summary_points = build_point_overview_features(
        convenience,
        mode_id="convenience",
        level="summary",
        agg_lon=POINT_SUMMARY_AGG_LON,
        agg_lat=POINT_SUMMARY_AGG_LAT,
    )
    convenience_overview_points = build_point_overview_features(
        convenience,
        mode_id="convenience",
        level="overview",
        agg_lon=POINT_OVERVIEW_AGG_LON,
        agg_lat=POINT_OVERVIEW_AGG_LAT,
    )
    schools_summary_manifest = build_point_chunk_manifest(
        school_summary_points,
        mode_id="schools",
        level="summary",
        step_lon=RUNTIME_POINT_SUMMARY_CHUNK_LON,
        step_lat=RUNTIME_POINT_SUMMARY_CHUNK_LAT,
    )
    schools_overview_manifest = build_point_chunk_manifest(
        school_overview_points,
        mode_id="schools",
        level="overview",
        step_lon=RUNTIME_POINT_OVERVIEW_CHUNK_LON,
        step_lat=RUNTIME_POINT_OVERVIEW_CHUNK_LAT,
    )
    schools_detail_manifest = build_point_chunk_manifest(
        schools,
        mode_id="schools",
        level="detail",
        step_lon=RUNTIME_POINT_DETAIL_CHUNK_LON,
        step_lat=RUNTIME_POINT_DETAIL_CHUNK_LAT,
    )
    convenience_overview_manifest = build_point_chunk_manifest(
        convenience_overview_points,
        mode_id="convenience",
        level="overview",
        step_lon=RUNTIME_POINT_OVERVIEW_CHUNK_LON,
        step_lat=RUNTIME_POINT_OVERVIEW_CHUNK_LAT,
    )
    convenience_summary_manifest = build_point_chunk_manifest(
        convenience_summary_points,
        mode_id="convenience",
        level="summary",
        step_lon=RUNTIME_POINT_SUMMARY_CHUNK_LON,
        step_lat=RUNTIME_POINT_SUMMARY_CHUNK_LAT,
    )
    convenience_detail_manifest = build_point_chunk_manifest(
        convenience,
        mode_id="convenience",
        level="detail",
        step_lon=RUNTIME_POINT_DETAIL_CHUNK_LON,
        step_lat=RUNTIME_POINT_DETAIL_CHUNK_LAT,
    )
    hazard_summary_manifest = build_area_chunk_manifest(
        hazards,
        mode_id="hazard",
        level="summary",
        tolerance=0.00048,
        digits=4,
        step_lon=RUNTIME_AREA_SUMMARY_CHUNK_LON,
        step_lat=RUNTIME_AREA_SUMMARY_CHUNK_LAT,
    )
    hazard_overview_manifest = build_area_chunk_manifest(
        hazards,
        mode_id="hazard",
        level="overview",
        tolerance=0.00022,
        digits=5,
        step_lon=RUNTIME_AREA_OVERVIEW_CHUNK_LON,
        step_lat=RUNTIME_AREA_OVERVIEW_CHUNK_LAT,
    )
    hazard_detail_manifest = build_area_chunk_manifest(
        hazards,
        mode_id="hazard",
        level="detail",
        tolerance=0.00006,
        digits=6,
        step_lon=RUNTIME_AREA_OVERVIEW_CHUNK_LON,
        step_lat=RUNTIME_AREA_OVERVIEW_CHUNK_LAT,
    )
    population_summary_manifest = build_area_chunk_manifest(
        population,
        mode_id="population",
        level="summary",
        tolerance=0.00034,
        digits=4,
        step_lon=RUNTIME_AREA_SUMMARY_CHUNK_LON,
        step_lat=RUNTIME_AREA_SUMMARY_CHUNK_LAT,
    )
    population_overview_manifest = build_area_chunk_manifest(
        population,
        mode_id="population",
        level="overview",
        tolerance=0.00018,
        digits=5,
        step_lon=RUNTIME_AREA_OVERVIEW_CHUNK_LON,
        step_lat=RUNTIME_AREA_OVERVIEW_CHUNK_LAT,
    )
    population_detail_manifest = build_area_chunk_manifest(
        population,
        mode_id="population",
        level="detail",
        tolerance=0.00001,
        digits=6,
        step_lon=RUNTIME_AREA_OVERVIEW_CHUNK_LON,
        step_lat=RUNTIME_AREA_OVERVIEW_CHUNK_LAT,
    )

    runtime_index = {
        "generatedAt": metadata["generatedAt"],
        "stationCount": metadata["stationCount"],
        "stations": {
            "basePath": "/data/tokyo/runtime/stations.base.json",
            "detailsManifestPath": "/data/tokyo/runtime/stations/details/manifest.json",
        },
        "metadataPath": "/data/tokyo/stations.meta.json",
        "modes": {
            "schools": {
                "kind": "point",
                "manifests": [
                    {
                        "path": "/data/tokyo/runtime/schools/summary.manifest.json",
                        "minZoom": 9,
                        "maxZoom": POINT_SUMMARY_ZOOM_THRESHOLD,
                    },
                    {
                        "path": "/data/tokyo/runtime/schools/overview.manifest.json",
                        "minZoom": POINT_SUMMARY_ZOOM_THRESHOLD,
                        "maxZoom": POINT_DETAIL_ZOOM_THRESHOLD,
                    },
                    {
                        "path": "/data/tokyo/runtime/schools/detail.manifest.json",
                        "minZoom": POINT_DETAIL_ZOOM_THRESHOLD,
                        "maxZoom": 16.5,
                    },
                ],
            },
            "convenience": {
                "kind": "point",
                "manifests": [
                    {
                        "path": "/data/tokyo/runtime/convenience/summary.manifest.json",
                        "minZoom": 9,
                        "maxZoom": POINT_SUMMARY_ZOOM_THRESHOLD,
                    },
                    {
                        "path": "/data/tokyo/runtime/convenience/overview.manifest.json",
                        "minZoom": POINT_SUMMARY_ZOOM_THRESHOLD,
                        "maxZoom": POINT_DETAIL_ZOOM_THRESHOLD,
                    },
                    {
                        "path": "/data/tokyo/runtime/convenience/detail.manifest.json",
                        "minZoom": POINT_DETAIL_ZOOM_THRESHOLD,
                        "maxZoom": 16.5,
                    },
                ],
            },
            "hazard": {
                "kind": "area",
                "manifests": [
                    {
                        "path": "/data/tokyo/runtime/hazard/summary.manifest.json",
                        "minZoom": 9,
                        "maxZoom": AREA_SUMMARY_ZOOM_THRESHOLD,
                    },
                    {
                        "path": "/data/tokyo/runtime/hazard/overview.manifest.json",
                        "minZoom": AREA_SUMMARY_ZOOM_THRESHOLD,
                        "maxZoom": AREA_DETAIL_ZOOM_THRESHOLD,
                    },
                    {
                        "path": "/data/tokyo/runtime/hazard/detail.manifest.json",
                        "minZoom": AREA_DETAIL_ZOOM_THRESHOLD,
                        "maxZoom": 16.5,
                    },
                ],
            },
            "population": {
                "kind": "area",
                "manifests": [
                    {
                        "path": "/data/tokyo/runtime/population/summary.manifest.json",
                        "minZoom": 9,
                        "maxZoom": AREA_SUMMARY_ZOOM_THRESHOLD,
                    },
                    {
                        "path": "/data/tokyo/runtime/population/overview.manifest.json",
                        "minZoom": AREA_SUMMARY_ZOOM_THRESHOLD,
                        "maxZoom": AREA_DETAIL_ZOOM_THRESHOLD,
                    },
                    {
                        "path": "/data/tokyo/runtime/population/detail.manifest.json",
                        "minZoom": AREA_DETAIL_ZOOM_THRESHOLD,
                        "maxZoom": 16.5,
                    },
                ],
            },
        },
        "summary": {
            "schoolsSummaryChunks": schools_summary_manifest["chunkCount"],
            "schoolsOverviewChunks": schools_overview_manifest["chunkCount"],
            "schoolsDetailChunks": schools_detail_manifest["chunkCount"],
            "convenienceSummaryChunks": convenience_summary_manifest["chunkCount"],
            "convenienceOverviewChunks": convenience_overview_manifest["chunkCount"],
            "convenienceDetailChunks": convenience_detail_manifest["chunkCount"],
            "hazardSummaryChunks": hazard_summary_manifest["chunkCount"],
            "hazardOverviewChunks": hazard_overview_manifest["chunkCount"],
            "hazardDetailChunks": hazard_detail_manifest["chunkCount"],
            "populationSummaryChunks": population_summary_manifest["chunkCount"],
            "populationOverviewChunks": population_overview_manifest["chunkCount"],
            "populationDetailChunks": population_detail_manifest["chunkCount"],
            "schoolsSummaryFeatures": schools_summary_manifest["featureCount"],
            "schoolsOverviewFeatures": schools_overview_manifest["featureCount"],
            "convenienceSummaryFeatures": convenience_summary_manifest["featureCount"],
            "convenienceOverviewFeatures": convenience_overview_manifest["featureCount"],
            "hazardSummaryGeometryPoints": hazard_summary_manifest["geometryPointCount"],
            "hazardOverviewGeometryPoints": hazard_overview_manifest["geometryPointCount"],
            "hazardDetailGeometryPoints": hazard_detail_manifest["geometryPointCount"],
            "populationSummaryGeometryPoints": population_summary_manifest["geometryPointCount"],
            "populationOverviewGeometryPoints": population_overview_manifest["geometryPointCount"],
        },
    }
    write_json(RUNTIME_DIR / "index.json", runtime_index, indent=None)
    return runtime_index


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
    landslide_geojson = load_geojson_member(
        DATASETS["landslide"]["cache"],
        "A33-24_13Polygon.geojson",
    )
    liquefaction_rows = load_csv_rows(
        DATASETS["liquefaction"]["cache"],
        encoding="cp932",
    )

    hazard = build_hazard_areas(
        stations,
        tokyo_station_ids,
        iter_geojson_members(DATASETS["hazard"]["cache"]),
        landslide_geojson,
        liquefaction_rows,
    )

    for station in stations:
        enrich_station_copy(station)

    metadata = build_metadata(stations, schools, convenience, hazard, population)
    runtime_index = write_runtime_payloads(
        stations,
        schools,
        convenience,
        hazard,
        population,
        metadata,
    )
    metadata["runtime"] = runtime_index["summary"]

    write_json(DATA_DIR / "stations.json", stations)
    write_json(DATA_DIR / "stations.meta.json", metadata)

    for legacy_path in [
        DATA_DIR / "schools.json",
        DATA_DIR / "convenience.json",
        DATA_DIR / "hazards.json",
        DATA_DIR / "population.json",
    ]:
        legacy_path.unlink(missing_ok=True)

    print(
        json.dumps(
            {
                "stationCount": metadata["stationCount"],
                "priceCoverageCount": metadata["priceCoverageCount"],
                "landCoverageCount": metadata["landCoverageCount"],
                "runtimeSummary": metadata["runtime"],
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
