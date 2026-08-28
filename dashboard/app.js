// GeoPulse dashboard now loads real data from ../data and ../output

let map;
let storeMarkers = [];
let storeCircles = [];
let pingMarkers = [];
let trendChart;
let comparisonChart;
let overlapChart;

// UI state
let currentHour = 8;
let selectedStoreId = null;

// Cached datasets
let stores = [];
let storeGeoJSON = null;
let spatialIntersections = [];
let hourlyFootfall = [];
let cannibalization = [];

document.addEventListener("DOMContentLoaded", () => {
    initEmptyMap();
    loadAllData().then(() => {
        renderStoresOnMap();

        const storeSelect = document.getElementById('storeSelect');
        selectedStoreId = storeSelect && storeSelect.value !== 'ALL' ? storeSelect.value : null;
        currentHour = parseInt(document.getElementById('timeSlider').value) || currentHour;

        renderPingsForHour(currentHour);
        initCharts(currentHour, selectedStoreId);
        renderStoreKpis(currentHour, selectedStoreId);
        updateAlertCard(selectedStoreId);
    });
});

function fetchText(path) {
    return fetch(path).then(r => { if (!r.ok) throw new Error(r.statusText); return r.text(); });
}

function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length === 0) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    const rows = lines.slice(1).map(l => {
        const cols = l.split(',');
        const obj = {};
        headers.forEach((h, i) => { obj[h] = cols[i] !== undefined ? cols[i].trim() : ''; });
        return obj;
    });
    return rows;
}

async function loadAllData() {
    // Try loading stores.csv
    try {
        const storesText = await fetchText('../data/stores.csv');
        stores = parseCSV(storesText).map(s => ({ id: s.store_id || s.storeId || s.id, name: s.name, lat: parseFloat(s.lat || s.latitude), lon: parseFloat(s.lon || s.longitude), radius: parseFloat(s.radius_m || s.radius || 500) }));
    } catch (e) {
        console.warn('Could not load ../data/stores.csv:', e.message);
        stores = [];
    }

    // Try loading store_catchments.geojson
    try {
        const geoText = await fetchText('../data/store_catchments.geojson');
        storeGeoJSON = JSON.parse(geoText);
    } catch (e) {
        console.warn('Could not load ../data/store_catchments.geojson:', e.message);
        storeGeoJSON = null;
    }

    // Load spatial_intersections if present
    try {
       const siText = await fetchText('../output/spatial_intersections.csv');
        spatialIntersections = parseCSV(siText).map(row => ({ device_id: row.device_id, store_id: row.store_id, store_name: row.store_name, latitude: parseFloat(row.latitude), longitude: parseFloat(row.longitude), hour: parseInt(row.hour) }));
    } catch (e) {
        console.warn('Could not load ../output/spatial_intersections.csv:', e.message);
        spatialIntersections = [];
    }

    // Load hourly footfall
    try {
       const hfText = await fetchText('../output/hourly_footfall_metrics.csv');
        hourlyFootfall = parseCSV(hfText).map(r => ({ store_id: r.store_id, store_name: r.store_name, hour: parseInt(r.hour), total_pings: parseInt(r.total_pings || r.total_pings), unique_visitors: parseInt(r.unique_visitors || r.unique_visitors) }));
    } catch (e) {
        console.warn('Could not load ../output/hourly_footfall_metrics.csv:', e.message);
        hourlyFootfall = [];
    }

    // Load cannibalization matrix
    try {
        const cText = await fetchText('../output/cannibalization_matrix.csv');
        cannibalization = parseCSV(cText).map(r => ({ primary_store: r.primary_store, target_store: r.target_store, overlap_percentage: parseFloat(r.overlap_percentage) }));
    } catch (e) {
        console.warn('Could not load ../output/cannibalization_matrix.csv:', e.message);
        cannibalization = [];
    }
}

function initEmptyMap() {
    map = L.map('map').setView([37.7790, -122.4130], 14);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);
    console.log("Leaflet map initialized");
}

function renderStoresOnMap() {
    // Clear existing
    storeMarkers.forEach(m => map.removeLayer(m));
    storeCircles.forEach(c => map.removeLayer(c));
    storeMarkers = [];
    storeCircles = [];

    if (storeGeoJSON && storeGeoJSON.features) {
        L.geoJSON(storeGeoJSON, { style: { color: '#06b6d4', weight: 1, fillOpacity: 0.08 } }).addTo(map);
    }

    stores.forEach((s, idx) => {
        if (!s || !s.lat || !s.lon) return;
        const color = ['#ef4444', '#f59e0b', '#10b981', '#6366f1'][idx % 4];
        const circle = L.circle([s.lat, s.lon], { color, fillColor: color, fillOpacity: 0.12, radius: s.radius || 500 }).addTo(map);
        circle.bindTooltip(`<b>${s.name}</b><br>${s.id || ''}`);
        storeCircles.push(circle);

        const marker = L.marker([s.lat, s.lon]).addTo(map);
        marker.bindPopup(`<div style="color:#000;font-family:Inter, sans-serif;"><h4 style="margin:0;">${s.name}</h4><p style="margin:4px 0 0 0; font-size:12px;">ID: ${s.id || ''}</p></div>`);
        // click to focus this store
        marker.on('click', () => { showStoreDetail(s.id); });
        storeMarkers.push(marker);
    });
    

    console.log(`Rendered ${stores.length} store catchment areas.`);
}

function showStoreDetail(storeId) {
    selectedStoreId = storeId;
    const storeSelect = document.getElementById('storeSelect');
    if (storeSelect) storeSelect.value = storeId;

    stores.forEach((s, idx) => {
        const m = storeMarkers[idx];
        const c = storeCircles[idx];
        if (!m || !c) return;
        if (s.id !== storeId) {
            if (map.hasLayer(m)) map.removeLayer(m);
            if (map.hasLayer(c)) map.removeLayer(c);
        } else {
            if (!map.hasLayer(m)) map.addLayer(m);
            if (!map.hasLayer(c)) map.addLayer(c);
            map.setView([s.lat, s.lon], 16);
        }
    });

    initCharts(currentHour, storeId);
    renderStoreKpis(currentHour, storeId);
    updateAlertCard(storeId);
}

function showAllStores() {
    selectedStoreId = null;
    const storeSelect = document.getElementById('storeSelect');
    if (storeSelect) storeSelect.value = 'ALL';

    stores.forEach((s, idx) => {
        const m = storeMarkers[idx];
        const c = storeCircles[idx];
        if (!m || !c) return;
        if (!map.hasLayer(m)) map.addLayer(m);
        if (!map.hasLayer(c)) map.addLayer(c);
    });
    map.setView([37.7790, -122.4130], 14);
    initCharts(currentHour, null);
    renderStoreKpis(currentHour, null);
    updateAlertCard(null);
}

function getStoreName(storeId) {
    const store = stores.find(s => s.id === storeId);
    return store ? store.name : storeId || 'All Stores';
}

function getStoreHourlyData(storeId) {
    return hourlyFootfall
        .filter(r => r.store_id === storeId)
        .sort((a, b) => a.hour - b.hour);
}

function getStoreSummary(storeId, hour) {
    const rows = getStoreHourlyData(storeId);
    const currentRow = rows.find(r => r.hour === hour) || rows[0] || {};
    const currentValue = currentRow.unique_visitors || currentRow.total_pings || 0;
    const dailyValue = rows.reduce((sum, row) => sum + (row.unique_visitors || row.total_pings || 0), 0);
    const peakRow = rows.reduce((best, row) => {
        const value = row.unique_visitors || row.total_pings || 0;
        return value > best.value ? { hour: row.hour, value } : best;
    }, { hour: currentHour, value: 0 });

    return {
        currentValue,
        dailyValue,
        peakHour: peakRow.hour,
        peakValue: peakRow.value
    };
}

function renderStoreKpis(hour, storeId) {
    const storeLabel = storeId ? getStoreName(storeId) : 'All Stores';
    const summary = storeId ? getStoreSummary(storeId, hour) : stores.reduce((acc, store) => {
        const subset = getStoreSummary(store.id, hour);
        return {
            currentValue: acc.currentValue + subset.currentValue,
            dailyValue: acc.dailyValue + subset.dailyValue,
            peakHour: subset.peakValue > acc.peakValue ? subset.peakHour : acc.peakHour,
            peakValue: Math.max(acc.peakValue, subset.peakValue)
        };
    }, { currentValue: 0, dailyValue: 0, peakHour: hour, peakValue: 0 });

    document.getElementById('selectedStoreName').innerText = storeLabel;
    document.getElementById('selectedStoreContext').innerText = storeId ? 'Store-specific performance' : 'Combined view across stores';
    document.getElementById('currentHourTraffic').innerText = summary.currentValue.toLocaleString();
    document.getElementById('currentHourTrend').innerText = `At ${hour.toString().padStart(2, '0')}:00`;
    document.getElementById('dailyVisitors').innerText = summary.dailyValue.toLocaleString();
    document.getElementById('dailyTrend').innerText = storeId ? 'Full-day traffic total' : 'Combined full-day traffic';
    document.getElementById('peakHourMetric').innerText = `${summary.peakHour.toString().padStart(2, '0')}:00`;
    document.getElementById('peakHourTrend').innerText = `${summary.peakValue.toLocaleString()} peak visitors`;
}

function updateAlertCard(storeId) {
    const overlapRows = storeId
        ? cannibalization.filter(c => c.primary_store === storeId || c.target_store === storeId)
        : cannibalization;

    const strongestOverlap = overlapRows.length
        ? overlapRows.reduce((best, row) => (row.overlap_percentage > best.overlap_percentage ? row : best), overlapRows[0])
        : null;

    const rateEl = document.getElementById('cannibalizationRate');
    const textEl = document.getElementById('cannibalizationText');
    const barEl = document.querySelector('.progress-fill');

    if (rateEl && strongestOverlap) {
        rateEl.innerText = `${strongestOverlap.overlap_percentage.toFixed(1)}%`;
        if (textEl) {
            const relatedStore = storeId
                ? strongestOverlap.primary_store === storeId
                    ? getStoreName(strongestOverlap.target_store)
                    : getStoreName(strongestOverlap.primary_store)
                : `${strongestOverlap.primary_store} ↔ ${strongestOverlap.target_store}`;
            textEl.innerHTML = `Highest overlap signal for <strong>${relatedStore}</strong> based on current store-catchment data.`;
        }
        if (barEl) {
            barEl.style.width = `${Math.min(strongestOverlap.overlap_percentage, 100)}%`;
        }
    }
}

function renderPingsForHour(hour) {
    pingMarkers.forEach(p => map.removeLayer(p));
    pingMarkers = [];

    const filtered = spatialIntersections.filter(r => r.hour === hour);
    filtered.forEach(r => {
        if (!r.latitude || !r.longitude) return;
        const m = L.circleMarker([r.latitude, r.longitude], { radius: 3, color: '#06b6d4', fillOpacity: 0.7 }).addTo(map);
        pingMarkers.push(m);
    });

    // Update summary stats
    document.getElementById('totalPings').innerText = spatialIntersections.length.toLocaleString();
    const unique = new Set(spatialIntersections.map(r => r.device_id)).size;
    document.getElementById('uniqueVisitors').innerText = unique.toLocaleString();
}

function onTimeSliderChange(val) {
    const period = val < 12 ? 'AM' : 'PM';
    const displayHour = val > 12 ? val - 12 : (val == 0 ? 12 : val);
    const formatted = `${displayHour.toString().padStart(2, '0')}:00 ${period}`;
    document.getElementById('timeDisplay').innerText = `${formatted} (${val >= 7 && val <= 9 ? 'Morning Commute' : val >= 17 && val <= 19 ? 'Evening Peak' : 'Off-Peak'})`;
    const h = parseInt(val);
    console.log(`Timeline hour selected: ${h}`);
    currentHour = h;
    renderPingsForHour(h);
    initCharts(h, selectedStoreId);
    renderStoreKpis(h, selectedStoreId);
    updateAlertCard(selectedStoreId);
}

function updateBufferRadius(val) {
    document.getElementById('radiusLabel').innerText = `${val}m Radius`;
    storeCircles.forEach(c => c.setRadius(parseFloat(val)));
}

function onStoreSelect() {
    const selected = document.getElementById('storeSelect').value;
    if (selected === 'ALL') {
        showAllStores();
    } else {
        showStoreDetail(selected);
    }
}

function initCharts(selectedHour, selectedStore) {
    const hours = Array.from({ length: 18 }, (_, i) => i + 6);
    const labels = hours.map(h => (h <= 12 ? `${h}AM` : `${h - 12}PM`));
    const availableStoreIds = stores.length
        ? stores.map(s => s.id)
        : [...new Set(hourlyFootfall.map(h => h.store_id))];
    const filteredStoreIds = selectedStore ? availableStoreIds.filter(id => id === selectedStore) : availableStoreIds;

    const trendDatasets = filteredStoreIds.map((sid, idx) => {
        const color = ['#ef4444', '#f59e0b', '#10b981', '#6366f1', '#06b6d4'][idx % 5];
        const data = hours.map(h => {
            const row = hourlyFootfall.find(r => r.store_id === sid && r.hour === h);
            return row ? row.unique_visitors || row.total_pings || 0 : 0;
        });
        return {
            label: getStoreName(sid),
            data,
            borderColor: color,
            backgroundColor: `${color}33`,
            tension: 0.3,
            fill: true
        };
    });

    const hourToHighlight = typeof selectedHour === 'number' ? selectedHour : currentHour;
    trendDatasets.forEach(ds => {
        ds.pointRadius = hours.map(h => (h === hourToHighlight ? 6 : 2));
        ds.pointBackgroundColor = hours.map(h => (h === hourToHighlight ? '#ffffff' : ds.borderColor));
    });

    console.log(`Rendering hourly visitor trend for ${filteredStoreIds.length} store(s).`);
    if (trendChart) trendChart.destroy();
    trendChart = new Chart(trendCtx, {
        type: 'line',
        data: { labels, datasets: trendDatasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { labels: { color: '#f8fafc' } } },
            scales: {
                x: { ticks: { color: '#cbd5e1' }, grid: { color: 'rgba(255,255,255,0.08)' } },
                y: { ticks: { color: '#cbd5e1' }, grid: { color: 'rgba(255,255,255,0.08)' } }
            }
        }
    });

    const comparisonLabels = availableStoreIds.map(id => getStoreName(id));
    const comparisonValues = availableStoreIds.map(id => {
        const row = hourlyFootfall.find(r => r.store_id === id && r.hour === hourToHighlight);
        return row ? row.unique_visitors || row.total_pings || 0 : 0;
    });
    const comparisonColors = availableStoreIds.map(id => id === selectedStore ? '#06b6d4' : '#6366f1');
    const comparisonCtx = document.getElementById('storeComparisonChart').getContext('2d');
    if (comparisonChart) comparisonChart.destroy();
    comparisonChart = new Chart(comparisonCtx, {
        type: 'bar',
        data: {
            labels: comparisonLabels,
            datasets: [{ label: 'Visitors at selected hour', data: comparisonValues, backgroundColor: comparisonColors }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { ticks: { color: '#cbd5e1' }, grid: { display: false } },
                y: { ticks: { color: '#cbd5e1' }, grid: { color: 'rgba(255,255,255,0.08)' } }
            }
        }
    });

    let overlapLabels = [];
    let overlapValues = [];
    const overlapColors = ['#06b6d4', '#ef4444', '#f59e0b', '#10b981', '#6366f1'];

    if (selectedStore) {
        const overlapRows = cannibalization
            .filter(c => c.primary_store === selectedStore || c.target_store === selectedStore)
            .slice(0, 5);
        const baseValue = hourlyFootfall.find(r => r.store_id === selectedStore && r.hour === hourToHighlight);
        overlapLabels.push(getStoreName(selectedStore));
        overlapValues.push(baseValue ? baseValue.unique_visitors || baseValue.total_pings || 0 : 0);

        overlapRows.forEach((row, idx) => {
            const otherId = row.primary_store === selectedStore ? row.target_store : row.primary_store;
            const rowHour = hourlyFootfall.find(r => r.store_id === otherId && r.hour === hourToHighlight);
            overlapLabels.push(getStoreName(otherId));
            overlapValues.push(rowHour ? rowHour.unique_visitors || rowHour.total_pings || 0 : 0);
        });
    } else {
        const hourRows = hourlyFootfall
            .filter(r => r.hour === hourToHighlight)
            .sort((a, b) => (b.unique_visitors || b.total_pings || 0) - (a.unique_visitors || a.total_pings || 0))
            .slice(0, 5);
        overlapLabels = hourRows.map(r => getStoreName(r.store_id));
        overlapValues = hourRows.map(r => r.unique_visitors || r.total_pings || 0);
    }

    const overlapCtx = document.getElementById('storeOverlapChart').getContext('2d');
    if (overlapChart) overlapChart.destroy();
    overlapChart = new Chart(overlapCtx, {
        type: 'doughnut',
        data: {
            labels: overlapLabels,
            datasets: [{ data: overlapValues, backgroundColor: overlapColors.slice(0, overlapLabels.length) }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#f8fafc' } },
                tooltip: {
                    callbacks: {
                        label: context => `${context.label}: ${context.parsed.toLocaleString()} visitors`
                    }
                }
            }
        }
    });
}

function updateChartsForHour(hour) {
    initCharts(hour, selectedStoreId);
    renderStoreKpis(hour, selectedStoreId);
    updateAlertCard(selectedStoreId);
}

function triggerSimulation() {
    // Try reloading output files and refresh visualizations
    loadAllData().then(() => {
        renderStoresOnMap();
        const h = parseInt(document.getElementById('timeSlider').value) || currentHour;
        currentHour = h;
        renderPingsForHour(h);
        initCharts(h, selectedStoreId);
        renderStoreKpis(h, selectedStoreId);
        updateAlertCard(selectedStoreId);
        alert('Refreshed dashboard with latest output files from ../output.');
    }).catch(err => {
        alert('Could not refresh outputs from ../output. To (re)generate outputs run:\n\npython pyspark_spatial_join.py\n\nfrom the project root.');
    });
}
