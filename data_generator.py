"""
GeoPulse Synthetic GPS Mobility Data Generator

This module generates synthetic GPS mobility data for the GeoPulse
retail site selection project.

It creates:
- Anonymized mobile GPS ping data
- Store location metadata
- Store catchment polygons in GeoJSON format

The generated datasets are used for Snowflake spatial analysis
and Kepler.gl visualization.
"""


import os
import random
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import json

def generate_geopulse_data(output_dir="data", num_devices=5000, num_pings=50000):
    """
        Generate synthetic GPS mobility data for the GeoPulse project.

        Parameters:
            output_dir (str): Directory where generated files are saved.
            num_devices (int): Number of anonymous mobile devices.
            num_pings (int): Total GPS ping records to generate.

        Outputs:
            - raw_mobile_pings.csv
            - stores.csv
            - store_catchments.geojson

        Returns:
            None
    """
    os.makedirs(output_dir, exist_ok=True)
    print(f"Generating synthetic mobility data for GeoPulse in '{output_dir}'...")

    # Define city center (e.g., Downtown Metro Area)
    CENTER_LAT = 37.7749  # San Francisco coordinates as sample metropolitan area
    CENTER_LON = -122.4194

    # 1. Define 5 Key Retail Stores with 500-meter catchment zones
    stores = [
        {"store_id": "STORE_001", "name": "Coffee Craft - 5th Street (Store A)", "lat": 37.7790, "lon": -122.4180, "radius_m": 500},
        {"store_id": "STORE_002", "name": "Coffee Craft - Market Street (Store B - Candidate)", "lat": 37.7815, "lon": -122.4110, "radius_m": 500},
        {"store_id": "STORE_003", "name": "Coffee Craft - Financial District", "lat": 37.7910, "lon": -122.4010, "radius_m": 500},
        {"store_id": "STORE_004", "name": "Coffee Craft - Mission Hub", "lat": 37.7600, "lon": -122.4190, "radius_m": 500},
        {"store_id": "STORE_005", "name": "Coffee Craft - SOMA Square", "lat": 37.7820, "lon": -122.3970, "radius_m": 500},
    ]

    # Export Stores GeoJSON Polygons
    print("Exporting Store GeoJSON Polygons...")

    geojson_features = []
    for store in stores:
        # Approximate 500m radius polygon (roughly 0.0045 degrees lat/lon)
        r = 0.0045
        lat, lon = store["lat"], store["lon"]
        polygon_coords = [
            [lon - r, lat - r],
            [lon + r, lat - r],
            [lon + r, lat + r],
            [lon - r, lat + r],
            [lon - r, lat - r]
        ]
        geojson_features.append({
            "type": "Feature",
            "properties": {
                "store_id": store["store_id"],
                "name": store["name"],
                "radius_m": store["radius_m"]
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [polygon_coords]
            }
        })

    geojson_data = {
        "type": "FeatureCollection",
        "features": geojson_features
    }

    with open(os.path.join(output_dir, "store_catchments.geojson"), "w") as f:
        json.dump(geojson_data, f, indent=2)

    pd.DataFrame(stores).to_csv(os.path.join(output_dir, "stores.csv"), index=False)

    # 2. Generate Anonymized Mobile Device GPS Pings
    device_ids = [f"DEV_{i:05d}" for i in range(1, num_devices + 1)]
    start_time = datetime(2026, 8, 1, 6, 0, 0)  # 6 AM

    pings = []
    # Create commuter corridors where devices travel between store catchment zones (causing potential cannibalization)
    for _ in range(num_pings):
        dev_id = random.choice(device_ids)
        # Time distribution peaking during morning (7-9 AM) and evening (5-7 PM) commute
        hour_offset = random.choices(
            range(18), 
            weights=[1, 2, 8, 12, 10, 5, 4, 4, 5, 6, 8, 11, 9, 4, 3, 2, 1, 1]
        )[0]
        minute_offset = random.randint(0, 59)
        second_offset = random.randint(0, 59)
        ping_time = start_time + timedelta(hours=hour_offset, minutes=minute_offset, seconds=second_offset)

        # Decide if device is near Store A, Store B, or general city
        rand_val = random.random()
        if rand_val < 0.35:
            # Near Store A (5th Street)
            lat = 37.7790 + random.uniform(-0.003, 0.003)
            lon = -122.4180 + random.uniform(-0.003, 0.003)
        elif rand_val < 0.65:
            # Near Store B (Market Street - Intercepting commuter flow)
            lat = 37.7815 + random.uniform(-0.003, 0.003)
            lon = -122.4110 + random.uniform(-0.003, 0.003)
        else:
            # General city traffic
            lat = CENTER_LAT + random.uniform(-0.03, 0.03)
            lon = CENTER_LON + random.uniform(-0.03, 0.03)

        pings.append({
            "device_id": dev_id,
            "latitude": round(lat, 6),
            "longitude": round(lon, 6),
            "timestamp": ping_time.strftime("%Y-%m-%d %H:%M:%S"),
            "horizontal_accuracy_m": round(random.uniform(3.0, 15.0), 1),
            "speed_kmh": round(random.uniform(0.0, 35.0), 1)
        })

    pings_df = pd.DataFrame(pings)
    pings_df.sort_values(by="timestamp", inplace=True)
    pings_df.to_csv(os.path.join(output_dir, "raw_mobile_pings.csv"), index=False)

    print(f"Successfully generated {len(pings_df)} GPS pings and {len(stores)} store polygons!")

if __name__ == "__main__":
    generate_geopulse_data()
