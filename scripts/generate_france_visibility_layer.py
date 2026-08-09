#!/usr/bin/env python3
"""Pré-calcule la visibilité du Soleil à 20:19 le 12 août 2026 depuis le relief.

Le modèle altimétrique est Mapzen Terrarium (AWS Open Data, tuiles ~30 m à z12).
La sortie est une image RGBA géoréférencée, transparente hors Val-d'Oise.
"""
from __future__ import annotations

import json
import math
import os
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BOUNDARY = ROOT / "public/data/france-metropolitaine.geojson"
OUT_IMAGE = ROOT / "public/data/visibility-france-2026-08-12.png"
OUT_META = ROOT / "public/data/visibility-france-2026-08-12.json"
CACHE = ROOT / ".cache/terrarium-z10"
ZOOM = 10
GRID_WIDTH = 520
OBSERVATION_UTC = datetime(2026, 8, 12, 18, 19, tzinfo=timezone.utc)


def lonlat_to_pixel(lon: float, lat: float) -> tuple[float, float]:
    n = 2**ZOOM * 256
    x = (lon + 180.0) / 360.0 * n
    lat_r = math.radians(max(-85.0511, min(85.0511, lat)))
    y = (1.0 - math.asinh(math.tan(lat_r)) / math.pi) / 2.0 * n
    return x, y


def tile_array(tx: int, ty: int, memory: dict) -> np.ndarray:
    key = (tx, ty)
    if key in memory:
        return memory[key]
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f"{tx}-{ty}.png"
    if not path.exists():
        url = f"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{ZOOM}/{tx}/{ty}.png"
        with urllib.request.urlopen(url, timeout=30) as response:
            path.write_bytes(response.read())
    rgb = np.asarray(Image.open(path).convert("RGB"), dtype=np.float32)
    elevation = rgb[..., 0] * 256.0 + rgb[..., 1] + rgb[..., 2] / 256.0 - 32768.0
    memory[key] = elevation
    return elevation


def elevation(lon: float, lat: float, memory: dict) -> float:
    x, y = lonlat_to_pixel(lon, lat)
    tx, ty = int(x // 256), int(y // 256)
    px, py = int(x % 256), int(y % 256)
    return float(tile_array(tx, ty, memory)[py, px])


def destination(lat: float, lon: float, distance_km: float, bearing: float) -> tuple[float, float]:
    radius = 6371.0
    d = distance_km / radius
    b = math.radians(bearing)
    p1, l1 = math.radians(lat), math.radians(lon)
    p2 = math.asin(math.sin(p1) * math.cos(d) + math.cos(p1) * math.sin(d) * math.cos(b))
    l2 = l1 + math.atan2(math.sin(b) * math.sin(d) * math.cos(p1), math.cos(d) - math.sin(p1) * math.sin(p2))
    return math.degrees(p2), math.degrees(l2)


def solar_position(lat: float, lon: float) -> tuple[float, float]:
    """Altitude et azimut solaire (degrés, azimut depuis le nord)."""
    unix = OBSERVATION_UTC.timestamp()
    jd = unix / 86400.0 + 2440587.5
    n = jd - 2451545.0
    mean_longitude = math.radians((280.460 + 0.9856474 * n) % 360)
    mean_anomaly = math.radians((357.528 + 0.9856003 * n) % 360)
    ecliptic_longitude = mean_longitude + math.radians(1.915) * math.sin(mean_anomaly) + math.radians(0.020) * math.sin(2 * mean_anomaly)
    obliquity = math.radians(23.439 - 0.0000004 * n)
    right_ascension = math.atan2(math.cos(obliquity) * math.sin(ecliptic_longitude), math.cos(ecliptic_longitude))
    declination = math.asin(math.sin(obliquity) * math.sin(ecliptic_longitude))
    gmst = math.radians((280.46061837 + 360.98564736629 * n) % 360)
    hour_angle = (gmst + math.radians(lon) - right_ascension + math.pi) % (2 * math.pi) - math.pi
    latitude = math.radians(lat)
    altitude = math.asin(math.sin(latitude) * math.sin(declination) + math.cos(latitude) * math.cos(declination) * math.cos(hour_angle))
    azimuth = math.atan2(-math.sin(hour_angle), math.tan(declination) * math.cos(latitude) - math.sin(latitude) * math.cos(hour_angle))
    return math.degrees(altitude), math.degrees(azimuth) % 360


def points_in_polygon(xs: np.ndarray, ys: np.ndarray, ring: np.ndarray) -> np.ndarray:
    inside = np.zeros(xs.shape, dtype=bool)
    xj, yj = ring[-1]
    for xi, yi in ring:
        cross = ((yi > ys) != (yj > ys)) & (xs < (xj - xi) * (ys - yi) / ((yj - yi) + 1e-15) + xi)
        inside ^= cross
        xj, yj = xi, yi
    return inside


def colour(clearance: float) -> tuple[int, int, int, int]:
    if clearance <= 0:
        return 224, 49, 49, 165
    if clearance < 4:
        return 240, 140, 0, 155
    return 47, 158, 68, 140


def main() -> None:
    geojson = json.loads(BOUNDARY.read_text())
    geometry = geojson.get("geometry") or geojson["features"][0]["geometry"]
    polygons = geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [geometry["coordinates"]]
    rings = [np.asarray(polygon[0], dtype=float) for polygon in polygons]
    all_points = np.concatenate(rings)
    west, south = all_points.min(axis=0)
    east, north = all_points.max(axis=0)
    ratio = ((north - south) * 111.32) / ((east - west) * 111.32 * math.cos(math.radians((north + south) / 2)))
    height = max(120, round(GRID_WIDTH * ratio))
    lons = np.linspace(west, east, GRID_WIDTH)
    lats = np.linspace(north, south, height)
    xx, yy = np.meshgrid(lons, lats)
    mask = np.zeros(xx.shape, dtype=bool)
    for ring in rings:
        mask |= points_in_polygon(xx, yy, ring)
    rgba = np.zeros((height, GRID_WIDTH, 4), dtype=np.uint8)
    distances = np.asarray([0.05, 0.1, 0.2, 0.35, 0.5, 0.75, 1, 1.5, 2.5, 4, 7, 10], dtype=float)
    memory: dict = {}

    indices = np.argwhere(mask)
    for count, (row, col) in enumerate(indices, start=1):
        lat, lon = float(yy[row, col]), float(xx[row, col])
        sun_altitude, bearing = solar_position(lat, lon)
        base = elevation(lon, lat, memory) + 1.7
        max_angle = -90.0
        for distance in distances:
            sample_lat, sample_lon = destination(lat, lon, float(distance), bearing)
            sample_elevation = elevation(sample_lon, sample_lat, memory)
            metres = distance * 1000.0
            curvature = metres * metres / (2 * 6371000.0)
            angle = math.degrees(math.atan2(sample_elevation - base - curvature, metres))
            max_angle = max(max_angle, angle)
        clearance = sun_altitude - max(0.0, max_angle)
        rgba[row, col] = colour(clearance)
        if count % 5000 == 0:
            print(f"{count}/{len(indices)} points")

    small = Image.fromarray(rgba, "RGBA")
    large = small.resize((1280, round(1280 * height / GRID_WIDTH)), Image.Resampling.BILINEAR)
    large.save(OUT_IMAGE, optimize=True)
    meta = {
        "bounds": [[float(south), float(west)], [float(north), float(east)]],
        "bearing": "calculé localement pour chaque cellule",
        "sunAltitude": "calculée localement pour chaque cellule",
        "dateTime": "2026-08-12T20:19:00+02:00",
        "source": "Mapzen Terrarium / AWS Open Data",
        "resolution": "MNT Terrarium z10 ; grille nationale ~1 km",
        "scope": "Relief uniquement, horizon 10 km ; Soleil local à 20:19. Météo et obstacles recalculés au clic",
        "thresholds": {"red": "marge <= 0°", "orange": "0° < marge < 4°", "green": "marge >= 4°"}
    }
    OUT_META.write_text(json.dumps(meta, ensure_ascii=False, indent=2))
    print(f"Écrit: {OUT_IMAGE} ({large.size[0]}×{large.size[1]})")


if __name__ == "__main__":
    main()
