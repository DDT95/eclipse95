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
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BOUNDARY = ROOT / "public/data/france-metropolitaine.geojson"
OUT_IMAGE = ROOT / "public/data/visibility-france-2026-08-12.png"
OUT_META = ROOT / "public/data/visibility-france-2026-08-12.json"
CACHE = ROOT / ".cache/terrarium-z8"
ZOOM = 8
BEARING = 284.0
SUN_ALTITUDE = 7.9
GRID_WIDTH = 250


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


def points_in_polygon(xs: np.ndarray, ys: np.ndarray, ring: np.ndarray) -> np.ndarray:
    inside = np.zeros(xs.shape, dtype=bool)
    xj, yj = ring[-1]
    for xi, yi in ring:
        cross = ((yi > ys) != (yj > ys)) & (xs < (xj - xi) * (ys - yi) / ((yj - yi) + 1e-15) + xi)
        inside ^= cross
        xj, yj = xi, yi
    return inside


def colour(score: float) -> tuple[int, int, int, int]:
    red = np.array([224, 49, 49], dtype=float)
    orange = np.array([240, 140, 0], dtype=float)
    green = np.array([47, 158, 68], dtype=float)
    if score <= 50:
        rgb = red + (orange - red) * (score / 50.0)
    else:
        rgb = orange + (green - orange) * ((score - 50.0) / 50.0)
    return int(rgb[0]), int(rgb[1]), int(rgb[2]), 150


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
    distances = np.geomspace(0.25, 30.0, 22)
    memory: dict = {}

    indices = np.argwhere(mask)
    for count, (row, col) in enumerate(indices, start=1):
        lat, lon = float(yy[row, col]), float(xx[row, col])
        base = elevation(lon, lat, memory) + 1.7
        max_angle = -90.0
        for distance in distances:
            sample_lat, sample_lon = destination(lat, lon, float(distance), BEARING)
            sample_elevation = elevation(sample_lon, sample_lat, memory)
            metres = distance * 1000.0
            curvature = metres * metres / (2 * 6371000.0)
            angle = math.degrees(math.atan2(sample_elevation - base - curvature, metres))
            max_angle = max(max_angle, angle)
        clearance = SUN_ALTITUDE - max(0.0, max_angle)
        score = max(0.0, min(100.0, (clearance + 0.5) / 7.5 * 100.0))
        rgba[row, col] = colour(score)
        if count % 5000 == 0:
            print(f"{count}/{len(indices)} points")

    small = Image.fromarray(rgba, "RGBA")
    large = small.resize((1280, round(1280 * height / GRID_WIDTH)), Image.Resampling.BILINEAR)
    large.save(OUT_IMAGE, optimize=True)
    meta = {
        "bounds": [[float(south), float(west)], [float(north), float(east)]],
        "bearing": BEARING,
        "sunAltitude": SUN_ALTITUDE,
        "dateTime": "2026-08-12T20:19:00+02:00",
        "source": "Mapzen Terrarium / AWS Open Data",
        "resolution": "MNT Terrarium généralisé ; grille nationale ~2–4 km",
        "scope": "Aperçu national du relief uniquement ; analyse plus précise, météo et obstacles recalculés au clic"
    }
    OUT_META.write_text(json.dumps(meta, ensure_ascii=False, indent=2))
    print(f"Écrit: {OUT_IMAGE} ({large.size[0]}×{large.size[1]})")


if __name__ == "__main__":
    main()
