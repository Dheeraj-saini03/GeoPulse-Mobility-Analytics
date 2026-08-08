# GeoPulse: Hyper-Local Retail Mobility Analytics

## Overview
GeoPulse is an enterprise-grade geospatial analytics pipeline and interactive dashboard designed to prevent costly retail real estate mistakes. By processing anonymized mobile device GPS pings against store catchment polygons using PySpark/Apache Sedona and dbt on Snowflake, GeoPulse detects dynamic footfall patterns and quantifies store cannibalization risks in real time.

## Architecture
1. **Data Lakehouse (Snowflake / Local Parquet)**: Stores high-volume X/Y coordinate GPS pings with GEOGRAPHY data types.
2. **Spatial Join Processor (`pyspark_spatial_join.py`)**: Distributed spatial indexing (Shapely / Apache Sedona) calculating point-in-polygon intersections for 50,000+ pings and 500-meter store catchment zones.
3. **ELT Data Modeling (`dbt_models/`)**: Aggregates hourly footfall and evaluates cross-store commuter overlap percentage.
4. **Kepler.gl / Web UI Dashboard (`dashboard/index.html`)**: Interactive geospatial visualizer featuring 3D hexbin footfall heatmaps, 24-hour timeline scrubber, and cannibalization risk alerts.

## Quick Start
```bash
# 1. Install dependencies
pip install pandas numpy shapely

# 2. Generate synthetic mobile pings & store polygons
python data_generator.py

# 3. Run PySpark spatial join pipeline
python pyspark_spatial_join.py

# 4. Launch Dashboard
# Open dashboard/index.html in any modern browser or host via local web server
Project Title

GeoPulse: Hyper-Local Retail Mobility Analytics
Project Goal

GeoPulse is a geospatial analytics platform designed to help retail businesses identify the best locations for new stores using anonymized GPS mobility data. The system analyzes customer movement patterns, footfall density, and catchment areas to prevent sales cannibalization between existing and proposed store locations. It enables data-driven location planning through interactive geospatial visualizations and advanced spatial analytics.
GeoPulse processes large-scale anonymized mobile GPS datasets to understand how people move throughout a city. The platform performs spatial joins between GPS coordinates and store catchment areas, aggregates hourly footfall metrics, and visualizes customer movement using interactive maps and heatmaps.

The solution enables business users to:

Analyze customer foot traffic around retail locations.
Identify high-demand areas for opening new stores.
Measure overlap between existing and proposed store locations.
Detect store cannibalization using customer mobility patterns.
Visualize geospatial insights through interactive dashboards.

This project demonstrates the practical use of geospatial analytics, spatial data processing, and business intelligence for strategic retail expansion.

Tech Stack
Programming Language
Python
Data Warehouse
Snowflake
Big Data Processing
Apache Spark (PySpark)
Apache Sedona
Data Transformation
dbt (Data Build Tool)
Geospatial Analytics
Snowflake GEOGRAPHY Data Type
Spatial SQL
Catchment Area Analysis
Spatial Joins
Data Visualization
Kepler.gl
React.js
Data Processing
SQL
ETL / ELT Pipeline
Other Tools
Apache Airflow (Workflow Automation)
Git
GitHub
VS Code

## Data Dictionary

### Raw Mobile GPS Pings

| Field | Description |
|-------|-------------|
| DeviceID | Anonymous mobile device identifier |
| Latitude | GPS latitude |
| Longitude | GPS longitude |
| Timestamp | Time of GPS ping |
| Accuracy | GPS accuracy in meters |

```
