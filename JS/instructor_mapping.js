const santaCruzBarangays = [
    { name: "Alipit", lat: 14.2299, lng: 121.4102 },
    { name: "Bagumbayan", lat: 14.268804631725034, lng: 121.39979947057562 },
    { name: "Poblacion I", lat: 14.2755, lng: 121.4170 },
    { name: "Poblacion II", lat: 14.2800, lng: 121.4161 },
    { name: "Poblacion III", lat: 14.2820, lng: 121.4152 },
    { name: "Poblacion IV", lat: 14.2816, lng: 121.4148 },
    { name: "Poblacion V", lat: 14.2852, lng: 121.4125 },
    { name: "Bubukal", lat: 14.251157941121727, lng: 121.40255750998381 },
    { name: "Calios", lat: 14.275138925320823, lng: 121.40270109834186 },
    { name: "Duhat", lat: 14.248671913684055, lng: 121.37885222772985 },
    { name: "Gatid", lat: 14.26136953826561, lng: 121.38547404462257 },
    { name: "Jasaan", lat: 14.2228, lng: 121.3921 },
    { name: "Labuin", lat: 14.2473, lng: 121.3931 },
    { name: "Malinao", lat: 14.2356, lng: 121.3916 },
    { name: "Oogong", lat: 14.223958784202317, lng: 121.39846896765496 },
    { name: "Pagsawitan", lat: 14.265459832536076, lng: 121.42517109649133 },
    { name: "Palasan", lat: 14.254588856450583, lng: 121.42019519649105 },
    { name: "Patimbao", lat: 14.272573942152114, lng: 121.41732358484933 },
    { name: "San Jose", lat: 14.236571232323422, lng: 121.40299913081627 },
    { name: "San Juan", lat: 14.2450, lng: 121.4089 },
    { name: "San Pablo Norte", lat: 14.2852, lng: 121.4174 },
    { name: "San Pablo Sur", lat: 14.2826, lng: 121.4174 },
    { name: "Santisima Cruz", lat: 14.288230125362734, lng: 121.41198043087904 },
    { name: "Santo Angel Central", lat: 14.285503419158754, lng: 121.41075330998406 },
    { name: "Santo Angel Norte", lat: 14.28872161573547, lng: 121.40593611368526 },
    { name: "Santo Angel Sur", lat: 14.281381537136495, lng: 121.41136975416305 }
];

let map;
let currentMetric = 'readiness';
let currentViz = 'pins';
let barangayData = {};
let allMarkers = [];
let userLocationMarker = null;
let userLocationObtained = false;
let schoolMarkers = [];
let showSchools = false;
let routingEnabled = false;
let userLocation = null;
let destinationMarker = null;
let routeLine = null;
let routeMode = 'auto'; // 'auto' or 'manual'
let fromPin = null;
let toPin = null;
let coordinatePinMarker = null; // Temporary marker for coordinate input
let selectedBarangayName = null; // Track selected barangay for DSS
let currentRouteData = null; // Store route data for traffic level switching
let currentTrafficLevel = 'current'; // current, light, medium, heavy
const currentYear = new Date().getFullYear();

// Coordinate Pin Functions
function addCoordinatePin(lat, lng) {
    // Remove existing pin if any
    removeCoordinatePin();

    // Create a custom element for the coordinate pin
    const el = document.createElement('div');
    el.className = 'coordinate-pin-marker';
    el.innerHTML = `
        <div class="coordinate-pin-icon">
            <i class="fas fa-map-pin"></i>
        </div>
    `;

    // Create and add marker to map
    coordinatePinMarker = new maplibregl.Marker({
        element: el,
        anchor: 'bottom'
    })
        .setLngLat([lng, lat])
        .setPopup(new maplibregl.Popup({
            offset: 25,
            className: 'coordinate-pin-popup'
        }).setHTML(`
            <div style="padding: 12px; text-align: center;">
                <div style="font-weight: 600; color: #667eea; margin-bottom: 8px;">
                    <i class="fas fa-map-pin"></i> Quick Location Pin
                </div>
                <div style="font-size: 12px; color: #666; line-height: 1.5;">
                    <strong>Latitude:</strong> ${lat.toFixed(6)}<br>
                    <strong>Longitude:</strong> ${lng.toFixed(6)}
                </div>
                <div style="margin-top: 8px; font-size: 11px; color: #999;">
                    Click "Clear" to remove this pin
                </div>
            </div>
        `))
        .addTo(map);

    // Open popup
    coordinatePinMarker.togglePopup();

    // Fly to the coordinates
    map.flyTo({
        center: [lng, lat],
        zoom: 15,
        duration: 1000,
        essential: true
    });

    console.log(`✅ Coordinate pin added at: ${lat}, ${lng}`);
}

function removeCoordinatePin() {
    if (coordinatePinMarker) {
        coordinatePinMarker.remove();
        coordinatePinMarker = null;
        console.log('🗑️ Coordinate pin removed');
    }
}

function initMap() {
    map = new maplibregl.Map({
        container: 'map',
        style: {
            version: 8,
            sources: {
                'osm': {
                    type: 'raster',
                    tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
                    tileSize: 256,
                    attribution: '© OpenStreetMap contributors'
                }
            },
            layers: [{
                id: 'osm',
                type: 'raster',
                source: 'osm',
                minzoom: 0,
                maxzoom: 19
            }]
        },
        center: [121.414977, 14.2818099],
        zoom: 11.5,
        maxZoom: 18,
        minZoom: 10
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.ScaleControl(), 'bottom-left');
    addFullscreenControl(); 

    map.on('load', () => {
        console.log('✅ MapLibre loaded');
        // Hide controls initially until user location is obtained
        document.querySelector('.analytics-controls').style.opacity = '0.5';
        document.querySelector('.analytics-controls').style.pointerEvents = 'none';
        document.getElementById('statistics').innerHTML = '<div class="loading">📍 Getting your location...</div>';
        addUserLocation();
    });
}

function addUserLocation() {
    if ('geolocation' in navigator) {
        console.log('🔍 Requesting user location...');
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLat = position.coords.latitude;
                const userLng = position.coords.longitude;
                
                // Store user location globally for routing
                userLocation = { lat: userLat, lng: userLng };
                
                console.log('✅ User location obtained:', userLat, userLng);
                
                const el = document.createElement('div');
                el.className = 'user-location-marker';
                el.innerHTML = `
                    <div class="user-location-pulse"></div>
                    <div class="user-location-dot">
                        <i class="fas fa-user"></i>
                    </div>
                `;
                
                userLocationMarker = new maplibregl.Marker({ 
                    element: el, 
                    anchor: 'center' 
                })
                    .setLngLat([userLng, userLat])
                    .setPopup(new maplibregl.Popup({ 
                        offset: 25,
                        className: 'user-location-popup'
                    }).setHTML(`
                        <div style="padding: 12px; text-align: center;">
                            <div style="font-weight: 600; color: #667eea; margin-bottom: 5px;">
                                <i class="fas fa-map-marker-alt"></i> Your Location
                            </div>
                            <div style="font-size: 12px; color: #666;">
                                Lat: ${userLat.toFixed(6)}<br>
                                Lng: ${userLng.toFixed(6)}
                            </div>
                        </div>
                    `))
                    .addTo(map);
                
                // Center map on user location
                map.flyTo({
                    center: [userLng, userLat],
                    zoom: 14,
                    duration: 1500,
                    essential: true
                });
                
                // Mark that user location has been obtained
                userLocationObtained = true;
                console.log('✅ User location marker added and map centered');
                
                // Now load barangay data
                setTimeout(() => {
                    fetchLearners();
                }, 500);
            },
            (error) => {
                let errorMessage = '';
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = '❌ Location access denied. Please enable location permissions.';
                        alert('Location Permission Needed: Please enable location access in your browser settings to see your location on the map.');
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = '❌ Location unavailable. Check your GPS settings.';
                        alert('Location Unavailable: Please enable GPS/Location Services on your device.');
                        break;
                    case error.TIMEOUT:
                        errorMessage = '❌ Location request timed out. Please refresh.';
                        alert('Location Timeout: Please refresh the page and try again.');
                        break;
                    default:
                        errorMessage = '❌ Unable to get location: ' + error.message;
                        alert('Location Error: ' + error.message);
                }
                console.warn(errorMessage);
                
                // Still load the map even if location fails
                setTimeout(() => {
                    document.querySelector('.analytics-controls').style.opacity = '1';
                    document.querySelector('.analytics-controls').style.pointerEvents = 'auto';
                    document.getElementById('statistics').innerHTML = '<div class="loading">Location access denied. Showing all areas.</div>';
                    fetchLearners();
                }, 1000);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    } else {
        alert('Geolocation Not Supported: Your browser does not support location services.');
        console.warn('⚠️ Geolocation not supported by browser');
    }
}

function addFullscreenControl() {
    const mapContainer = document.getElementById('map');
    
    // Create fullscreen button
    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.className = 'maplibre-fullscreen-btn';
    fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
    fullscreenBtn.title = 'Toggle fullscreen';
    
    fullscreenBtn.addEventListener('click', () => {
        const mapWrapper = document.querySelector('.map-container');
        
        if (!document.fullscreenElement) {
            // Enter fullscreen
            if (mapWrapper.requestFullscreen) {
                mapWrapper.requestFullscreen();
            } else if (mapWrapper.webkitRequestFullscreen) {
                mapWrapper.webkitRequestFullscreen();
            } else if (mapWrapper.msRequestFullscreen) {
                mapWrapper.msRequestFullscreen();
            }
        } else {
            // Exit fullscreen
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
    });
    
    // Update button icon on fullscreen change
    document.addEventListener('fullscreenchange', () => {
        if (document.fullscreenElement) {
            fullscreenBtn.innerHTML = '<i class="fas fa-compress"></i>';
            fullscreenBtn.title = 'Exit fullscreen';
        } else {
            fullscreenBtn.innerHTML = '<i class="fas fa-expand"></i>';
            fullscreenBtn.title = 'Toggle fullscreen';
        }
        
        // Resize map after fullscreen change
        setTimeout(() => {
            map.resize();
        }, 100);
    });
    
    // Add button to map container
    mapContainer.appendChild(fullscreenBtn);
}


function initializeSearch() {
    const searchContainer = document.querySelector('.maplibre-search-container');
    const searchBox = document.getElementById('searchBox');
    const searchResults = document.getElementById('searchResults');
    
    if (!searchBox || !searchResults) return;

    let clearBtn = searchContainer.querySelector('.maplibre-search-clear');
    if (!clearBtn) {
        clearBtn = document.createElement('button');
        clearBtn.className = 'maplibre-search-clear';
        clearBtn.innerHTML = '×';
        searchContainer.appendChild(clearBtn);
    }

    clearBtn.addEventListener('click', () => {
        searchBox.value = '';
        searchResults.classList.remove('active');
        clearBtn.classList.remove('active');
        searchBox.focus();
    });

    searchBox.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        
        if (query.length > 0) {
            clearBtn.classList.add('active');
        } else {
            clearBtn.classList.remove('active');
        }
        
        if (query.length < 2) {
            searchResults.classList.remove('active');
            return;
        }

        const matches = Object.values(barangayData).filter(b => 
            b.barangay.toLowerCase().includes(query)
        );

        let htmlContent = '';

        // Show local barangay matches first
        if (matches.length > 0) {
            htmlContent = matches.map(data => {
                const priorityClass = data.tier || 'low';
                const priorityLabel = priorityClass.charAt(0).toUpperCase() + priorityClass.slice(1);
                
                return `
                    <div class="search-result-item local-result" data-lat="${data.lat}" data-lng="${data.lng}" data-name="${data.barangay}">
                        <div class="search-result-name"><i class="fas fa-map-marker-alt" style="color: #667eea; margin-right: 8px;"></i>${data.barangay}</div>
                        <div class="search-result-info">
                            <span class="search-result-badge ${priorityClass}">${priorityLabel}</span>
                            <span style="opacity: 0.8;">${data.total} learners</span>
                        </div>
                    </div>
                `;
            }).join('');

            // Add a divider and external search option
            htmlContent += `
                <div style="border-top: 1px solid #e0e0e0; margin: 8px 0;"></div>
                <div class="search-result-item external-search" data-query="${query}" onclick="searchGoogleMaps('${query}')">
                    <div class="search-result-name"><i class="fas fa-globe" style="color: #764ba2; margin-right: 8px;"></i>Search on Google Maps</div>
                    <div class="search-result-info" style="opacity: 0.7;">
                        <small>Search for "${query}" in Santa Cruz, Laguna</small>
                    </div>
                </div>
            `;
        } else {
            // No local results, show external search option
            htmlContent = `
                <div class="search-result-item external-search" data-query="${query}" onclick="searchGoogleMaps('${query}')">
                    <div class="search-result-name"><i class="fas fa-globe" style="color: #764ba2; margin-right: 8px;"></i>Search on Google Maps</div>
                    <div class="search-result-info" style="opacity: 0.7;">
                        <small>Search for "${query}" in Santa Cruz, Laguna</small>
                    </div>
                </div>
            `;
        }

        searchResults.innerHTML = htmlContent;
        searchResults.classList.add('active');

        // Add click handlers for local results
        searchResults.querySelectorAll('.local-result').forEach(item => {
            item.addEventListener('click', () => {
                const lat = parseFloat(item.dataset.lat);
                const lng = parseFloat(item.dataset.lng);
                const name = item.dataset.name;
                
                map.flyTo({
                    center: [lng, lat],
                    zoom: 15,
                    duration: 1500,
                    essential: true
                });

                searchBox.value = name;
                searchResults.classList.remove('active');

                setTimeout(() => {
                    const marker = allMarkers.find(m => m.barangayName === name);
                    if (marker && marker.popup) {
                        marker.popup.addTo(map);
                    }
                }, 1600);
            });

            item.addEventListener('mouseenter', () => {
                searchResults.querySelectorAll('.search-result-item').forEach(i => 
                    i.classList.remove('selected'));
                item.classList.add('selected');
            });
        });

        // Add click handler for external search
        const externalBtn = searchResults.querySelector('.external-search');
        if (externalBtn) {
            externalBtn.addEventListener('click', () => {
                searchGoogleMaps(query);
            });

            externalBtn.addEventListener('mouseenter', () => {
                searchResults.querySelectorAll('.search-result-item').forEach(i => 
                    i.classList.remove('selected'));
                externalBtn.classList.add('selected');
            });
        }
    });

    searchBox.addEventListener('keydown', (e) => {
        const items = searchResults.querySelectorAll('.search-result-item');
        if (items.length === 0) return;

        let currentIndex = Array.from(items).findIndex(item => 
            item.classList.contains('selected'));

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            currentIndex = (currentIndex + 1) % items.length;
            items.forEach((item, idx) => {
                item.classList.toggle('selected', idx === currentIndex);
                if (idx === currentIndex) {
                    item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                }
            });
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            currentIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
            items.forEach((item, idx) => {
                item.classList.toggle('selected', idx === currentIndex);
                if (idx === currentIndex) {
                    item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                }
            });
        } else if (e.key === 'Enter' && currentIndex >= 0) {
            e.preventDefault();
            items[currentIndex].click();
        } else if (e.key === 'Escape') {
            searchResults.classList.remove('active');
            searchBox.blur();
        }
    });

    document.addEventListener('click', (e) => {
        if (!searchContainer.contains(e.target)) {
            searchResults.classList.remove('active');
        }
    });
}

function calculateEnrollmentReadiness(learner) {
    let score = 0;
    let breakdown = {
        interest: 0,
        recency: 0,
        status: 0,
        age: 0,
        educationGap: 0,
        engagement: 0,
        accessibility: 0
    };
    
    // Interest scoring (0-30): Can be partial if boundary case
    if (learner.interested_in_als === true) {
        breakdown.interest = 30;
        score += 30;
    } else if (learner.interested_in_als === false) {
        breakdown.interest = 0;
    } else {
        // Unknown interest = 15 (neutral)
        breakdown.interest = 15;
        score += 15;
    }
    
    // Recency scoring (0-25): More granular
    const yearsSinceCreated = currentYear - (learner.calendar_year || currentYear);
    if (yearsSinceCreated === 0) {
        breakdown.recency = 25;
        score += 25;
    } else if (yearsSinceCreated === 1) {
        breakdown.recency = 18;
        score += 18;
    } else if (yearsSinceCreated === 2) {
        breakdown.recency = 12;
        score += 12;
    } else if (yearsSinceCreated === 3) {
        breakdown.recency = 7;
        score += 7;
    } else {
        breakdown.recency = 3;
        score += 3;
    }
    
    // Status scoring (0-20): Weighted by status type
    const status = learner.als_status || '';
    const dropoutReason = learner.dropout_reason || '';
    
    if (status === 'Active' || status === 'Enrolled') {
        breakdown.status = 20;
        score += 20;
    } else if (status === 'Not Enrolled' && learner.interested_in_als) {
        breakdown.status = 15;
        score += 15;
    } else if (status === 'Dropped' && 
               (dropoutReason.toLowerCase().includes('want') || 
                dropoutReason.toLowerCase().includes('return'))) {
        breakdown.status = 10;
        score += 10;
    } else if (status === 'Completed') {
        breakdown.status = 5;
        score += 5;
    } else {
        breakdown.status = 0;
    }
    
    // Age scoring (0-15): More granular age ranges
    const age = learner.age || 0;
    if (age >= 18 && age <= 25) {
        breakdown.age = 15;
        score += 15;
    } else if (age >= 15 && age <= 30) {
        breakdown.age = 12;
        score += 12;
    } else if (age >= 10 && age <= 40) {
        breakdown.age = 8;
        score += 8;
    } else if (age >= 6 && age <= 60) {
        breakdown.age = 4;
        score += 4;
    } else if (age > 0) {
        breakdown.age = 2;
        score += 2;
    }
    
    // Education gap scoring (0-12): More nuanced
    const yearsSinceLastAttended = currentYear - (learner.year_last_attended || currentYear);
    if (yearsSinceLastAttended === 0) {
        breakdown.educationGap = 12;
        score += 12;
    } else if (yearsSinceLastAttended <= 2) {
        breakdown.educationGap = 10;
        score += 10;
    } else if (yearsSinceLastAttended <= 5) {
        breakdown.educationGap = 7;
        score += 7;
    } else if (yearsSinceLastAttended <= 10) {
        breakdown.educationGap = 4;
        score += 4;
    } else {
        breakdown.educationGap = 2;
        score += 2;
    }
    
    // Engagement scoring (0-10): Based on contact info
    let engagementPoints = 0;
    if (learner.contact_number && learner.contact_number.trim()) engagementPoints += 3;
    if (learner.email_address && learner.email_address.trim()) engagementPoints += 3;
    if (learner.profile_photo) engagementPoints += 2;
    if (learner.mother_tongue && learner.mother_tongue !== 'unknown') engagementPoints += 2;
    breakdown.engagement = Math.min(engagementPoints, 10);
    score += breakdown.engagement;
    
    // Accessibility scoring (0-8): Based on distance/location
    let accessibilityPoints = 5; // Base points for having location data
    const distanceKm = parseFloat(learner.distance_to_learning_center_km) || 0;
    if (distanceKm > 0 && distanceKm < 2) {
        accessibilityPoints = 8; // Very close
    } else if (distanceKm >= 2 && distanceKm < 5) {
        accessibilityPoints = 6; // Close
    } else if (distanceKm >= 5 && distanceKm < 10) {
        accessibilityPoints = 4; // Moderate
    } else if (distanceKm >= 10) {
        accessibilityPoints = 2; // Far
    }
    breakdown.accessibility = accessibilityPoints;
    score += breakdown.accessibility;
    
    // Add small random variation (±2 points) to break ties and make more dynamic
    const randomVariation = Math.floor(Math.random() * 5) - 2; // -2 to +2
    score = Math.max(0, Math.min(100, score + randomVariation));
    
    return { score: Math.round(score), breakdown };
}

function getPriorityTier(score) {
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
}

function getColorForScore(score) {
    if (score >= 70) return '#4CAF50'; 
    if (score >= 40) return '#FFC107'; 
    return '#FF5722'; 
}

function calculateBarangayMetrics(learners) {
    const metrics = {};

    santaCruzBarangays.forEach(b => {
        const barangayName = b.name.toLowerCase().split('(')[0].trim();
        const barangayLearners = learners.filter(l => {
            const learnerBarangay = (l.barangay || "").toLowerCase().trim();
            // Exact match, not substring match
            return learnerBarangay === barangayName || 
                   learnerBarangay === barangayName.replace("poblacion", "barangay"); // Handle old format
        });

        const total = barangayLearners.length;
        
        const learnerScores = barangayLearners.map(l => {
            const { score, breakdown } = calculateEnrollmentReadiness(l);
            return { learner: l, score, breakdown };
        });

        const highPriority = learnerScores.filter(ls => ls.score >= 70);
        const mediumPriority = learnerScores.filter(ls => ls.score >= 40 && ls.score < 70);
        const lowPriority = learnerScores.filter(ls => ls.score < 40);

        const avgScore = total > 0 
            ? Math.round(learnerScores.reduce((sum, ls) => sum + ls.score, 0) / total)
            : 0;

        const enrolled = barangayLearners.filter(l => 
            l.als_status === 'Active' || l.als_status === 'Enrolled'
        ).length;

        metrics[b.name] = {
            barangay: b.name,
            lat: b.lat,
            lng: b.lng,
            total,
            enrolled,
            avgReadinessScore: avgScore,
            highPriorityCount: highPriority.length,
            mediumPriorityCount: mediumPriority.length,
            lowPriorityCount: lowPriority.length,
            learnerScores: learnerScores,
            tier: getPriorityTier(avgScore)
        };
    });

    return metrics;
}

function createPinMarkerElement(color, value) {
    const el = document.createElement('div');
    el.className = 'maplibre-marker-pin';
    el.innerHTML = `
        <svg width="35" height="45" viewBox="0 0 35 45">
            <path d="M17.5 0C7.85 0 0 7.85 0 17.5c0 13.125 17.5 27.5 17.5 27.5S35 30.625 35 17.5C35 7.85 27.15 0 17.5 0z" 
                  fill="${color}" 
                  stroke="white" 
                  stroke-width="2"/>
            <circle cx="17.5" cy="17.5" r="8" fill="white"/>
            <text x="17.5" y="22" text-anchor="middle" 
                  font-size="10" font-weight="bold" fill="${color}">
                ${value}
            </text>
        </svg>
    `;
    return el;
}

function createBadgeMarkerElement(color, value) {
    const el = document.createElement('div');
    el.className = 'maplibre-marker-badge';
    el.style.background = color;
    el.textContent = value;
    return el;
}

function createBarMarkerElement(color, value, maxValue) {
    const height = Math.max(20, (value / maxValue) * 60);
    const el = document.createElement('div');
    el.className = 'maplibre-marker-bar';
    el.innerHTML = `
        <div class="maplibre-marker-bar-fill" style="background: ${color}; height: ${height}px;"></div>
        <div class="maplibre-marker-bar-label" style="color: ${color};">${value}</div>
    `;
    return el;
}

function clearMarkers() {
    allMarkers.forEach(marker => marker.remove());
    allMarkers = [];
}

function clearSchoolMarkers() {
    schoolMarkers.forEach(marker => marker.remove());
    schoolMarkers = [];
}

// Routing functions with multiple vehicle types
async function setDestination(lat, lng) {
    // Remove old destination marker
    if (destinationMarker) {
        destinationMarker.remove();
    }

    // Add new destination marker
    const destEl = document.createElement('div');
    destEl.className = 'destination-marker';
    destEl.innerHTML = `
        <div class="destination-marker-icon">
            <i class="fas fa-map-pin"></i>
        </div>
    `;

    destinationMarker = new maplibregl.Marker({ 
        element: destEl, 
        anchor: 'center' 
    })
        .setLngLat([lng, lat])
        .addTo(map);

    // Get routes for multiple vehicle types
    try {
        const routeData = await getMultipleRoutes(lat, lng);
        
        if (routeData && routeData.car) {
            const drivingRoute = routeData.car;
            const coordinates = drivingRoute.geometry.coordinates;

            // Remove old route line
            if (routeLine) {
                map.removeLayer('route-line');
                map.removeSource('route-source');
            }

            // Add route source
            map.addSource('route-source', {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    geometry: {
                        type: 'LineString',
                        coordinates: coordinates
                    }
                }
            });

            // Add route line layer
            map.addLayer({
                id: 'route-line',
                type: 'line',
                source: 'route-source',
                paint: {
                    'line-color': '#0066ff',
                    'line-width': 4,
                    'line-opacity': 0.8
                }
            });

            routeLine = {
                distance: (drivingRoute.distance / 1000).toFixed(2),
                duration: Math.round(drivingRoute.duration / 60),
                coordinates: coordinates
            };

            // Show route info with multiple vehicle types
            showMultiRouteInfo(routeData);
            console.log(`✅ Routes found for multiple vehicle types`);
        } else {
            alert('Could not find route to destination');
            clearRoute();
        }
    } catch (error) {
        console.error('❌ Routing error:', error);
        alert('Error calculating route');
        clearRoute();
    }
}

// Get routes for multiple vehicle types using OSRM with traffic consideration
async function getMultipleRoutes(lat, lng) {
    const coords = `${userLocation.lng},${userLocation.lat};${lng},${lat}`;
    const routeData = {};

    try {
        // Car route
        const carRes = await fetch(
            `https://router.project-osrm.org/route/v1/car/${coords}?overview=full&geometries=geojson`
        );
        const carData = await carRes.json();
        if (carData.code === 'Ok' && carData.routes.length > 0) {
            routeData.car = carData.routes[0];
        }

        // Bike/Motorcycle route
        const bikeRes = await fetch(
            `https://router.project-osrm.org/route/v1/bike/${coords}?overview=full&geometries=geojson`
        );
        const bikeData = await bikeRes.json();
        if (bikeData.code === 'Ok' && bikeData.routes.length > 0) {
            routeData.motorcycle = bikeData.routes[0];
        }

        // Walking route (for commute/public transport reference)
        const walkRes = await fetch(
            `https://router.project-osrm.org/route/v1/foot/${coords}?overview=full&geometries=geojson`
        );
        const walkData = await walkRes.json();
        if (walkData.code === 'Ok' && walkData.routes.length > 0) {
            const walkRoute = walkData.routes[0];
            const distance = walkRoute.distance / 1000;
            
            // Calculate realistic commute time for public transport in Philippines
            // Average jeepney/bus speed: 25 km/h in average conditions
            // Add waiting time (5-8 mins) and transfer time
            const baseCommuteTime = (distance / 25) * 60; // Time in minutes
            const waitingTime = 6; // Average waiting time for transport
            const totalCommuteTime = Math.round(baseCommuteTime + waitingTime);
            
            routeData.commute = {
                distance: distance,
                duration: totalCommuteTime
            };
        }

        return routeData;
    } catch (error) {
        console.error('Error fetching routes:', error);
        return null;
    }
}

// Apply traffic multiplier based on vehicle type and time of day
function applyTrafficMultiplier(duration, vehicleType) {
    const currentHour = new Date().getHours();
    
    // Determine if we're in peak traffic hours (6-9am, 5-8pm) in Philippines
    const isPeakHours = (currentHour >= 6 && currentHour < 9) || (currentHour >= 17 && currentHour < 20);
    
    let multiplier = 1.0;
    
    if (vehicleType === 'car') {
        // Cars heavily affected by traffic
        multiplier = isPeakHours ? 1.8 : 1.3; // 80% increase in peak hours, 30% in off-peak
    } else if (vehicleType === 'motorcycle') {
        // Motorcycles less affected (can navigate through traffic)
        multiplier = isPeakHours ? 1.2 : 1.05; // 20% increase in peak hours, 5% in off-peak
    }
    
    return Math.round(duration * multiplier);
}

// Calculate times based on traffic level
function calculateTimesForTrafficLevel(routeData, trafficLevel) {
    const times = {};
    
    // Define multipliers for each traffic level and vehicle type
    const multipliers = {
        light: { car: 1.05, motorcycle: 1.0, commute: 0.9 },
        medium: { car: 1.4, motorcycle: 1.15, commute: 1.0 },
        heavy: { car: 1.8, motorcycle: 1.25, commute: 1.15 },
        current: { car: 1.3, motorcycle: 1.05, commute: 1.0 } // Default based on current time
    };
    
    const mult = multipliers[trafficLevel] || multipliers.medium;
    
    if (routeData.car) {
        // OSRM duration is in seconds, convert to minutes with multiplier
        const baseTimeMinutes = routeData.car.duration / 60;
        times.car = {
            distance: (routeData.car.distance / 1000).toFixed(1),
            time: Math.round(baseTimeMinutes * mult.car)
        };
    }
    
    if (routeData.motorcycle) {
        // OSRM bike duration is in seconds, convert to minutes with multiplier
        const baseTimeMinutes = routeData.motorcycle.duration / 60;
        times.motorcycle = {
            distance: (routeData.motorcycle.distance / 1000).toFixed(1),
            time: Math.round(baseTimeMinutes * mult.motorcycle)
        };
    }
    
    if (routeData.commute) {
        // Commute is already calculated in minutes
        times.commute = {
            distance: routeData.commute.distance.toFixed(1),
            time: Math.round(routeData.commute.duration * mult.commute)
        };
    }
    
    return times;
}

// Get traffic level label and icon
function getTrafficLevelInfo(level) {
    const info = {
        light: { icon: '🟢', label: 'Light Traffic', color: '#4CAF50' },
        medium: { icon: '🟡', label: 'Medium Traffic', color: '#FFC107' },
        heavy: { icon: '🔴', label: 'Heavy Traffic', color: '#FF5722' },
        current: { icon: '⏱️', label: 'Current Time', color: '#2563eb' }
    };
    return info[level] || info.current;
}

function clearRoute() {
    if (destinationMarker) {
        destinationMarker.remove();
        destinationMarker = null;
    }

    if (routeLine) {
        try {
            map.removeLayer('route-line');
            map.removeSource('route-source');
        } catch (e) {
            // Layer/source might not exist
        }
        routeLine = null;
    }

    const routeInfo = document.getElementById('route-info');
    if (routeInfo) {
        routeInfo.style.display = 'none';
    }
}

function showMultiRouteInfo(routeData) {
    let routeInfo = document.getElementById('route-info');
    const mapContainer = document.getElementById('map');
    
    if (!routeInfo) {
        routeInfo = document.createElement('div');
        routeInfo.id = 'route-info';
        routeInfo.className = 'route-info-box';
        if (mapContainer) {
            mapContainer.appendChild(routeInfo);
        } else {
            document.body.appendChild(routeInfo);
        }
    }

    // Store route data globally for traffic level switching
    currentRouteData = routeData;
    currentTrafficLevel = 'current';

    // Determine traffic condition
    const currentHour = new Date().getHours();
    const isPeakHours = (currentHour >= 6 && currentHour < 9) || (currentHour >= 17 && currentHour < 20);
    const trafficStatus = isPeakHours ? '🔴 Peak Traffic' : '🟢 Light Traffic';

    updateRouteInfoDisplay('current', routeData);
}

function updateRouteInfoDisplay(trafficLevel, routeData) {
    const routeInfo = document.getElementById('route-info');
    
    // Calculate times for selected traffic level
    let carData, motorcycleData, commuteData;
    
    if (trafficLevel === 'current') {
        // Calculate with current time multipliers
        const times = calculateTimesForTrafficLevel(routeData, 'current');
        carData = times.car || null;
        motorcycleData = times.motorcycle || null;
        commuteData = times.commute || null;
    } else {
        // Calculate for selected traffic level
        const times = calculateTimesForTrafficLevel(routeData, trafficLevel);
        carData = times.car || null;
        motorcycleData = times.motorcycle || null;
        commuteData = times.commute || null;
    }

    // Get traffic level info
    const currentHour = new Date().getHours();
    const isPeakHours = (currentHour >= 6 && currentHour < 9) || (currentHour >= 17 && currentHour < 20);
    const trafficStatusText = isPeakHours ? '🔴 Peak Traffic (Current)' : '🟢 Light Traffic (Current)';
    
    const levelInfo = getTrafficLevelInfo(trafficLevel);
    const displayStatus = trafficLevel === 'current' ? trafficStatusText : levelInfo.icon + ' ' + levelInfo.label;

    // Build vehicle cards HTML
    let vehicleCardsHTML = '';
    
    if (carData) {
        vehicleCardsHTML += `
            <div style="display: flex; align-items: center; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 8px; margin-bottom: 8px; backdrop-filter: blur(5px);">
                <div style="font-size: 24px; margin-right: 12px;">🚗</div>
                <div style="flex: 1;">
                    <div style="font-size: 12px; opacity: 0.85; font-weight: 600;">Car</div>
                    <div style="font-size: 16px; font-weight: 700; line-height: 1;">
                        ${carData.distance} km <span style="opacity: 0.8; font-size: 14px;">• ${carData.time} min</span>
                    </div>
                </div>
            </div>
        `;
    }

    if (motorcycleData) {
        vehicleCardsHTML += `
            <div style="display: flex; align-items: center; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 8px; margin-bottom: 8px; backdrop-filter: blur(5px);">
                <div style="font-size: 24px; margin-right: 12px;">🏍️</div>
                <div style="flex: 1;">
                    <div style="font-size: 12px; opacity: 0.85; font-weight: 600;">Motorcycle</div>
                    <div style="font-size: 16px; font-weight: 700; line-height: 1;">
                        ${motorcycleData.distance} km <span style="opacity: 0.8; font-size: 14px;">• ${motorcycleData.time} min</span>
                    </div>
                </div>
            </div>
        `;
    }

    if (commuteData) {
        vehicleCardsHTML += `
            <div style="display: flex; align-items: center; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 8px; backdrop-filter: blur(5px);">
                <div style="font-size: 24px; margin-right: 12px;">🚌</div>
                <div style="flex: 1;">
                    <div style="font-size: 12px; opacity: 0.85; font-weight: 600;">Public Transport</div>
                    <div style="font-size: 16px; font-weight: 700; line-height: 1;">
                        ${commuteData.distance} km <span style="opacity: 0.8; font-size: 14px;">• ${commuteData.time} min</span>
                    </div>
                </div>
            </div>
        `;
    }

    // Build traffic level buttons
    const trafficButtons = `
        <div style="display: flex; gap: 6px; margin-bottom: 10px;">
            <button onclick="updateRouteDisplay('light')" style="flex: 1; padding: 8px 10px; background: ${trafficLevel === 'light' ? 'rgba(76, 175, 80, 0.8)' : 'rgba(255,255,255,0.15)'}; border: 1px solid rgba(255,255,255,0.3); color: white; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 12px; transition: all 0.2s ease;" onmouseover="this.style.background='rgba(76, 175, 80, 0.9)'" onmouseout="this.style.background='${trafficLevel === 'light' ? 'rgba(76, 175, 80, 0.8)' : 'rgba(255,255,255,0.15)'}'" title="Light traffic conditions">🟢 Light</button>
            <button onclick="updateRouteDisplay('medium')" style="flex: 1; padding: 8px 10px; background: ${trafficLevel === 'medium' ? 'rgba(255, 193, 7, 0.8)' : 'rgba(255,255,255,0.15)'}; border: 1px solid rgba(255,255,255,0.3); color: white; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 12px; transition: all 0.2s ease;" onmouseover="this.style.background='rgba(255, 193, 7, 0.9)'" onmouseout="this.style.background='${trafficLevel === 'medium' ? 'rgba(255, 193, 7, 0.8)' : 'rgba(255,255,255,0.15)'}'" title="Medium traffic conditions">🟡 Medium</button>
            <button onclick="updateRouteDisplay('heavy')" style="flex: 1; padding: 8px 10px; background: ${trafficLevel === 'heavy' ? 'rgba(255, 87, 34, 0.8)' : 'rgba(255,255,255,0.15)'}; border: 1px solid rgba(255,255,255,0.3); color: white; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 12px; transition: all 0.2s ease;" onmouseover="this.style.background='rgba(255, 87, 34, 0.9)'" onmouseout="this.style.background='${trafficLevel === 'heavy' ? 'rgba(255, 87, 34, 0.8)' : 'rgba(255,255,255,0.15)'}'" title="Heavy traffic conditions">🔴 Heavy</button>
        </div>
    `;

    routeInfo.innerHTML = `
        <div style="padding: 16px; background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%); color: white; border-radius: 12px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; box-shadow: 0 8px 24px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.15); backdrop-filter: blur(10px); min-width: 300px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px;">
                <div>
                    <div style="font-size: 12px; opacity: 0.85; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 4px;">📍 Route Information</div>
                    <div style="font-size: 13px; opacity: 0.9;">${displayStatus}</div>
                </div>
                <button onclick="clearRoute()" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.4); color: white; padding: 6px 8px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 16px; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; flex-shrink: 0;" onmouseover="this.style.background='rgba(255,255,255,0.3)'; this.style.transform='scale(1.05)';" onmouseout="this.style.background='rgba(255,255,255,0.2)'; this.style.transform='scale(1)';">✕</button>
            </div>
            <div style="border-top: 1px solid rgba(255,255,255,0.2); padding-top: 12px; margin-bottom: 10px;">
                ${trafficButtons}
            </div>
            <div style="border-top: 1px solid rgba(255,255,255,0.2); padding-top: 12px;">
                ${vehicleCardsHTML}
            </div>
            <div style="font-size: 11px; opacity: 0.7; margin-top: 12px; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 8px;">
                Times calculated for selected traffic level. Motorcycle advantages included.
            </div>
        </div>
    `;
    routeInfo.style.display = 'block';
}

function updateRouteDisplay(trafficLevel) {
    currentTrafficLevel = trafficLevel;
    if (currentRouteData) {
        updateRouteInfoDisplay(trafficLevel, currentRouteData);
    }
}

function showRouteInfo(distance, duration) {
    // Legacy function kept for compatibility - redirects to multi-route display
    showMultiRouteInfo({
        car: { distance: distance * 1000, duration: duration * 60 }
    });
}

// Manual routing with FROM and TO pins
function setFromPin(lat, lng) {
    if (fromPin) {
        fromPin.remove();
    }

    const fromEl = document.createElement('div');
    fromEl.className = 'from-marker';
    fromEl.innerHTML = `
        <div class="from-marker-icon">
            <div class="marker-letter">F</div>
        </div>
    `;

    fromPin = new maplibregl.Marker({ 
        element: fromEl, 
        anchor: 'center' 
    })
        .setLngLat([lng, lat])
        .addTo(map);

    fromPin.data = { lat, lng };
    showPinInfo();
}

function setToPin(lat, lng) {
    if (toPin) {
        toPin.remove();
    }

    const toEl = document.createElement('div');
    toEl.className = 'to-marker';
    toEl.innerHTML = `
        <div class="to-marker-icon">
            <div class="marker-letter">T</div>
        </div>
    `;

    toPin = new maplibregl.Marker({ 
        element: toEl, 
        anchor: 'center' 
    })
        .setLngLat([lng, lat])
        .addTo(map);

    toPin.data = { lat, lng };
    
    // Calculate route once both pins are set
    if (fromPin && toPin) {
        calculateManualRoute();
    }
}

async function calculateManualRoute() {
    if (!fromPin || !toPin) return;

    try {
        const routeData = await getMultipleRoutesManual(fromPin.data.lat, fromPin.data.lng, toPin.data.lat, toPin.data.lng);
        
        if (routeData && routeData.car) {
            const drivingRoute = routeData.car;
            const coordinates = drivingRoute.geometry.coordinates;

            // Remove old route line
            if (routeLine) {
                try {
                    map.removeLayer('route-line');
                    map.removeSource('route-source');
                } catch (e) {}
            }

            // Add route source
            map.addSource('route-source', {
                type: 'geojson',
                data: {
                    type: 'Feature',
                    geometry: {
                        type: 'LineString',
                        coordinates: coordinates
                    }
                }
            });

            // Add route line layer
            map.addLayer({
                id: 'route-line',
                type: 'line',
                source: 'route-source',
                paint: {
                    'line-color': '#22c55e',
                    'line-width': 4,
                    'line-opacity': 0.8
                }
            });

            routeLine = {
                distance: (drivingRoute.distance / 1000).toFixed(2),
                duration: Math.round(drivingRoute.duration / 60),
                coordinates: coordinates
            };

            showManualRouteInfo(routeData);
            console.log(`✅ Route found with multiple vehicle types`);
        }
    } catch (error) {
        console.error('❌ Routing error:', error);
    }
}

// Get multiple routes for manual pin routing with traffic consideration
async function getMultipleRoutesManual(fromLat, fromLng, toLat, toLng) {
    const coords = `${fromLng},${fromLat};${toLng},${toLat}`;
    const routeData = {};

    try {
        // Car route
        const carRes = await fetch(
            `https://router.project-osrm.org/route/v1/car/${coords}?overview=full&geometries=geojson`
        );
        const carData = await carRes.json();
        if (carData.code === 'Ok' && carData.routes.length > 0) {
            routeData.car = carData.routes[0];
        }

        // Motorcycle route
        const bikeRes = await fetch(
            `https://router.project-osrm.org/route/v1/bike/${coords}?overview=full&geometries=geojson`
        );
        const bikeData = await bikeRes.json();
        if (bikeData.code === 'Ok' && bikeData.routes.length > 0) {
            routeData.motorcycle = bikeData.routes[0];
        }

        // Walking route (for commute reference)
        const walkRes = await fetch(
            `https://router.project-osrm.org/route/v1/foot/${coords}?overview=full&geometries=geojson`
        );
        const walkData = await walkRes.json();
        if (walkData.code === 'Ok' && walkData.routes.length > 0) {
            const walkRoute = walkData.routes[0];
            const distance = walkRoute.distance / 1000;
            
            // Calculate realistic commute time for public transport in Philippines
            const baseCommuteTime = (distance / 25) * 60; // Average jeepney/bus speed: 25 km/h
            const waitingTime = 6; // Average waiting time
            const totalCommuteTime = Math.round(baseCommuteTime + waitingTime);
            
            routeData.commute = {
                distance: distance,
                duration: totalCommuteTime
            };
        }

        return routeData;
    } catch (error) {
        console.error('Error fetching routes:', error);
        return null;
    }
}

function showManualRouteInfo(routeData) {
    let routeInfo = document.getElementById('route-info');
    const mapContainer = document.getElementById('map');
    
    if (!routeInfo) {
        routeInfo = document.createElement('div');
        routeInfo.id = 'route-info';
        routeInfo.className = 'route-info-box';
        if (mapContainer) {
            mapContainer.appendChild(routeInfo);
        } else {
            document.body.appendChild(routeInfo);
        }
    }

    // Store route data globally for traffic level switching
    currentRouteData = routeData;
    currentTrafficLevel = 'current';

    // Determine traffic condition
    const currentHour = new Date().getHours();
    const isPeakHours = (currentHour >= 6 && currentHour < 9) || (currentHour >= 17 && currentHour < 20);
    const trafficStatus = isPeakHours ? '🔴 Peak Traffic' : '🟢 Light Traffic';

    updateManualRouteDisplay('current', routeData);
}

function updateManualRouteDisplay(trafficLevel, routeData) {
    const routeInfo = document.getElementById('route-info');
    
    // Calculate times for selected traffic level
    let carData, motorcycleData, commuteData;
    
    if (trafficLevel === 'current') {
        // Calculate with current time multipliers
        const times = calculateTimesForTrafficLevel(routeData, 'current');
        carData = times.car || null;
        motorcycleData = times.motorcycle || null;
        commuteData = times.commute || null;
    } else {
        // Calculate for selected traffic level
        const times = calculateTimesForTrafficLevel(routeData, trafficLevel);
        carData = times.car || null;
        motorcycleData = times.motorcycle || null;
        commuteData = times.commute || null;
    }

    // Get traffic level info
    const currentHour = new Date().getHours();
    const isPeakHours = (currentHour >= 6 && currentHour < 9) || (currentHour >= 17 && currentHour < 20);
    const trafficStatusText = isPeakHours ? '🔴 Peak Traffic (Current)' : '🟢 Light Traffic (Current)';
    
    const levelInfo = getTrafficLevelInfo(trafficLevel);
    const displayStatus = trafficLevel === 'current' ? trafficStatusText : levelInfo.icon + ' ' + levelInfo.label;

    // Build vehicle cards HTML
    let vehicleCardsHTML = '';
    
    if (carData) {
        vehicleCardsHTML += `
            <div style="display: flex; align-items: center; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 8px; margin-bottom: 8px; backdrop-filter: blur(5px);">
                <div style="font-size: 24px; margin-right: 12px;">🚗</div>
                <div style="flex: 1;">
                    <div style="font-size: 12px; opacity: 0.85; font-weight: 600;">Car</div>
                    <div style="font-size: 16px; font-weight: 700; line-height: 1;">
                        ${carData.distance} km <span style="opacity: 0.8; font-size: 14px;">• ${carData.time} min</span>
                    </div>
                </div>
            </div>
        `;
    }

    if (motorcycleData) {
        vehicleCardsHTML += `
            <div style="display: flex; align-items: center; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 8px; margin-bottom: 8px; backdrop-filter: blur(5px);">
                <div style="font-size: 24px; margin-right: 12px;">🏍️</div>
                <div style="flex: 1;">
                    <div style="font-size: 12px; opacity: 0.85; font-weight: 600;">Motorcycle</div>
                    <div style="font-size: 16px; font-weight: 700; line-height: 1;">
                        ${motorcycleData.distance} km <span style="opacity: 0.8; font-size: 14px;">• ${motorcycleData.time} min</span>
                    </div>
                </div>
            </div>
        `;
    }

    if (commuteData) {
        vehicleCardsHTML += `
            <div style="display: flex; align-items: center; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 8px; backdrop-filter: blur(5px);">
                <div style="font-size: 24px; margin-right: 12px;">🚌</div>
                <div style="flex: 1;">
                    <div style="font-size: 12px; opacity: 0.85; font-weight: 600;">Public Transport</div>
                    <div style="font-size: 16px; font-weight: 700; line-height: 1;">
                        ${commuteData.distance} km <span style="opacity: 0.8; font-size: 14px;">• ${commuteData.time} min</span>
                    </div>
                </div>
            </div>
        `;
    }

    // Build traffic level buttons
    const trafficButtons = `
        <div style="display: flex; gap: 6px; margin-bottom: 10px;">
            <button onclick="updateManualDisplay('light')" style="flex: 1; padding: 8px 10px; background: ${trafficLevel === 'light' ? 'rgba(76, 175, 80, 0.8)' : 'rgba(255,255,255,0.15)'}; border: 1px solid rgba(255,255,255,0.3); color: white; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 12px; transition: all 0.2s ease;" onmouseover="this.style.background='rgba(76, 175, 80, 0.9)'" onmouseout="this.style.background='${trafficLevel === 'light' ? 'rgba(76, 175, 80, 0.8)' : 'rgba(255,255,255,0.15)'}'" title="Light traffic conditions">🟢 Light</button>
            <button onclick="updateManualDisplay('medium')" style="flex: 1; padding: 8px 10px; background: ${trafficLevel === 'medium' ? 'rgba(255, 193, 7, 0.8)' : 'rgba(255,255,255,0.15)'}; border: 1px solid rgba(255,255,255,0.3); color: white; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 12px; transition: all 0.2s ease;" onmouseover="this.style.background='rgba(255, 193, 7, 0.9)'" onmouseout="this.style.background='${trafficLevel === 'medium' ? 'rgba(255, 193, 7, 0.8)' : 'rgba(255,255,255,0.15)'}'" title="Medium traffic conditions">🟡 Medium</button>
            <button onclick="updateManualDisplay('heavy')" style="flex: 1; padding: 8px 10px; background: ${trafficLevel === 'heavy' ? 'rgba(255, 87, 34, 0.8)' : 'rgba(255,255,255,0.15)'}; border: 1px solid rgba(255,255,255,0.3); color: white; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 12px; transition: all 0.2s ease;" onmouseover="this.style.background='rgba(255, 87, 34, 0.9)'" onmouseout="this.style.background='${trafficLevel === 'heavy' ? 'rgba(255, 87, 34, 0.8)' : 'rgba(255,255,255,0.15)'}'" title="Heavy traffic conditions">🔴 Heavy</button>
        </div>
    `;

    routeInfo.innerHTML = `
        <div style="padding: 16px; background: linear-gradient(135deg, #059669 0%, #047857 100%); color: white; border-radius: 12px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; box-shadow: 0 8px 24px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.15); backdrop-filter: blur(10px); min-width: 300px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 12px;">
                <div>
                    <div style="font-size: 12px; opacity: 0.85; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; margin-bottom: 4px;">📍 Route Information</div>
                    <div style="font-size: 13px; opacity: 0.9;">Custom Route</div>
                </div>
                <button onclick="clearManualRoute()" style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.4); color: white; padding: 6px 8px; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 16px; transition: all 0.2s ease; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; flex-shrink: 0;" onmouseover="this.style.background='rgba(255,255,255,0.3)'; this.style.transform='scale(1.05)';" onmouseout="this.style.background='rgba(255,255,255,0.2)'; this.style.transform='scale(1)';">✕</button>
            </div>
            <div style="border-top: 1px solid rgba(255,255,255,0.2); padding-top: 12px; margin-bottom: 10px;">
                ${trafficButtons}
            </div>
            <div style="border-top: 1px solid rgba(255,255,255,0.2); padding-top: 12px;">
                ${vehicleCardsHTML}
            </div>
            <div style="font-size: 11px; opacity: 0.7; margin-top: 12px; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 8px;">
                Times calculated for selected traffic level. Motorcycle advantages included.
            </div>
        </div>
    `;
    routeInfo.style.display = 'block';
}

function updateManualDisplay(trafficLevel) {
    currentTrafficLevel = trafficLevel;
    if (currentRouteData) {
        updateManualRouteDisplay(trafficLevel, currentRouteData);
    }
}

function clearManualRoute() {
    if (fromPin) {
        fromPin.remove();
        fromPin = null;
    }
    if (toPin) {
        toPin.remove();
        toPin = null;
    }

    if (routeLine) {
        try {
            map.removeLayer('route-line');
            map.removeSource('route-source');
        } catch (e) {}
        routeLine = null;
    }

    const routeInfo = document.getElementById('route-info');
    if (routeInfo) {
        routeInfo.style.display = 'none';
    }

    showPinInfo();
}

function showPinInfo() {
    let pinInfo = document.getElementById('pin-info');
    
    if (!pinInfo) {
        pinInfo = document.createElement('div');
        pinInfo.id = 'pin-info';
        pinInfo.className = 'route-info-box';
        document.body.appendChild(pinInfo);
    }

    if (!fromPin && !toPin) {
        pinInfo.style.display = 'none';
        return;
    }

    let text = '';
    if (fromPin && !toPin) {
        text = '📍 Click map to set TO pin';
    } else if (fromPin && toPin) {
        text = '✅ Route calculated!';
    }

    pinInfo.innerHTML = `
        <div style="padding: 12px 15px; background: linear-gradient(135deg, #f97316, #ea580c); color: white; border-radius: 8px; font-weight: 500; box-shadow: 0 4px 12px rgba(0,0,0,0.2); font-size: 14px;">
            ${text}
        </div>
    `;
    pinInfo.style.display = 'block';
}

function createSchoolMarkerElement(schoolName) {
    const el = document.createElement('div');
    el.className = 'school-marker';
    el.innerHTML = `
        <div class="school-marker-icon" title="${schoolName}">
            <i class="fas fa-school"></i>
        </div>
    `;
    el.style.cursor = 'pointer';
    return el;
}

async function loadAndDisplaySchools() {
    try {
        const response = await fetch('/api/schools');
        const schoolsList = await response.json();
        
        clearSchoolMarkers();
        
        schoolsList.forEach(school => {
            const el = createSchoolMarkerElement(school.school_name);
            
            const schoolMarker = new maplibregl.Marker({ 
                element: el,
                anchor: 'center'
            })
                .setLngLat([school.lng, school.lat])
                .setPopup(new maplibregl.Popup({ 
                    offset: 25,
                    className: 'school-popup'
                }).setHTML(`
                    <div style="padding: 12px; text-align: left; min-width: 200px;">
                        <div style="font-weight: 600; color: #667eea; margin-bottom: 8px; font-size: 14px;">
                            <i class="fas fa-school"></i> ${school.school_name}
                        </div>
                        <div style="font-size: 12px; color: #666;">
                            <div><strong>Barangay:</strong> ${school.barangay}</div>
                            <div><strong>Type:</strong> ${school.type}</div>
                            <div style="margin-top: 8px; color: #999;">
                                Lat: ${school.lat.toFixed(4)}<br>
                                Lng: ${school.lng.toFixed(4)}
                            </div>
                        </div>
                    </div>
                `))
                .addTo(map);
            
            schoolMarkers.push(schoolMarker);
        });
        
        console.log(`✅ Loaded ${schoolsList.length} schools`);
    } catch (error) {
        console.error('Error loading schools:', error);
    }
}

function updateMap(metric, vizType) {
    clearMarkers();

    let sortedBarangays = Object.values(barangayData);
    
    switch(metric) {
        case 'high':
            sortedBarangays = sortedBarangays
                .filter(b => b.highPriorityCount > 0)
                .sort((a, b) => b.highPriorityCount - a.highPriorityCount);
            break;
        case 'medium':
            sortedBarangays = sortedBarangays
                .filter(b => b.mediumPriorityCount > 0)
                .sort((a, b) => b.mediumPriorityCount - a.mediumPriorityCount);
            break;
        case 'low':
            sortedBarangays = sortedBarangays
                .filter(b => b.lowPriorityCount > 0)
                .sort((a, b) => b.lowPriorityCount - a.lowPriorityCount);
            break;
        default:
            sortedBarangays = sortedBarangays
                .sort((a, b) => b.avgReadinessScore - a.avgReadinessScore);
    }

    const maxValue = Math.max(...sortedBarangays.map(b => {
        if (metric === 'high') return b.highPriorityCount;
        if (metric === 'medium') return b.mediumPriorityCount;
        if (metric === 'low') return b.lowPriorityCount;
        return b.avgReadinessScore;
    }));

    if (vizType === 'heatmap') {
        sortedBarangays.forEach(data => {
            const color = getColorForScore(data.avgReadinessScore);
            const radius = 800 + (data.total * 100);
            
            const size = 80;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const ctx = canvas.getContext('2d');
            
            const gradient = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
            gradient.addColorStop(0, color + '88');
            gradient.addColorStop(1, color + '00');
            
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, size, size);
            
            const el = document.createElement('div');
            el.style.width = `${radius/10}px`;
            el.style.height = `${radius/10}px`;
            el.style.backgroundImage = `url(${canvas.toDataURL()})`;
            el.style.backgroundSize = 'cover';
            el.style.cursor = 'pointer';
            el.style.transition = 'transform 0.3s ease';
            
            el.addEventListener('mouseenter', () => {
                el.style.transform = 'scale(1.1)';
            });
            el.addEventListener('mouseleave', () => {
                el.style.transform = 'scale(1)';
            });
            
            // Add click handler for DSS integration
            el.addEventListener('click', () => {
                selectedBarangayName = data.barangay;
                // Dispatch custom event for DSS panel
                document.dispatchEvent(new CustomEvent('barangaySelected', {
                    detail: { barangay: data.barangay }
                }));
                // If DSS panel is open, load analysis
                if (window.dssPanel && window.dssPanel.isOpen) {
                    window.dssPanel.loadAnalysisForCurrentLocation();
                }
            });
            
            const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
                .setLngLat([data.lng, data.lat])
                .setPopup(new maplibregl.Popup({ 
                    offset: [0, -10],
                    maxWidth: '400px',
                    className: 'modern-popup',
                    closeButton: true,
                    closeOnClick: false
                }).setHTML(createPopup(data)))
                .addTo(map);
            
            // Center map when popup opens
            marker.getPopup().on('open', () => {
                map.easeTo({
                    center: [data.lng, data.lat],
                    duration: 300,
                    padding: { right: 400 }
                });
            });
            
            marker.barangayName = data.barangay;
            marker.popup = marker.getPopup();
            allMarkers.push(marker);
        });
    } else {
        sortedBarangays.forEach(data => {
            let value, color, markerEl;
            
            if (metric === 'high') {
                value = data.highPriorityCount;
                color = '#4CAF50';
            } else if (metric === 'medium') {
                value = data.mediumPriorityCount;
                color = '#FFC107';
            } else if (metric === 'low') {
                value = data.lowPriorityCount;
                color = '#FF5722';
            } else {
                value = data.avgReadinessScore;
                color = getColorForScore(value);
            }

            if (vizType === 'pins') {
                markerEl = createPinMarkerElement(color, value);
            } else if (vizType === 'badges') {
                markerEl = createBadgeMarkerElement(color, value);
            } else if (vizType === 'bars') {
                markerEl = createBarMarkerElement(color, value, maxValue);
            }

            const marker = new maplibregl.Marker({ element: markerEl, anchor: 'bottom' })
                .setLngLat([data.lng, data.lat])
                .addTo(map);
            
            // Click handler to show modal instead of popup
            markerEl.addEventListener('click', (e) => {
                e.stopPropagation();
                showBarangayModal(data);
                selectedBarangayName = data.barangay;
                // Dispatch custom event for DSS panel
                document.dispatchEvent(new CustomEvent('barangaySelected', {
                    detail: { barangay: data.barangay }
                }));
                // If DSS panel is open, load analysis
                if (window.dssPanel && window.dssPanel.isOpen) {
                    window.dssPanel.loadAnalysisForCurrentLocation();
                }
            });
            
            allMarkers.push(marker);
        });
    }

    updateSidebar(metric, sortedBarangays);
}

function createPopup(data) {
    const learnersHtml = data.learnerScores
        .map(({learner, score}) => {
            const scoreColor = getColorForScore(score);
            const scoreColorDark = scoreColor + 'dd';
            return `
                <div class="learner-card" style="border-left-color: ${scoreColor};">
                    <div class="learner-header">
                        <div class="learner-info">
                            <div class="learner-name">
                                ${learner.first_name} ${learner.middle_name ? learner.middle_name.charAt(0) + '. ' : ''}${learner.last_name}
                            </div>
                            <div class="learner-badges">
                                <span class="learner-badge">${learner.age || 'N/A'} yrs</span>
                                <span class="learner-badge">${learner.sex || 'N/A'}</span>
                            </div>
                        </div>
                        <div class="learner-score" style="--score-color: ${scoreColor}; --score-color-dark: ${scoreColorDark};">
                            <div class="learner-score-value">${score}</div>
                        </div>
                    </div>
                    
                    <div class="learner-address">
                        <div class="address-value">${learner.house_number || 'N/A'}, ${learner.street || 'N/A'}</div>
                        <div class="address-value">${learner.sitio_purok || 'N/A'}</div>
                    </div>
                </div>
            `;
        })
        .join('');

    // Calculate completion and dropout rates for summary
    const totalLearners = data.total;
    const completionRate = data.learnerScores.length > 0 ? Math.round((data.enrolled / totalLearners) * 100) : 0;

    return `
        <div class="popup-container">
            <div class="popup-header">
                <div class="popup-title">
                    <i class="fas fa-map-pin"></i>
                    ${data.barangay}
                </div>
                
                <div class="popup-stats-grid">
                    <div class="popup-stat-card">
                        <div class="popup-stat-label">Total</div>
                        <div class="popup-stat-value">${data.total}</div>
                    </div>
                    <div class="popup-stat-card">
                        <div class="popup-stat-label">Enrolled</div>
                        <div class="popup-stat-value">${data.enrolled}</div>
                    </div>
                    <div class="popup-stat-card high-priority">
                        <div class="popup-stat-label">High</div>
                        <div class="popup-stat-value">${data.highPriorityCount}</div>
                    </div>
                    <div class="popup-stat-card medium-priority">
                        <div class="popup-stat-label">Medium</div>
                        <div class="popup-stat-value">${data.mediumPriorityCount}</div>
                    </div>
                </div>

                <div class="popup-rate-bars">
                    <div class="popup-rate-item">
                        <div class="popup-rate-label">Enrollment Rate</div>
                        <div class="popup-rate-bar">
                            <div class="popup-rate-fill" style="width: ${completionRate}%; background: linear-gradient(90deg, #4CAF50, #45a049);"></div>
                        </div>
                        <div class="popup-rate-value">${completionRate}%</div>
                    </div>
                </div>
                
                <button onclick="focusAndScrollToBarangay('${data.barangay}', ${data.lat}, ${data.lng})" class="popup-view-btn">
                    <i class="fas fa-list-ul"></i>
                    View Details in Sidebar
                </button>
            </div>

            <div class="popup-learners-container">
                ${learnersHtml || '<div class="popup-empty"><i class="fas fa-info-circle"></i> No learners found</div>'}
            </div>
        </div>
    `;
}

function focusAndScrollToBarangay(name, lat, lng) {
    focusBarangay(name, lat, lng);
    
    const barangayElements = document.querySelectorAll('.barangay-stat');
    barangayElements.forEach(el => {
        const nameEl = el.querySelector('.barangay-name');
        if (nameEl && nameEl.textContent.includes(name)) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            el.style.transition = 'background-color 0.3s';
            el.style.backgroundColor = '#667eea20';
            setTimeout(() => {
                el.style.backgroundColor = '';
            }, 2000);
        }
    });
}

function updateSidebar(metric, sortedData) {
    const titles = {
        'readiness': 'Top Priority Areas (By Readiness)',
        'high': 'High Priority Areas',
        'medium': 'Medium Priority Areas',
        'low': 'Low Priority Areas'
    };

    // Update modal header instead of sidebar
    const modalHeader = document.querySelector('.priority-modal-header h3');
    if (modalHeader) {
        modalHeader.textContent = '⭐ ' + titles[metric];
    }

    const topAreas = sortedData.slice(0, 10);
    let html = '';

    if (topAreas.length === 0) {
        html = '<div class="loading">No data available for this category</div>';
    } else {
        topAreas.forEach(data => {
            let label, value;
            
            switch(metric) {
                case 'high':
                    value = data.highPriorityCount;
                    label = `${value} high priority learners`;
                    break;
                case 'medium':
                    value = data.mediumPriorityCount;
                    label = `${value} medium priority learners`;
                    break;
                case 'low':
                    value = data.lowPriorityCount;
                    label = `${value} low priority learners`;
                    break;
                default:
                    value = data.avgReadinessScore;
                    label = `Readiness Score: ${value}/100`;
            }

            const priority = data.tier;

            html += `
                <div class="barangay-stat ${priority}" onclick="focusBarangay('${data.barangay}', ${data.lat}, ${data.lng})">
                    <div class="barangay-name">${data.barangay}</div>
                    <div class="stat-detail">
                        <span>${label}</span>
                        <span class="stat-value">${data.enrolled}/${data.total} enrolled</span>
                    </div>
                    <div style="font-size: 11px; color: #666; margin-top: 5px;">
                        H: ${data.highPriorityCount} | M: ${data.mediumPriorityCount} | L: ${data.lowPriorityCount}
                    </div>
                </div>
            `;
        });
    }

    document.getElementById('statistics').innerHTML = html;
}

function focusBarangay(name, lat, lng) {
    map.flyTo({
        center: [lng, lat],
        zoom: 14,
        duration: 1500,
        essential: true
    });
}

async function fetchLearners() {
    try {
        const response = await fetch('/api/af1-learners');
        const data = await response.json();
        
        barangayData = calculateBarangayMetrics(data);
        updateMap(currentMetric, currentViz);
        initializeSearch();
        
        // Re-enable controls after data is loaded
        document.querySelector('.analytics-controls').style.opacity = '1';
        document.querySelector('.analytics-controls').style.pointerEvents = 'auto';
        console.log('✅ Barangay data loaded and controls enabled');
    } catch (error) {
        console.error('Error fetching learners:', error);
        document.getElementById('statistics').innerHTML = 
            '<div class="loading" style="color: red;">Error loading data</div>';
        // Still enable controls even if data fails to load
        document.querySelector('.analytics-controls').style.opacity = '1';
        document.querySelector('.analytics-controls').style.pointerEvents = 'auto';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        window.location.href = '/';
        return;
    }

    document.getElementById('instructorName').textContent = `Welcome, ${user.username}`;

    initMap();
    // fetchLearners is now called from addUserLocation() after user location is obtained

    document.querySelectorAll('.metric-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.metric-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMetric = btn.dataset.metric;
            updateMap(currentMetric, currentViz);
        });
    });

    document.querySelectorAll('.viz-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.viz-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentViz = btn.dataset.viz;
            updateMap(currentMetric, currentViz);
        });
    });

    // Coordinate Pin functionality
    const addCoordinatePinBtn = document.getElementById('addCoordinatePin');
    const clearCoordinatePinBtn = document.getElementById('clearCoordinatePin');
    const coordinateInput = document.getElementById('coordinateInput');

    if (addCoordinatePinBtn) {
        addCoordinatePinBtn.addEventListener('click', () => {
            const input = coordinateInput.value.trim();

            // Parse coordinates from string format "lat, lng"
            const parts = input.split(',').map(p => parseFloat(p.trim()));

            if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) {
                alert('Please enter coordinates in format: latitude, longitude\nExample: 14.271480728685514, 121.37759101164204');
                return;
            }

            const lat = parts[0];
            const lng = parts[1];

            // Validate latitude range (-90 to 90)
            if (lat < -90 || lat > 90) {
                alert('Latitude must be between -90 and 90.');
                return;
            }

            // Validate longitude range (-180 to 180)
            if (lng < -180 || lng > 180) {
                alert('Longitude must be between -180 and 180.');
                return;
            }

            addCoordinatePin(lat, lng);
        });
    }

    if (clearCoordinatePinBtn) {
        clearCoordinatePinBtn.addEventListener('click', () => {
            removeCoordinatePin();
        });
    }

    // Allow Enter key to add pin
    if (coordinateInput) {
        coordinateInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addCoordinatePinBtn.click();
            }
        });
    }

    // Schools toggle button
    const toggleSchoolsBtn = document.getElementById('toggleSchools');
    if (toggleSchoolsBtn) {
        toggleSchoolsBtn.addEventListener('click', () => {
            showSchools = !showSchools;
            toggleSchoolsBtn.classList.toggle('active');
            
            if (showSchools) {
                loadAndDisplaySchools();
                console.log('✅ Schools displayed');
            } else {
                clearSchoolMarkers();
                console.log('🚫 Schools hidden');
            }
        });
    }

    // Routing functionality
    const toggleRouteBtn = document.getElementById('toggle-route-btn');
    if (toggleRouteBtn) {
        toggleRouteBtn.addEventListener('click', () => {
            if (!routingEnabled) {
                // First click: Enable routing in AUTO mode
                routingEnabled = true;
                routeMode = 'auto';
                toggleRouteBtn.classList.add('active');
                toggleRouteBtn.innerHTML = '<i class="fas fa-route"></i> Route (Auto)';
                console.log('✅ Routing enabled (AUTO) - click on map to set destination');
            } else if (routeMode === 'auto') {
                // Second click: Switch to MANUAL mode
                routeMode = 'manual';
                clearRoute();
                toggleRouteBtn.innerHTML = '<i class="fas fa-route"></i> Route (F→T)';
                console.log('✅ Switched to MANUAL mode - click to set FROM pin, then TO pin');
            } else {
                // Third click: Disable routing
                routingEnabled = false;
                clearRoute();
                clearManualRoute();
                toggleRouteBtn.classList.remove('active');
                toggleRouteBtn.innerHTML = '<i class="fas fa-route"></i> Route';
                routeMode = 'auto';
                console.log('🚫 Routing disabled');
            }
        });
    }

    // Map click handler for setting destination
    map.on('click', (e) => {
        if (routingEnabled) {
            const lngLat = e.lngLat;
            
            if (routeMode === 'auto' && userLocation) {
                // Auto mode: from current location to clicked point
                setDestination(lngLat.lat, lngLat.lng);
            } else if (routeMode === 'manual') {
                // Manual mode: set FROM and TO pins
                if (!fromPin) {
                    setFromPin(lngLat.lat, lngLat.lng);
                } else if (!toPin) {
                    setToPin(lngLat.lat, lngLat.lng);
                }
            }
        }
    });

    // Priority Areas Modal
    const priorityBtn = document.getElementById('priorityAreasBtn');
    const priorityModal = document.getElementById('priorityModal');
    const closeModalBtn = document.getElementById('closePriorityModal');
    const modalOverlay = document.querySelector('.priority-modal-overlay');

    if (priorityBtn) {
        priorityBtn.addEventListener('click', () => {
            priorityModal.classList.add('active');
        });
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            priorityModal.classList.remove('active');
        });
    }

    if (modalOverlay) {
        modalOverlay.addEventListener('click', () => {
            priorityModal.classList.remove('active');
        });
    }

    // Barangay Modal
    const barangayModal = document.getElementById('barangayModal');
    const closeBarangayBtn = document.getElementById('closeBarangayModal');
    const barangayModalOverlay = barangayModal.querySelector('.barangay-modal-overlay');

    if (closeBarangayBtn) {
        closeBarangayBtn.addEventListener('click', () => {
            barangayModal.classList.remove('active');
        });
    }

    if (barangayModalOverlay) {
        barangayModalOverlay.addEventListener('click', () => {
            barangayModal.classList.remove('active');
        });
    }

    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            const page = tab.dataset.page;
            if (page === 'logout') {
                if (confirm('Are you sure you want to logout?')) {
                    localStorage.removeItem('user');
                    window.location.href = '/';
                }
                return false;
            }
            window.location.href = `/instructor_${page}`;
        });
    });
});

window.focusBarangay = focusBarangay;
window.focusAndScrollToBarangay = focusAndScrollToBarangay;

// Show barangay modal instead of popup
function showBarangayModal(data) {
    const modal = document.getElementById('barangayModal');
    const title = document.getElementById('barangayModalTitle');
    const body = document.getElementById('barangayModalBody');
    
    title.innerHTML = `<i class="fas fa-map-pin"></i> ${data.barangay}`;
    body.innerHTML = createPopup(data);
    modal.classList.add('active');
}

// Hybrid search function - search on Google Maps if not in local database
function searchGoogleMaps(query) {
    const searchLocation = `${query}, Santa Cruz, Laguna, Philippines`;
    const googleMapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchLocation)}`;
    window.open(googleMapsUrl, '_blank');
}