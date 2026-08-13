/*
GeoPulse Cannibalization Analysis Model

Measures visitor overlap between the existing Store A
and candidate Store B.

The model identifies shared visitors and calculates
the cannibalization percentage to determine location risk.
*/

WITH store_visitors AS (
    SELECT 
        device_id,
        store_id,
        store_name,
        MIN(`timestamp`) AS first_seen,
        MAX(`timestamp`) AS last_seen
    FROM stg_spatial_intersections
    GROUP BY 
        device_id,
        store_id,
        store_name
),

store_a_visitors AS (
    SELECT DISTINCT 
        device_id
    FROM store_visitors
    WHERE store_id = 'STORE_001'
),

store_b_visitors AS (
    SELECT DISTINCT 
        device_id
    FROM store_visitors
    WHERE store_id = 'STORE_002'
),

cannibalized_devices AS (
    SELECT 
        a.device_id
    FROM store_a_visitors a
    INNER JOIN store_b_visitors b 
        ON a.device_id = b.device_id
)

SELECT 
    'STORE_001' AS existing_store_id,
    'Coffee Craft - 5th Street (Store A)' AS existing_store_name,

    'STORE_002' AS candidate_store_id,
    'Coffee Craft - Market Street (Store B)' AS candidate_store_name,

    (SELECT COUNT(*) 
     FROM store_a_visitors) AS store_a_total_visitors,

    (SELECT COUNT(*) 
     FROM store_b_visitors) AS store_b_total_visitors,

    (SELECT COUNT(*) 
     FROM cannibalized_devices) AS shared_intercepted_visitors,

    ROUND(
        (
            SELECT COUNT(*) 
            FROM cannibalized_devices
        ) * 100.0 /
        NULLIF(
            (
                SELECT COUNT(*) 
                FROM store_a_visitors
            ), 
            0
        ),
        2
    ) AS cannibalization_overlap_percentage,

    CASE 
        WHEN 
            (
                SELECT COUNT(*) 
                FROM cannibalized_devices
            ) * 1.0 /
            NULLIF(
                (
                    SELECT COUNT(*) 
                    FROM store_a_visitors
                ),
                0
            ) > 0.25
        THEN 'HIGH RISK - CANNIBALIZATION DETECTED (CHANGE LOCATION)'

        ELSE 'LOW RISK - OPTIMAL LOCATION'
    END AS recommendation_status;