import os
import pandas as pd
import json
from math import radians, cos, sin, asin, sqrt

"""
Calculate the Haversine distance between two
GPS coordinates using Earth's radius.
"""

def haversine_distance(lat1, lon1, lat2, lon2):
    """
    Calculate the great circle distance in meters between two points 
    on the earth (specified in decimal degrees)
    """
    R = 6371000.0  # Earth radius in meters
    lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = sin(dlat / 2)**2 + cos(lat1) * cos(lat2) * sin(dlon / 2)**2
    c = 2 * asin(sqrt(a))
    return R * c

def run_spatial_join(data_dir="data", output_dir="output"):
    os.makedirs(output_dir, exist_ok=True)
    print("Executing PySpark / Spatial Processing Pipeline for GeoPulse...")

    pings_path = os.path.join(data_dir, "raw_mobile_pings.csv")
    stores_path = os.path.join(data_dir, "stores.csv")

    if not os.path.exists(pings_path) or not os.path.exists(stores_path):
        print("Error: Input data missing. Running data generator first...")
        from data_generator import generate_geopulse_data
        generate_geopulse_data(output_dir=data_dir)

    pings_df = pd.read_csv(pings_path)
    stores_df = pd.read_csv(stores_path)

    # Convert timestamp to datetime
    pings_df['timestamp'] = pd.to_datetime(pings_df['timestamp'])
    pings_df['hour'] = pings_df['timestamp'].dt.hour

    matched_records = []

    # Spatial Join: Check intersection of each ping with store 500m catchment areas
    for idx, ping in pings_df.iterrows():
        for _, store in stores_df.iterrows():
            dist_m = haversine_distance(ping['latitude'], ping['longitude'], store['lat'], store['lon'])
            if dist_m <= store['radius_m']:
                matched_records.append({
                    'device_id': ping['device_id'],
                    'timestamp': ping['timestamp'],
                    'hour': ping['hour'],
                    'latitude': ping['latitude'],
                    'longitude': ping['longitude'],
                    'store_id': store['store_id'],
                    'store_name': store['name'],
                    'distance_meters': round(dist_m, 2)
                })

    matched_df = pd.DataFrame(matched_records)
    print("Calculated spatial intersections...")
    matched_df.to_csv(os.path.join(output_dir, "spatial_intersections.csv"), index=False)

    # Hourly Footfall Aggregation
    hourly_footfall = matched_df.groupby(['store_id', 'store_name', 'hour']).agg(
        total_pings=('device_id', 'count'),
        unique_visitors=('device_id', 'nunique')
    ).reset_index()

    hourly_footfall.to_csv(os.path.join(output_dir, "hourly_footfall_metrics.csv"), index=False)

    # Store Cannibalization Analysis (Unique devices visiting multiple stores)
    device_store_matrix = matched_df.groupby('device_id')['store_id'].nunique().reset_index()
    multi_store_devices = device_store_matrix[device_store_matrix['store_id'] > 1]['device_id']

    cannibalization_df = matched_df[matched_df['device_id'].isin(multi_store_devices)]
    
    # Pairwise overlap matrix
    store_pairs = []
    store_ids = stores_df['store_id'].tolist()
    for s1 in store_ids:
        devs_s1 = set(matched_df[matched_df['store_id'] == s1]['device_id'])
        for s2 in store_ids:
            if s1 != s2:
                devs_s2 = set(matched_df[matched_df['store_id'] == s2]['device_id'])
                shared_devs = devs_s1.intersection(devs_s2)
                overlap_pct = (len(shared_devs) / len(devs_s1) * 100) if len(devs_s1) > 0 else 0
                store_pairs.append({
                    'primary_store': s1,
                    'target_store': s2,
                    'shared_visitors': len(shared_devs),
                    'overlap_percentage': round(overlap_pct, 2)
                })

    overlap_df = pd.DataFrame(store_pairs)
    overlap_df.to_csv(os.path.join(output_dir, "cannibalization_matrix.csv"), index=False)

    print(f"Spatial Audit Complete! Found {len(matched_df)} store catchment intersections.")
    print(f"Calculated cannibalization overlap for {len(multi_store_devices)} cross-visiting devices.")

if __name__ == "__main__":
    run_spatial_join()
