        const currentYear = new Date().getFullYear();
        let map;

        // Accurate Santa Cruz Barangay Coordinates
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

        // Helper function to get barangay coordinates
        function getBarangayCoordinates(barangayName) {
            const barangay = santaCruzBarangays.find(b => b.name === barangayName);
            return barangay || null;
        }

        // Initialize map
        function initMap() {
            map = L.map('mini-map').setView([14.2818099, 121.414977], 12);
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 18
            }).addTo(map);
        }

        // Calculate enrollment readiness score
        function calculateEnrollmentReadiness(learner) {
            let score = 0;
            let breakdown = {
                interest: 0,
                recency: 0,
                status: 0,
                age: 0,
                educationGap: 0
            };
            
            // 1. Interest Level (30 points max)
            if (learner.interested_in_als === true) {
                breakdown.interest = 30;
                score += 30;
            }
            
            // 2. Recency of Data (20 points max)
            const yearsSinceCreated = currentYear - (learner.calendar_year || currentYear);
            if (yearsSinceCreated === 0) {
                breakdown.recency = 20;
                score += 20;
            } else if (yearsSinceCreated === 1) {
                breakdown.recency = 15;
                score += 15;
            } else if (yearsSinceCreated === 2) {
                breakdown.recency = 10;
                score += 10;
            } else {
                breakdown.recency = 5;
                score += 5;
            }
            
            // 3. Current Status (25 points max)
            const status = learner.als_status || '';
            const dropoutReason = learner.dropout_reason || '';
            
            if (status === 'Not Enrolled' && learner.interested_in_als) {
                breakdown.status = 25;
                score += 25;
            } else if (status === 'Dropped' && 
                       (dropoutReason.toLowerCase().includes('want') || 
                        dropoutReason.toLowerCase().includes('return'))) {
                breakdown.status = 20;
                score += 20;
            }
            
            // 4. Age Appropriateness (15 points max)
            const age = learner.age || 0;
            if (age >= 15 && age <= 30) {
                breakdown.age = 15;
                score += 15;
            } else if (age >= 10 && age <= 40) {
                breakdown.age = 10;
                score += 10;
            } else if (age >= 6 && age <= 60) {
                breakdown.age = 5;
                score += 5;
            }
            
            // 5. Educational Gap (10 points max)
            const yearsSinceLastAttended = currentYear - (learner.year_last_attended || currentYear);
            if (yearsSinceLastAttended <= 2) {
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
            
            return { score, breakdown };
        }

        // Create pin marker function
        function createPinMarker(lat, lng, color, value) {
            const icon = L.divIcon({
                className: 'custom-div-icon',
                html: `
                    <div style="
                        position: relative;
                        width: 35px;
                        height: 45px;
                    ">
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
                    </div>
                `,
                iconSize: [35, 45],
                iconAnchor: [17.5, 45],
                popupAnchor: [0, -45]
            });
            
            return L.marker([lat, lng], { icon });
        }

        // Fetch and process dashboard data
        async function loadDashboardData() {
            try {
                // Fetch both learners and AF1 data
                const [learnersRes, af1Res] = await Promise.all([
                    fetch('/api/learners'),
                    fetch('/api/af1-learners')
                ]);

                const learners = await learnersRes.json();
                const af1Learners = await af1Res.json();

                // Calculate readiness scores for AF1 learners
                const scoredLearners = af1Learners.map(l => {
                    const { score, breakdown } = calculateEnrollmentReadiness(l);
                    return { ...l, readinessScore: score, breakdown };
                });

                // Update statistics
                const totalLearners = learners.length;
                const highPriorityCount = scoredLearners.filter(l => l.readinessScore >= 70).length;
                const mediumPriorityCount = scoredLearners.filter(l => l.readinessScore >= 40 && l.readinessScore < 70).length;
                const lowPriorityCount = scoredLearners.filter(l => l.readinessScore < 40).length;
                const avgReadiness = scoredLearners.length > 0 
                    ? Math.round(scoredLearners.reduce((sum, l) => sum + l.readinessScore, 0) / scoredLearners.length)
                    : 0;

                const uniqueBarangays = new Set(learners.map(l => l.barangay).filter(b => b));

                document.getElementById('totalLearners').textContent = totalLearners;
                document.getElementById('highPriority').textContent = highPriorityCount;
                document.getElementById('avgReadiness').textContent = avgReadiness;
                document.getElementById('activeBarangays').textContent = uniqueBarangays.size;

                // Update readiness chart with percentages and counts
                const totalScored = highPriorityCount + mediumPriorityCount + lowPriorityCount;
                const highPercent = totalScored > 0 ? Math.round((highPriorityCount / totalScored) * 100) : 0;
                const mediumPercent = totalScored > 0 ? Math.round((mediumPriorityCount / totalScored) * 100) : 0;
                const lowPercent = totalScored > 0 ? Math.round((lowPriorityCount / totalScored) * 100) : 0;
                
                const maxCount = Math.max(highPriorityCount, mediumPriorityCount, lowPriorityCount, 1);
                setTimeout(() => {
                    document.getElementById('highChart').style.width = `${(highPriorityCount / maxCount) * 100}%`;
                    document.getElementById('highChart').textContent = `${highPriorityCount} (${highPercent}%)`;
                    document.getElementById('mediumChart').style.width = `${(mediumPriorityCount / maxCount) * 100}%`;
                    document.getElementById('mediumChart').textContent = `${mediumPriorityCount} (${mediumPercent}%)`;
                    document.getElementById('lowChart').style.width = `${(lowPriorityCount / maxCount) * 100}%`;
                    document.getElementById('lowChart').textContent = `${lowPriorityCount} (${lowPercent}%)`;
                }, 100);

                // Add markers to map
                addMapMarkers(scoredLearners);

            } catch (error) {
                console.error('Error loading dashboard data:', error);
            }
        }

        function displayPriorityLearners(learners) {
            const highPriority = learners
                .filter(l => l.readinessScore >= 70)
                .sort((a, b) => b.readinessScore - a.readinessScore)
                .slice(0, 5);

            const html = highPriority.length > 0 
                ? highPriority.map(l => `
                    <div class="priority-item">
                        <div class="priority-info">
                            <div class="priority-name">${l.first_name} ${l.last_name}</div>
                            <div class="priority-details">
                                📍 ${l.barangay || 'Unknown'} | 
                                ${l.age ? `${l.age} yrs` : 'N/A'} | 
                                Status: ${l.als_status || 'Unknown'}
                            </div>
                        </div>
                        <div class="priority-score">${l.readinessScore}</div>
                        <button class="contact-btn" onclick="contactLearner('${l.first_name} ${l.last_name}')">
                            <i class="fas fa-phone"></i> Contact
                        </button>
                    </div>
                `).join('')
                : '<div class="loading">No high-priority learners at this time</div>';

            document.getElementById('priorityList').innerHTML = html;
        }

        function displayBarangayHotspots(learners) {
            const barangayScores = {};

            learners.forEach(l => {
                const brgy = l.barangay || 'Unknown';
                if (!barangayScores[brgy]) {
                    barangayScores[brgy] = { 
                        total: 0, 
                        highPriority: 0,
                        mediumPriority: 0,
                        lowPriority: 0,
                        totalScore: 0 
                    };
                }
                barangayScores[brgy].total++;
                barangayScores[brgy].totalScore += l.readinessScore;
                if (l.readinessScore >= 70) {
                    barangayScores[brgy].highPriority++;
                } else if (l.readinessScore >= 40) {
                    barangayScores[brgy].mediumPriority++;
                } else {
                    barangayScores[brgy].lowPriority++;
                }
            });

            // Sort by total enrollment potential (most populous first) as these represent biggest opportunities
            const sortedBarangays = Object.entries(barangayScores)
                .map(([name, data]) => ({
                    name,
                    ...data,
                    avgScore: Math.round(data.totalScore / data.total),
                    readyPercent: Math.round((data.highPriority / data.total) * 100)
                }))
                .sort((a, b) => {
                    // Primary sort: by total learners (largest potential)
                    if (b.total !== a.total) return b.total - a.total;
                    // Secondary sort: by average readiness score if same population
                    return b.avgScore - a.avgScore;
                })
                .slice(0, 5);

            const html = sortedBarangays.map((b, idx) => {
                const readinessColor = b.avgScore >= 70 ? '#4CAF50' : b.avgScore >= 40 ? '#FFC107' : '#FF5722';
                return `
                    <div class="hotspot-item" onclick="focusBarangay('${b.name}')" style="border-left: 4px solid ${readinessColor};">
                        <div class="hotspot-header">
                            <div class="hotspot-rank" style="background: ${readinessColor}; color: white; padding: 2px 8px; border-radius: 12px; font-weight: bold; font-size: 12px;">#${idx + 1}</div>
                            <div class="hotspot-name" style="font-size: 16px; font-weight: 600;">${b.name}</div>
                        </div>
                        <div class="hotspot-stats" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 8px; padding-top: 8px; border-top: 1px solid #eee;">
                            <div style="text-align: center;">
                                <div style="font-size: 18px; font-weight: 700; color: ${readinessColor};">${b.total}</div>
                                <div style="font-size: 12px; color: #666;">Total Learners</div>
                            </div>
                            <div style="text-align: center;">
                                <div style="font-size: 18px; font-weight: 700; color: #667eea;">${b.readyPercent}%</div>
                                <div style="font-size: 12px; color: #666;">High Priority</div>
                            </div>
                            <div style="text-align: center;">
                                <div style="font-size: 18px; font-weight: 700; color: #9C27B0;">${b.avgScore}</div>
                                <div style="font-size: 12px; color: #666;">Avg Score</div>
                            </div>
                            <div style="text-align: center;">
                                <div style="font-size: 12px; color: #666;"><i class="fas fa-arrow-right"></i> View on Map</div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            document.getElementById('hotspotList').innerHTML = html || '<div class="loading">No data available</div>';
        }

        function addMapMarkers(learners) {
            // Group learners by barangay
            const barangayClusters = {};

            learners.forEach(l => {
                const brgy = l.barangay || 'Unknown';
                if (!barangayClusters[brgy]) {
                    // Get accurate coordinates from barangay list
                    const barangayCoords = getBarangayCoordinates(brgy);
                    barangayClusters[brgy] = {
                        name: brgy,
                        lat: barangayCoords ? barangayCoords.lat : l.lat,
                        lng: barangayCoords ? barangayCoords.lng : l.lng,
                        learners: [],
                        highPriority: 0,
                        mediumPriority: 0,
                        lowPriority: 0,
                        totalScore: 0
                    };
                }
                
                barangayClusters[brgy].learners.push(l);
                barangayClusters[brgy].totalScore += l.readinessScore;
                
                if (l.readinessScore >= 70) {
                    barangayClusters[brgy].highPriority++;
                } else if (l.readinessScore >= 40) {
                    barangayClusters[brgy].mediumPriority++;
                } else {
                    barangayClusters[brgy].lowPriority++;
                }
            });

            // Add pin markers for each barangay
            Object.values(barangayClusters).forEach(cluster => {
                if (cluster.lat && cluster.lng && cluster.learners.length > 0) {
                    const avgScore = Math.round(cluster.totalScore / cluster.learners.length);
                    
                    // Determine color based on average score
                    let color;
                    if (avgScore >= 70) color = '#FF5722';
                    else if (avgScore >= 40) color = '#FFC107';
                    else color = '#4CAF50';
                    
                    // Create pin marker with total learner count
                    const marker = createPinMarker(
                        cluster.lat, 
                        cluster.lng, 
                        color, 
                        cluster.learners.length
                    );
                    
                    // Tooltip (shows on hover)
                    marker.bindTooltip(`
                        <strong>${cluster.name}</strong><br>
                        🔥 ${cluster.highPriority} high priority
                    `, {
                        permanent: false,
                        direction: 'top'
                    });
                    
                    // Popup (shows on click)
                    marker.bindPopup(`
                        <div style="min-width: 200px;">
                            <strong style="font-size: 16px;">${cluster.name}</strong><br>
                            <hr style="margin: 8px 0;">
                            <strong>Total People:</strong> ${cluster.learners.length}<br>
                            <strong>Avg Score:</strong> <span style="color: ${color}; font-weight: bold;">${avgScore}/100</span><br>
                            <hr style="margin: 8px 0;">
                            <div style="margin: 5px 0;">
                                🔴 High Priority: <strong>${cluster.highPriority}</strong>
                            </div>
                            <div style="margin: 5px 0;">
                                🟡 Medium Priority: <strong>${cluster.mediumPriority}</strong>
                            </div>
                            <div style="margin: 5px 0;">
                                🟢 Low Priority: <strong>${cluster.lowPriority}</strong>
                            </div>
                            <hr style="margin: 8px 0;">
                            <button onclick="focusBarangay('${cluster.name}')" style="
                                width: 100%;
                                padding: 8px;
                                background: #667eea;
                                color: white;
                                border: none;
                                border-radius: 4px;
                                cursor: pointer;
                                font-size: 12px;
                            ">View Full Details</button>
                        </div>
                    `);
                    
                    marker.addTo(map);
                }
            });
        }

        function focusBarangay(name) {
            window.location.href = '/instructor_mapping?focus=' + encodeURIComponent(name);
        }

        function navigateToMapping() {
            window.location.href = '/instructor_mapping';
        }

        function contactLearner(name) {
            alert(`Initiating contact with ${name}...`);
        }

        // Initialize on page load
        document.addEventListener('DOMContentLoaded', () => {
            const user = JSON.parse(localStorage.getItem('user'));
            if (!user) {
                window.location.href = '/';
                return;
            }

            document.getElementById('instructorName').textContent = `Welcome, ${user.username}`;

            initMap();
            loadDashboardData();

            // Navigation
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
