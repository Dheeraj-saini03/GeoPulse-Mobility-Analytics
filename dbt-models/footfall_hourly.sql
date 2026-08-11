/*
GeoPulse Hourly Footfall Model

Aggregates spatial intersection records into
hourly store-level footfall metrics.

Calculates:
- Total GPS pings
- Unique visitors
- Average distance to store center
- Model update timestamp
*/
WITH raw_intersections AS (
    SELECT
        device_id,
        `timestamp`,
        HOUR(`timestamp`) AS hour_of_day,
        store_id,
        store_name,
        distance_meters
    FROM stg_spatial_intersections
)
SELECT
    store_id,
    store_name,
    hour_of_day,
    COUNT(device_id) AS total_gps_pings,
    COUNT(DISTINCT device_id) AS unique_visitors,
    AVG(distance_meters) AS avg_distance_to_store_center_m,
    CURRENT_TIMESTAMP() AS updated_at
FROM raw_intersections
GROUP BY
    store_id,
    store_name,
    hour_of_day;