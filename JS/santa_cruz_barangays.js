/**
 * Accurate coordinates for barangays in Santa Cruz, Laguna
 * Based on approximate geographical locations within the municipality
 */
const santaCruzBarangays = [
            { name: "Alipit", lat: 14.2299, lng: 121.4102 },
            { name: "Bagumbayan", lat: 14.2696, lng: 121.3974 },
            { name: "Poblacion I", lat: 14.2755, lng: 121.4170 },
            { name: "Poblacion II", lat: 14.2800, lng: 121.4161 },
            { name: "Poblacion III", lat: 14.2820, lng: 121.4152 },
            { name: "Poblacion IV", lat: 14.2816, lng: 121.4148 },
            { name: "Poblacion V", lat: 14.2852, lng: 121.4125 },
            { name: "Bubukal", lat: 14.2593, lng: 121.3985 },
            { name: "Calios", lat: 14.2746, lng: 121.4068 },
            { name: "Duhat", lat: 14.2587, lng: 121.3744 },
            { name: "Gatid", lat: 14.2606, lng: 121.3852 },
            { name: "Jasaan", lat: 14.2228, lng: 121.3921 },
            { name: "Labuin", lat: 14.2473, lng: 121.3931 },
            { name: "Malinao", lat: 14.2356, lng: 121.3916 },
            { name: "Oogong", lat: 14.2265, lng: 121.4007 },
            { name: "Pagsawitan", lat: 14.2658, lng: 121.4265 },
            { name: "Palasan", lat: 14.2548, lng: 121.4201 },
            { name: "Patimbao", lat: 14.2680, lng: 121.4156 },
            { name: "San Jose", lat: 14.2357, lng: 121.4041 },
            { name: "San Juan", lat: 14.2450, lng: 121.4089 },
            { name: "San Pablo Norte", lat: 14.2852, lng: 121.4174 },
            { name: "San Pablo Sur", lat: 14.2826, lng: 121.4174 },
            { name: "Santisima Cruz", lat: 14.2878, lng: 121.4110 },
            { name: "Santo Angel Central", lat: 14.2854, lng: 121.4087 },
            { name: "Santo Angel Norte", lat: 14.2882, lng: 121.4070 },
            { name: "Santo Angel Sur", lat: 14.2815, lng: 121.4109 }
        ];

/**
 * Get coordinates for a barangay by name (case-insensitive)
 */
function getBarangayCoordinates(barangayName) {
    const normalized = barangayName.toLowerCase().trim();
    const barangay = santaCruzBarangays.find(b => 
        b.name.toLowerCase() === normalized
    );
    return barangay || { lat: 14.2818099, lng: 121.414977 }; // Default to Santa Cruz center
}

/**
 * Populate a select dropdown with barangays
 */
function populateBarangaySelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;

    select.innerHTML = '<option value="">Select Barangay</option>';

    santaCruzBarangays.forEach(b => {
        const option = document.createElement("option");
        option.value = b.name;
        option.textContent = b.name;
        select.appendChild(option);
    });
}

/**
 * Populate a filter dropdown with "All Barangays" option
 */
function populateBarangayFilter(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;

    select.innerHTML = '<option value="all">All Barangays</option>';

    santaCruzBarangays.forEach(b => {
        const option = document.createElement("option");
        option.value = b.name;
        option.textContent = b.name;
        select.appendChild(option);
    });
}

/**
 * Initialize a Leaflet map with barangay markers
 */
function initializeBarangayMap(mapId = 'map') {
    const map = L.map(mapId).setView([14.2818099, 121.414977], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
    }).addTo(map);

    // Add barangay boundary markers
    santaCruzBarangays.forEach(barangay => {
        L.marker([barangay.lat, barangay.lng], {
            icon: L.divIcon({
                className: 'barangay-label',
                html: `<div style="background: white; padding: 2px 5px; border-radius: 3px; font-size: 10px; font-weight: bold; border: 1px solid #333;">${barangay.name}</div>`,
                iconSize: [null, null]
            })
        }).addTo(map);
    });

    return map;
}

export { 
    santaCruzBarangays, 
    getBarangayCoordinates,
    populateBarangaySelect, 
    populateBarangayFilter,
    initializeBarangayMap 
};