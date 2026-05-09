/**
 * DSS Frontend Module for ALS Mapping System
 * Integrates Decision Support System insights into the mapping interface
 * 
 * Add this to instructor_mapping.html in a <script> tag:
 * <script src="../JS/dss_frontend.js"></script>
 */

// ==================== DSS FRONTEND MODULE ====================

class ALSDSSPanel {
    constructor() {
        this.isOpen = false;
        this.currentAnalysis = null;
        this.recommendations = [];
        this.lastLoadedBarangay = null;  // Track last loaded barangay for change detection
        this.init();
    }

    /**
     * Initialize DSS panel in the UI
     */
    init() {
        this.createDSSPanel();
        this.attachEventListeners();
    }

    /**
     * Create DSS panel HTML structure
     */
    createDSSPanel() {
        // Create DSS toggle button
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'dss-toggle-btn';
        toggleBtn.className = 'dss-toggle-btn';
        toggleBtn.title = 'Toggle Decision Support System Panel';
        toggleBtn.innerHTML = `
            <i class="fas fa-lightbulb"></i>
            <span class="dss-badge">DSS</span>
        `;

        // Create DSS panel container
        const panel = document.createElement('div');
        panel.id = 'dss-panel';
        panel.className = 'dss-panel';
        panel.innerHTML = `
            <div class="dss-panel-header">
                <h3><i class="fas fa-brain"></i> Decision Support System</h3>
                <button class="dss-close-btn" id="dss-close-btn">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            
            <div class="dss-panel-content">
                <!-- Tabs -->
                <div class="dss-tabs">
                    <button class="dss-tab-btn active" data-tab="overview">
                        <i class="fas fa-chart-pie"></i> Overview
                    </button>
                    <button class="dss-tab-btn" data-tab="learners">
                        <i class="fas fa-users"></i> Learners
                    </button>
                    <button class="dss-tab-btn" data-tab="barriers">
                        <i class="fas fa-exclamation-circle"></i> Barriers
                    </button>
                    <button class="dss-tab-btn" data-tab="recommendations">
                        <i class="fas fa-tasks"></i> Recommendations
                    </button>
                    <button class="dss-tab-btn" data-tab="forecast">
                        <i class="fas fa-chart-line"></i> Forecast
                    </button>
                </div>

                <!-- Tab Contents -->
                <div class="dss-tabs-content">
                    <!-- Overview Tab -->
                    <div id="overview-tab" class="dss-tab-content active">
                        <div class="dss-loading">
                            <i class="fas fa-spinner fa-spin"></i> Loading analysis...
                        </div>
                    </div>

                    <!-- Learners Tab -->
                    <div id="learners-tab" class="dss-tab-content">
                        <div class="dss-loading">
                            <i class="fas fa-spinner fa-spin"></i> Loading learner profiles...
                        </div>
                    </div>

                    <!-- Barriers Tab -->
                    <div id="barriers-tab" class="dss-tab-content">
                        <div class="dss-loading">
                            <i class="fas fa-spinner fa-spin"></i> Loading barrier analysis...
                        </div>
                    </div>

                    <!-- Recommendations Tab -->
                    <div id="recommendations-tab" class="dss-tab-content">
                        <div class="dss-loading">
                            <i class="fas fa-spinner fa-spin"></i> Loading recommendations...
                        </div>
                    </div>

                    <!-- Forecast Tab -->
                    <div id="forecast-tab" class="dss-tab-content">
                        <div class="dss-loading">
                            <i class="fas fa-spinner fa-spin"></i> Loading forecast...
                        </div>
                    </div>
                </div>
            </div>

            <div class="dss-panel-footer">
                <button class="dss-export-btn" id="dss-export-btn">
                    <i class="fas fa-download"></i> Export Report
                </button>
                <button class="dss-refresh-btn" id="dss-refresh-btn">
                    <i class="fas fa-sync"></i> Refresh
                </button>
            </div>
        `;

        // Add to page
        const mapContainer = document.getElementById('map');
        if (mapContainer) {
            mapContainer.appendChild(toggleBtn);
        } else {
            const dssContainer = document.getElementById('dss-button-container');
            if (dssContainer) {
                dssContainer.appendChild(toggleBtn);
            } else {
                const mainContent = document.querySelector('.main-content') || document.body;
                mainContent.insertBefore(toggleBtn, mainContent.firstChild);
            }
        }
        const mapContainerParent = document.querySelector('.map-container');
        if (mapContainerParent) {
            mapContainerParent.appendChild(panel);
        } else {
            const mainContent = document.querySelector('.main-content') || document.body;
            mainContent.appendChild(panel);
        }
    }

    /**
     * Attach event listeners
     */
    attachEventListeners() {
        // Toggle button
        document.getElementById('dss-toggle-btn').addEventListener('click', () => this.toggle());
        document.getElementById('dss-close-btn').addEventListener('click', () => this.close());

        // Tabs
        document.querySelectorAll('.dss-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Footer buttons
        document.getElementById('dss-export-btn').addEventListener('click', () => this.exportReport());
        document.getElementById('dss-refresh-btn').addEventListener('click', () => this.refreshAnalysis());

        // Listen for barangay changes via custom event
        document.addEventListener('barangaySelected', (e) => {
            this.onBarangayChanged(e.detail.barangay);
        });

        // Fallback: poll for barangay changes every 500ms if panel is open
        this.barangayChangeWatcher = setInterval(() => {
            if (this.isOpen) {
                const currentBarangay = this.getSelectedBarangay();
                if (currentBarangay && this.lastLoadedBarangay !== currentBarangay) {
                    this.loadAnalysisForCurrentLocation();
                    this.lastLoadedBarangay = currentBarangay;
                }
            }
        }, 500);
    }

    /**
     * Handle barangay selection change
     */
    onBarangayChanged(barangay) {
        if (barangay && this.lastLoadedBarangay !== barangay) {
            this.lastLoadedBarangay = barangay;
            // If panel is open or if we have current analysis, reload it
            if (this.isOpen || this.currentAnalysis) {
                this.loadAnalysisForCurrentLocation();
            }
        }
    }

    /**
     * Toggle panel visibility
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    /**
     * Open panel
     */
    open() {
        document.getElementById('dss-panel').classList.add('open');
        document.getElementById('dss-toggle-btn').classList.add('active');
        this.isOpen = true;

        // Load analysis if not already loaded
        if (!this.currentAnalysis) {
            this.loadAnalysisForCurrentLocation();
        }
    }

    /**
     * Close panel
     */
    close() {
        document.getElementById('dss-panel').classList.remove('open');
        document.getElementById('dss-toggle-btn').classList.remove('active');
        this.isOpen = false;
    }

    /**
     * Switch between tabs
     */
    switchTab(tabName) {
        // Deactivate all tabs
        document.querySelectorAll('.dss-tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.dss-tab-content').forEach(content => content.classList.remove('active'));

        // Activate selected tab
        const btn = document.querySelector(`[data-tab="${tabName}"]`);
        if (btn) btn.classList.add('active');
        
        const tabContent = document.getElementById(`${tabName}-tab`);
        if (tabContent) tabContent.classList.add('active');

        // Load content if needed
        this.loadTabContent(tabName);
    }

    /**
     * Load analysis for currently selected location on map
     */
    async loadAnalysisForCurrentLocation() {
        try {
            // Get selected barangay from map
            const selectedBarangay = this.getSelectedBarangay();
            if (!selectedBarangay) {
                this.showMessage('Select a barangay on the map to view DSS analysis.');
                return;
            }

            // Show loading state
            this.showLoadingInAllTabs();

            // Fetch analysis from backend
            const response = await fetch(`/api/dss/barangay-analysis/${selectedBarangay}`);
            if (!response.ok) throw new Error('Failed to fetch analysis');

            this.currentAnalysis = await response.json();
            this.recommendations = this.currentAnalysis.recommendations || [];
            this.lastLoadedBarangay = selectedBarangay;  // Track last loaded barangay

            // Display overview by default
            this.displayOverview();
            
            // If a tab is already active, display it
            const activeTab = document.querySelector('.dss-tab-content.active');
            if (activeTab && activeTab.id !== 'overview-tab') {
                const tabName = activeTab.id.replace('-tab', '');
                this.loadTabContent(tabName);
            }
        } catch (error) {
            console.error('Error loading analysis:', error);
            this.showMessage(`Error loading analysis: ${error.message}`);
        }
    }

    /**
     * Get selected barangay from map
     */
    getSelectedBarangay() {
        // Get from global variable set by map interaction
        if (typeof selectedBarangayName !== 'undefined' && selectedBarangayName) {
            return selectedBarangayName;
        }
        // Fallback to DOM attribute
        return document.querySelector('[data-selected-barangay]')?.textContent || null;
    }

    /**
     * Display overview tab content
     */
    displayOverview() {
        const overview = this.currentAnalysis;
        if (!overview) return;

        const priorityColor = {
            'high': '#4CAF50',
            'medium': '#FFC107',
            'low': '#FF5722'
        };

        const stats = overview.detailed_statistics || {};
        const composition = stats.learner_composition || {};
        const demographics = stats.demographics || {};
        const accessibility = stats.accessibility || {};
        const distances = stats.distance_distribution || {};
        const availability = stats.availability_patterns || {};
        const transport = stats.transportation_modes || {};

        const html = `
            <div class="dss-overview-enhanced">
                <!-- Priority Score Card -->
                <div class="dss-score-card">
                    <div class="dss-score-circle" style="border-color: ${priorityColor[overview.priority_tier]}">
                        <div class="dss-score-value">${overview.priority_score}</div>
                        <div class="dss-score-label">${overview.priority_tier.toUpperCase()}</div>
                    </div>
                    <div class="dss-score-info">
                        <h3>${overview.barangay_name}</h3>
                        <p class="dss-priority-description">
                            ${overview.priority_tier === 'high' ? 'Requires immediate attention and resources' :
                              overview.priority_tier === 'medium' ? 'Moderate priority for intervention' :
                              'Stable, monitor progress'}
                        </p>
                        <p class="dss-enrollment-trend">
                            <i class="fas fa-arrow-${
                                overview.enrollment_trend === 'increasing' ? 'up' :
                                overview.enrollment_trend === 'decreasing' ? 'down' : 'right'
                            }"></i>
                            Trend: ${overview.enrollment_trend.toUpperCase()}
                        </p>
                    </div>
                </div>

                <!-- Learner Composition -->
                <div class="dss-section">
                    <h4><i class="fas fa-chart-pie"></i> Learner Composition</h4>
                    <div class="dss-composition-grid">
                        <div class="dss-composition-card">
                            <div class="dss-composition-number">${composition.total_learners || 0}</div>
                            <div class="dss-composition-label">Total Learners</div>
                        </div>
                        <div class="dss-composition-card highlight">
                            <div class="dss-composition-number">${composition.from_af1 || 0}</div>
                            <div class="dss-composition-label">From AF1 Records</div>
                            <div class="dss-composition-pct">${composition.af1_percentage || 0}%</div>
                        </div>
                        <div class="dss-composition-card highlight">
                            <div class="dss-composition-number">${composition.from_enrollments_approved || 0}</div>
                            <div class="dss-composition-label">From Enrollment Form</div>
                            <div class="dss-composition-pct">${composition.enrollment_percentage || 0}%</div>
                        </div>
                    </div>
                </div>

                <!-- Key Metrics -->
                <div class="dss-section">
                    <h4><i class="fas fa-tachometer-alt"></i> Program Status</h4>
                    <div class="dss-metrics-grid">
                        <div class="dss-metric">
                            <i class="fas fa-users"></i>
                            <div class="dss-metric-content">
                                <div class="dss-metric-value">${overview.active_learners}</div>
                                <div class="dss-metric-label">Active Learners</div>
                            </div>
                        </div>

                        <div class="dss-metric">
                            <i class="fas fa-graduation-cap"></i>
                            <div class="dss-metric-content">
                                <div class="dss-metric-value">${overview.completed_learners}</div>
                                <div class="dss-metric-label">Completed AF1</div>
                            </div>
                        </div>

                        <div class="dss-metric">
                            <i class="fas fa-exclamation-triangle"></i>
                            <div class="dss-metric-content">
                                <div class="dss-metric-value">${overview.at_risk_learners}</div>
                                <div class="dss-metric-label">At-Risk</div>
                            </div>
                        </div>

                        <div class="dss-metric">
                            <i class="fas fa-percent"></i>
                            <div class="dss-metric-content">
                                <div class="dss-metric-value">${overview.dropout_rate.toFixed(1)}%</div>
                                <div class="dss-metric-label">Dropout Rate</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Demographics -->
                <div class="dss-section">
                    <h4><i class="fas fa-id-card"></i> Learner Demographics</h4>
                    <div class="dss-demographics-grid">
                        <div class="dss-demographic-item">
                            <span class="dss-demographic-label">Average Age:</span>
                            <span class="dss-demographic-value">${demographics.average_age ? demographics.average_age + ' years' : 'N/A'}</span>
                        </div>
                        <div class="dss-demographic-item">
                            <span class="dss-demographic-label">Age Range:</span>
                            <span class="dss-demographic-value">${demographics.age_range || 'N/A'}</span>
                        </div>
                        <div class="dss-demographic-item">
                            <span class="dss-demographic-label">Education:</span>
                            <span class="dss-demographic-value">${demographics.most_common_grade ? 'Grade ' + demographics.most_common_grade + ' (most common)' : 'N/A'}</span>
                        </div>
                    </div>
                </div>

                <!-- Barriers & Accessibility -->
                <div class="dss-section">
                    <h4><i class="fas fa-ban"></i> Key Barriers Identified</h4>
                    <div class="dss-barriers-mini">
                        <div class="dss-barrier-mini">
                            <div class="dss-barrier-mini-icon">📍</div>
                            <div class="dss-barrier-mini-content">
                                <div class="dss-barrier-mini-title">Distance Barrier</div>
                                <div class="dss-barrier-mini-stat">${overview.barrier_analysis.distance_barriers} learners (${((overview.barrier_analysis.distance_barriers / (composition.total_learners || 1)) * 100).toFixed(1)}%)</div>
                            </div>
                        </div>
                        <div class="dss-barrier-mini">
                            <div class="dss-barrier-mini-icon">♿</div>
                            <div class="dss-barrier-mini-content">
                                <div class="dss-barrier-mini-title">PWD Status</div>
                                <div class="dss-barrier-mini-stat">${accessibility.pwd_count} learners (${accessibility.pwd_percentage}%)</div>
                            </div>
                        </div>
                        <div class="dss-barrier-mini">
                            <div class="dss-barrier-mini-icon">👨‍👩‍👧</div>
                            <div class="dss-barrier-mini-content">
                                <div class="dss-barrier-mini-title">4PS Beneficiaries</div>
                                <div class="dss-barrier-mini-stat">${accessibility.four_ps_count} learners (${accessibility.four_ps_percentage}%)</div>
                            </div>
                        </div>
                        <div class="dss-barrier-mini">
                            <div class="dss-barrier-mini-icon">🚶</div>
                            <div class="dss-barrier-mini-content">
                                <div class="dss-barrier-mini-title">Walking Only</div>
                                <div class="dss-barrier-mini-stat">${accessibility.walking_only_count} learners (${accessibility.walking_only_percentage}%)</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Distance Distribution -->
                <div class="dss-section">
                    <h4><i class="fas fa-map"></i> Distance Distribution</h4>
                    <div class="dss-distribution-grid">
                        <div class="dss-dist-item ${distances['Within 3km'] > 0 ? 'active' : ''}">
                            <div class="dss-dist-label">Within 3km</div>
                            <div class="dss-dist-count">${distances['Within 3km'] || 0}</div>
                        </div>
                        <div class="dss-dist-item ${distances['3-10km'] > 0 ? 'active' : ''}">
                            <div class="dss-dist-label">3-10km</div>
                            <div class="dss-dist-count">${distances['3-10km'] || 0}</div>
                        </div>
                        <div class="dss-dist-item ${distances['Over 10km'] > 0 ? 'active' : ''}">
                            <div class="dss-dist-label">Over 10km</div>
                            <div class="dss-dist-count">${distances['Over 10km'] || 0}</div>
                        </div>
                        <div class="dss-dist-item ${distances['Unknown'] > 0 ? 'active' : ''}">
                            <div class="dss-dist-label">Unknown</div>
                            <div class="dss-dist-count">${distances['Unknown'] || 0}</div>
                        </div>
                    </div>
                </div>

                <!-- Availability & Transportation -->
                <div class="dss-section">
                    <h4><i class="fas fa-calendar-alt"></i> Learner Availability & Transport</h4>
                    <div class="dss-two-column">
                        <div class="dss-column">
                            <div class="dss-subheading">Availability Patterns</div>
                            ${Object.entries(availability).map(([key, val]) => `
                                <div class="dss-list-item">
                                    <span>${key}</span>
                                    <span class="dss-badge">${val}</span>
                                </div>
                            `).join('')}
                        </div>
                        <div class="dss-column">
                            <div class="dss-subheading">Transportation Modes</div>
                            ${[
                                ['Walking', transport.walking],
                                ['Motorcycle', transport.motorcycle],
                                ['Tricycle', transport.tricycle],
                                ['Other', transport.other]
                            ].map(([mode, count]) => `
                                <div class="dss-list-item">
                                    <span>${mode}</span>
                                    <span class="dss-badge">${count || 0}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>

                <!-- Score Breakdown -->
                <div class="dss-section">
                    <h4><i class="fas fa-chart-bar"></i> Priority Score Components</h4>
                    <div class="dss-factor-list">
                        ${overview.key_factors.map(factor => `
                            <div class="dss-factor">
                                <span>${factor}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        document.getElementById('overview-tab').innerHTML = html;
    }

    /**
     * Display learner profiles with enriched data
     */
    displayLearnerProfiles() {
        const profiles = this.currentAnalysis?.learner_profiles;
        if (!profiles || profiles.length === 0) {
            document.getElementById('learners-tab').innerHTML = 
                '<p class="dss-no-data">No learner profiles available.</p>';
            return;
        }

        const html = `
            <div class="dss-learner-profiles">
                <div class="dss-profile-summary">
                    <h4>Learner Profiles (${profiles.length})</h4>
                </div>
                
                ${profiles.map((learner, idx) => `
                    <div class="dss-learner-card">
                        <div class="dss-learner-header">
                            <h5>${learner.name || 'Unknown'}</h5>
                            <span class="dss-status-badge status-${learner.als_status || 'unknown'}">${learner.als_status || 'Unknown'}</span>
                        </div>
                        
                        <div class="dss-learner-grid">
                            <div class="dss-learner-info">
                                <label>Age:</label>
                                <span>${learner.age || 'N/A'}</span>
                            </div>
                            <div class="dss-learner-info">
                                <label>Status:</label>
                                <span>${learner.als_status}</span>
                            </div>
                            <div class="dss-learner-info">
                                <label>Contact:</label>
                                <span>${learner.contact || 'No contact'}</span>
                            </div>
                            <div class="dss-learner-info">
                                <label>Email:</label>
                                <span>${learner.email || 'No email'}</span>
                            </div>
                        </div>

                        <div class="dss-learner-details">
                            <div class="dss-detail-section">
                                <h6><i class="fas fa-map-marker-alt"></i> Accessibility</h6>
                                <div class="dss-detail-content">
                                    <div>Distance: <strong>${learner.distance_km ? learner.distance_km + ' km' : 'N/A'}</strong></div>
                                    <div>Transport: <strong>${learner.transport_mode || 'N/A'}</strong></div>
                                </div>
                            </div>

                            <div class="dss-detail-section">
                                <h6><i class="fas fa-calendar"></i> Availability</h6>
                                <div class="dss-detail-content">
                                    <div>${learner.available_days && learner.available_days.length > 0 
                                        ? learner.available_days.join(', ') 
                                        : 'Not specified'}</div>
                                </div>
                            </div>

                            <div class="dss-detail-section">
                                <h6><i class="fas fa-graduation-cap"></i> Education</h6>
                                <div class="dss-detail-content">
                                    <div>Last Grade: <strong>${learner.last_grade_completed || 'N/A'}</strong></div>
                                </div>
                            </div>

                            <div class="dss-detail-section">
                                <h6><i class="fas fa-flag"></i> Vulnerable Groups</h6>
                                <div class="dss-detail-content">
                                    ${learner.is_pwd ? '<span class="badge-pwd">PWD</span>' : ''}
                                    ${learner.is_4ps ? '<span class="badge-4ps">4PS</span>' : ''}
                                    ${!learner.is_pwd && !learner.is_4ps ? '<span class="text-muted">None</span>' : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        document.getElementById('learners-tab').innerHTML = html;
    }

    /**
     * Display barrier analysis
     */
    displayBarrierAnalysis() {
        const barriers = this.currentAnalysis?.barrier_analysis;
        const profiles = this.currentAnalysis?.learner_profiles || [];
        
        if (!barriers) {
            document.getElementById('barriers-tab').innerHTML = 
                '<p class="dss-no-data">No barrier analysis available.</p>';
            return;
        }

        // Categorize learners by barrier types
        const distance_learners = profiles.filter(p => p.distance_km && parseFloat(p.distance_km) > 3);
        const pwd_learners = profiles.filter(p => p.is_pwd);
        const four_ps_learners = profiles.filter(p => p.is_4ps);
        const walking_learners = profiles.filter(p => p.transport_mode === 'Walking');
        const limited_availability = profiles.filter(p => !p.available_days || p.available_days.length <= 2);

        const html = `
            <div class="dss-barrier-analysis">
                <div class="dss-barrier-summary">
                    <h4>Barriers to Learning</h4>
                    <p class="dss-barrier-text">${barriers.barrier_summary}</p>
                </div>

                <div class="dss-barrier-grid">
                    <!-- Distance Barrier Card -->
                    <div class="dss-barrier-card barrier-distance">
                        <div class="dss-barrier-icon">
                            <i class="fas fa-map-marker-alt"></i>
                        </div>
                        <div class="dss-barrier-content">
                            <div class="dss-barrier-number">${barriers.distance_barriers}</div>
                            <div class="dss-barrier-label">Distance Barrier</div>
                            <div class="dss-barrier-desc">>3km from center</div>
                            <div class="dss-barrier-learners">
                                ${distance_learners.length > 0 
                                    ? distance_learners.map(l => `
                                        <div class="dss-barrier-learner">
                                            <span class="barrier-learner-name">${l.name}</span>
                                            <span class="barrier-learner-detail">${l.distance_km}km</span>
                                        </div>
                                    `).join('')
                                    : '<span class="text-muted">None</span>'
                                }
                            </div>
                        </div>
                    </div>

                    <!-- PWD Card -->
                    <div class="dss-barrier-card barrier-pwd">
                        <div class="dss-barrier-icon">
                            <i class="fas fa-user-injured"></i>
                        </div>
                        <div class="dss-barrier-content">
                            <div class="dss-barrier-number">${barriers.pwd_count}</div>
                            <div class="dss-barrier-label">Persons with Disability</div>
                            <div class="dss-barrier-desc">Need special support</div>
                            <div class="dss-barrier-learners">
                                ${pwd_learners.length > 0 
                                    ? pwd_learners.map(l => `
                                        <div class="dss-barrier-learner">
                                            <span class="barrier-learner-name">${l.name}</span>
                                            <span class="barrier-learner-detail">PWD</span>
                                        </div>
                                    `).join('')
                                    : '<span class="text-muted">None</span>'
                                }
                            </div>
                        </div>
                    </div>

                    <!-- 4PS Card -->
                    <div class="dss-barrier-card barrier-4ps">
                        <div class="dss-barrier-icon">
                            <i class="fas fa-hand-holding-heart"></i>
                        </div>
                        <div class="dss-barrier-content">
                            <div class="dss-barrier-number">${barriers.four_ps_count}</div>
                            <div class="dss-barrier-label">4PS Beneficiaries</div>
                            <div class="dss-barrier-desc">Financially vulnerable</div>
                            <div class="dss-barrier-learners">
                                ${four_ps_learners.length > 0 
                                    ? four_ps_learners.map(l => `
                                        <div class="dss-barrier-learner">
                                            <span class="barrier-learner-name">${l.name}</span>
                                            <span class="barrier-learner-detail">Beneficiary</span>
                                        </div>
                                    `).join('')
                                    : '<span class="text-muted">None</span>'
                                }
                            </div>
                        </div>
                    </div>

                    <!-- Walking Only Card -->
                    <div class="dss-barrier-card barrier-walking">
                        <div class="dss-barrier-icon">
                            <i class="fas fa-person-walking"></i>
                        </div>
                        <div class="dss-barrier-content">
                            <div class="dss-barrier-number">${barriers.walking_only_count}</div>
                            <div class="dss-barrier-label">Walking Only</div>
                            <div class="dss-barrier-desc">No transport access</div>
                            <div class="dss-barrier-learners">
                                ${walking_learners.length > 0 
                                    ? walking_learners.map(l => `
                                        <div class="dss-barrier-learner">
                                            <span class="barrier-learner-name">${l.name}</span>
                                            <span class="barrier-learner-detail">${l.distance_km || '?'}km</span>
                                        </div>
                                    `).join('')
                                    : '<span class="text-muted">None</span>'
                                }
                            </div>
                        </div>
                    </div>

                    <!-- Limited Availability Card -->
                    <div class="dss-barrier-card barrier-limited-time">
                        <div class="dss-barrier-icon">
                            <i class="fas fa-clock"></i>
                        </div>
                        <div class="dss-barrier-content">
                            <div class="dss-barrier-number">${limited_availability.length}</div>
                            <div class="dss-barrier-label">Limited Availability</div>
                            <div class="dss-barrier-desc">≤2 days per week</div>
                            <div class="dss-barrier-learners">
                                ${limited_availability.length > 0 
                                    ? limited_availability.map(l => `
                                        <div class="dss-barrier-learner">
                                            <span class="barrier-learner-name">${l.name}</span>
                                            <span class="barrier-learner-detail">${l.available_days ? l.available_days.length + ' days' : 'Not specified'}</span>
                                        </div>
                                    `).join('')
                                    : '<span class="text-muted">None</span>'
                                }
                            </div>
                        </div>
                    </div>
                </div>

                <div class="dss-barrier-insights">
                    <h5>Insights & Actions</h5>
                    <ul>
                        ${barriers.distance_barriers > 0 ? '<li><strong>Distance:</strong> Set up multiple learning centers or provide transportation assistance for learners >3km away</li>' : ''}
                        ${pwd_learners.length > 0 ? '<li><strong>PWD Support:</strong> Provide accessible learning environment, assistive materials, and flexible pacing</li>' : ''}
                        ${four_ps_learners.length > 0 ? '<li><strong>4PS Support:</strong> Ensure continuity through financial assistance, meal programs, and recognition incentives</li>' : ''}
                        ${walking_learners.length > 0 ? '<li><strong>Transportation:</strong> Organize carpooling groups, or establish learning sites within walking distance</li>' : ''}
                        ${limited_availability.length > 0 ? '<li><strong>Scheduling:</strong> Offer early morning, evening, or weekend sessions to accommodate work schedules</li>' : ''}
                    </ul>
                </div>
            </div>
        `;

        document.getElementById('barriers-tab').innerHTML = html;
    }

    /**
     * Display recommendations
     */
    displayRecommendations() {
        if (!this.recommendations || this.recommendations.length === 0) {
            document.getElementById('recommendations-tab').innerHTML = 
                '<p class="dss-no-data">No recommendations at this time.</p>';
            return;
        }

        const html = `
            <div class="dss-recommendations">
                ${this.recommendations.map((rec, idx) => `
                    <div class="dss-recommendation-card priority-${rec.priority}">
                        <div class="dss-rec-header">
                            <div class="dss-rec-title-group">
                                ${rec.audience_label ? `<span class="dss-audience-label">${rec.audience_label}</span>` : ''}
                                <h5>${rec.title}</h5>
                            </div>
                            <span class="dss-priority-badge">P${rec.priority}</span>
                        </div>
                        <p class="dss-rec-description">${rec.description}</p>
                        
                        <div class="dss-rec-details">
                            <div class="dss-rec-detail">
                                <strong>Timeline:</strong> ${rec.timeline}
                            </div>
                            <div class="dss-rec-detail">
                                <strong>Effort:</strong> <span class="effort-${rec.estimated_effort}">${rec.estimated_effort}</span>
                            </div>
                            <div class="dss-rec-detail">
                                <strong>Impact:</strong> ${rec.expected_impact}
                            </div>
                        </div>

                        <div class="dss-rec-actions">
                            <h6>Action Items:</h6>
                            <ul>
                                ${rec.action_items.map(item => `<li>${item}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        document.getElementById('recommendations-tab').innerHTML = html;
    }

    /**
     * Display forecast (simplified - shows based on current data)
     */
    displayForecast() {
        try {
            const barangay = this.getSelectedBarangay();
            if (!barangay) return;

            document.getElementById('forecast-tab').innerHTML = `
                <div class="dss-loading">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Generating forecast...</p>
                </div>
            `;

            // Fetch forecast from API
            fetch(`/api/dss/forecast/${barangay}`)
                .then(response => response.json())
                .then(forecast => {
                    if (!forecast || !forecast.current) {
                        throw new Error('Invalid forecast data');
                    }

                    const html = `
                        <div class="dss-forecast">
                            <div class="dss-forecast-header">
                                <h4>📊 ${barangay} School Year Forecast</h4>
                                <p class="dss-forecast-period">School Year: ${forecast.school_year} | Forecast Month: ${forecast.forecast_month}</p>
                            </div>

                            <!-- CURRENT STATUS -->
                            <div class="dss-forecast-section">
                                <h5>Current Status (as of today)</h5>
                                <div class="dss-forecast-grid">
                                    <div class="dss-forecast-card">
                                        <div class="dss-fc-label">Total Enrollment</div>
                                        <div class="dss-fc-value">${forecast.current.enrollment}</div>
                                    </div>
                                    <div class="dss-forecast-card">
                                        <div class="dss-fc-label">Completed</div>
                                        <div class="dss-fc-value">${forecast.current.completed}</div>
                                    </div>
                                    <div class="dss-forecast-card">
                                        <div class="dss-fc-label">At-Risk</div>
                                        <div class="dss-fc-value">${forecast.current.at_risk}</div>
                                    </div>
                                    <div class="dss-forecast-card">
                                        <div class="dss-fc-label">Completion Rate</div>
                                        <div class="dss-fc-value">${forecast.current.completion_rate}%</div>
                                    </div>
                                    <div class="dss-forecast-card">
                                        <div class="dss-fc-label">Dropout Rate</div>
                                        <div class="dss-fc-value">${forecast.current.dropout_rate}%</div>
                                    </div>
                                    <div class="dss-forecast-card">
                                        <div class="dss-fc-label">Monthly Velocity</div>
                                        <div class="dss-fc-value">${forecast.current.monthly_enrollment_velocity}</div>
                                    </div>
                                </div>
                            </div>

                            <!-- SCENARIOS -->
                            <div class="dss-scenarios">
                                <!-- REALISTIC -->
                                <div class="dss-scenario realistic">
                                    <div class="dss-scenario-header">
                                        <h5>→ Realistic Scenario</h5>
                                        <p class="dss-scenario-confidence">Confidence: ${forecast.realistic.confidence}</p>
                                    </div>
                                    <div class="dss-scenario-content">
                                        <p>Current trend continues through April 2026</p>
                                        <div class="dss-scenario-metrics">
                                            <div class="dss-scenario-metric">
                                                <span class="dss-sm-label">Projected Enrollment</span>
                                                <span class="dss-sm-value">${forecast.realistic.projected_enrollment}</span>
                                                <span class="dss-sm-change">+${forecast.realistic.new_enrollments}</span>
                                            </div>
                                            <div class="dss-scenario-metric">
                                                <span class="dss-sm-label">Projected Completed</span>
                                                <span class="dss-sm-value">${forecast.realistic.projected_completed}</span>
                                            </div>
                                            <div class="dss-scenario-metric">
                                                <span class="dss-sm-label">Projected At-Risk</span>
                                                <span class="dss-sm-value">${forecast.realistic.projected_at_risk}</span>
                                            </div>
                                            <div class="dss-scenario-metric">
                                                <span class="dss-sm-label">Completion Rate</span>
                                                <span class="dss-sm-value">${forecast.realistic.completion_rate}%</span>
                                            </div>
                                            <div class="dss-scenario-metric">
                                                <span class="dss-sm-label">Dropout Rate</span>
                                                <span class="dss-sm-value">${forecast.realistic.dropout_rate}%</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- OPTIMISTIC -->
                                <div class="dss-scenario optimistic">
                                    <div class="dss-scenario-header">
                                        <h5>↑ Optimistic Scenario</h5>
                                        <p class="dss-scenario-confidence">Confidence: ${forecast.optimistic.confidence}</p>
                                        <p class="dss-scenario-description">${forecast.optimistic.scenario_description}</p>
                                    </div>
                                    <div class="dss-scenario-content">
                                        <div class="dss-scenario-metrics">
                                            <div class="dss-scenario-metric">
                                                <span class="dss-sm-label">Projected Enrollment</span>
                                                <span class="dss-sm-value">${forecast.optimistic.projected_enrollment}</span>
                                                <span class="dss-sm-change">+${forecast.optimistic.new_enrollments}</span>
                                            </div>
                                            <div class="dss-scenario-metric">
                                                <span class="dss-sm-label">Projected Completed</span>
                                                <span class="dss-sm-value">${forecast.optimistic.projected_completed}</span>
                                            </div>
                                            <div class="dss-scenario-metric">
                                                <span class="dss-sm-label">Projected At-Risk</span>
                                                <span class="dss-sm-value">${forecast.optimistic.projected_at_risk}</span>
                                            </div>
                                            <div class="dss-scenario-metric">
                                                <span class="dss-sm-label">Completion Rate</span>
                                                <span class="dss-sm-value">${forecast.optimistic.completion_rate}%</span>
                                            </div>
                                            <div class="dss-scenario-metric">
                                                <span class="dss-sm-label">Dropout Rate</span>
                                                <span class="dss-sm-value">${forecast.optimistic.dropout_rate}%</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- PESSIMISTIC -->
                                <div class="dss-scenario pessimistic">
                                    <div class="dss-scenario-header">
                                        <h5>↓ Pessimistic Scenario</h5>
                                        <p class="dss-scenario-confidence">Confidence: ${forecast.pessimistic.confidence}</p>
                                        <p class="dss-scenario-description">${forecast.pessimistic.scenario_description}</p>
                                    </div>
                                    <div class="dss-scenario-content">
                                        <div class="dss-scenario-metrics">
                                            <div class="dss-scenario-metric">
                                                <span class="dss-sm-label">Projected Enrollment</span>
                                                <span class="dss-sm-value">${forecast.pessimistic.projected_enrollment}</span>
                                                <span class="dss-sm-change">+${forecast.pessimistic.new_enrollments}</span>
                                            </div>
                                            <div class="dss-scenario-metric">
                                                <span class="dss-sm-label">Projected Completed</span>
                                                <span class="dss-sm-value">${forecast.pessimistic.projected_completed}</span>
                                            </div>
                                            <div class="dss-scenario-metric">
                                                <span class="dss-sm-label">Projected At-Risk</span>
                                                <span class="dss-sm-value">${forecast.pessimistic.projected_at_risk}</span>
                                            </div>
                                            <div class="dss-scenario-metric">
                                                <span class="dss-sm-label">Completion Rate</span>
                                                <span class="dss-sm-value">${forecast.pessimistic.completion_rate}%</span>
                                            </div>
                                            <div class="dss-scenario-metric">
                                                <span class="dss-sm-label">Dropout Rate</span>
                                                <span class="dss-sm-value">${forecast.pessimistic.dropout_rate}%</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="dss-forecast-recommendation">
                                <i class="fas fa-lightbulb"></i>
                                <div class="dss-recommendation-content">
                                    <div class="dss-rec-item">
                                        <strong>Primary Action:</strong> ${forecast.recommendation.primary}
                                    </div>
                                    <div class="dss-rec-item">
                                        <strong>Barrier-Focused:</strong> ${forecast.recommendation.barrier_focused}
                                    </div>
                                    <div class="dss-rec-item">
                                        <strong>Monitoring:</strong> ${forecast.recommendation.monitoring}
                                    </div>
                                </div>
                            </div>

                            <!-- RISK & OPPORTUNITY ANALYSIS -->
                            ${forecast.risk_factors || forecast.opportunities ? `
                            <div class="dss-forecast-section">
                                <h5>Risk & Opportunity Analysis</h5>
                                <div class="dss-risk-opp-grid">
                                    ${forecast.risk_factors && forecast.risk_factors.length > 0 ? `
                                        <div class="dss-risk-column">
                                            <h6>⚠️ Risk Factors</h6>
                                            <ul class="dss-factor-list">
                                                ${forecast.risk_factors.map(risk => `<li>${risk}</li>`).join('')}
                                            </ul>
                                        </div>
                                    ` : ''}
                                    ${forecast.opportunities && forecast.opportunities.length > 0 ? `
                                        <div class="dss-opp-column">
                                            <h6>✅ Opportunities</h6>
                                            <ul class="dss-factor-list">
                                                ${forecast.opportunities.map(opp => `<li>${opp}</li>`).join('')}
                                            </ul>
                                        </div>
                                    ` : ''}
                                </div>
                            </div>
                            ` : ''}
                        </div>
                    `;

                    document.getElementById('forecast-tab').innerHTML = html;
                })
                .catch(error => {
                    console.error('Error loading forecast:', error);
                    document.getElementById('forecast-tab').innerHTML = `
                        <p class="dss-error">
                            <i class="fas fa-exclamation-circle"></i>
                            Error loading forecast: ${error.message}
                        </p>
                    `;
                });
        } catch (error) {
            console.error('Error in displayForecast:', error);
            document.getElementById('forecast-tab').innerHTML = 
                `<p class="dss-error">Error displaying forecast: ${error.message}</p>`;
        }
    }

    /**
     * Display gap analysis (simplified - based on current enrollment data)
     */
    displayGapAnalysis() {
        try {
            const barangay = this.getSelectedBarangay();
            if (!barangay || !this.currentAnalysis) return;

            const analysis = this.currentAnalysis;
            const enrollmentRate = analysis.total_learners > 0 ? (analysis.active_learners / analysis.total_learners * 100) : 0;
            
            const html = `
                <div class="dss-gap-analysis">
                    <div class="dss-gap-header">
                        <h4>Enrollment Analysis</h4>
                        <p>${barangay}</p>
                    </div>

                    <div class="dss-gap-metrics">
                        <div class="dss-gap-item">
                            <i class="fas fa-users"></i>
                            <div>
                                <strong>Total Learners</strong>
                                <p>${analysis.total_learners}</p>
                            </div>
                        </div>

                        <div class="dss-gap-item">
                            <i class="fas fa-check-circle"></i>
                            <div>
                                <strong>Active Learners</strong>
                                <p>${analysis.active_learners}</p>
                            </div>
                        </div>

                        <div class="dss-gap-item">
                            <i class="fas fa-chart-pie"></i>
                            <div>
                                <strong>Active Rate</strong>
                                <p>${enrollmentRate.toFixed(1)}%</p>
                            </div>
                        </div>

                        <div class="dss-gap-item gap-critical">
                            <i class="fas fa-exclamation-triangle"></i>
                            <div>
                                <strong>At-Risk Learners</strong>
                                <p>${analysis.at_risk_learners}</p>
                            </div>
                        </div>
                    </div>

                    <div class="dss-accessibility">
                        <h5>Engagement Score</h5>
                        <div class="dss-accessibility-bar">
                            <div class="dss-accessibility-fill" style="width: ${enrollmentRate}%"></div>
                        </div>
                        <p>${enrollmentRate.toFixed(1)}% of learners are actively enrolled</p>
                    </div>

                    <div class="dss-critical-gaps">
                        <h5><i class="fas fa-info-circle"></i> Key Metrics</h5>
                        <ul>
                            <li>Completion Rate: ${analysis.completed_learners}/${analysis.total_learners}</li>
                            <li>Dropout Rate: ${analysis.dropout_rate.toFixed(1)}%</li>
                            <li>Priority Score: ${analysis.priority_score}/100 (${analysis.priority_tier.toUpperCase()})</li>
                        </ul>
                    </div>
                </div>
            `;

            document.getElementById('gaps-tab').innerHTML = html;
        } catch (error) {
            console.error('Error loading gap analysis:', error);
            document.getElementById('gaps-tab').innerHTML = 
                `<p class="dss-error">Error displaying analysis: ${error.message}</p>`;
        }
    }

    /**
     * Load tab content
     */
    loadTabContent(tabName) {
        switch(tabName) {
            case 'overview':
                this.displayOverview();
                break;
            case 'learners':
                this.displayLearnerProfiles();
                break;
            case 'barriers':
                this.displayBarrierAnalysis();
                break;
            case 'recommendations':
                this.displayRecommendations();
                break;
            case 'forecast':
                this.displayForecast();
                break;
        }
    }

    /**
     * Export report as CSV and PDF
     */
    async exportReport() {
        if (!this.currentAnalysis) {
            alert('No analysis to export. Please load an analysis first.');
            return;
        }

        try {
            // Show export options
            this.showExportOptions();
        } catch (error) {
            console.error('Error exporting report:', error);
            alert('Error exporting report');
        }
    }

    /**
     * Show export options dialog
     */
    showExportOptions() {
        const existingDialog = document.getElementById('export-options-dialog');
        if (existingDialog) existingDialog.remove();

        const dialog = document.createElement('div');
        dialog.id = 'export-options-dialog';
        dialog.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            border: 2px solid #2563eb;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            z-index: 10000;
            min-width: 400px;
        `;
        dialog.innerHTML = `
            <h3 style="margin-top: 0; color: #2563eb;">Export Report As</h3>
            <div style="margin: 20px 0;">
                <button class="export-option-btn" style="width: 100%; padding: 12px; margin-bottom: 10px; background: #2563eb; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold;">
                    <i class="fas fa-file-csv"></i> CSV (Structured Data)
                </button>
                <button class="export-option-btn" style="width: 100%; padding: 12px; margin-bottom: 10px; background: #16a34a; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold;">
                    <i class="fas fa-file-pdf"></i> PDF (Full Report)
                </button>
                <button class="export-option-btn" style="width: 100%; padding: 12px; margin-bottom: 10px; background: #ea580c; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold;">
                    <i class="fas fa-image"></i> PDF (Visual Snapshot)
                </button>
            </div>
            <button id="cancel-export" style="width: 100%; padding: 10px; background: #e5e7eb; color: #333; border: none; border-radius: 4px; cursor: pointer;">Cancel</button>
        `;
        
        document.body.appendChild(dialog);

        const buttons = dialog.querySelectorAll('.export-option-btn');
        buttons[0].addEventListener('click', () => {
            document.body.removeChild(dialog);
            this.exportAsCSV();
        });
        buttons[1].addEventListener('click', () => {
            document.body.removeChild(dialog);
            this.exportAsPDF();
        });
        buttons[2].addEventListener('click', () => {
            document.body.removeChild(dialog);
            this.exportAsPDFVisual();
        });

        document.getElementById('cancel-export').addEventListener('click', () => {
            document.body.removeChild(dialog);
        });
    }

    /**
     * Export analysis data as CSV (Improved format)
     */
    exportAsCSV() {
        const data = this.currentAnalysis;
        const timestamp = new Date().toISOString().slice(0,10);
        
        let csvContent = '';
        
        // Title and metadata
        csvContent += '"DSS ANALYSIS REPORT - STRUCTURED DATA EXPORT"\n';
        csvContent += `"Barangay: ${data.barangay_name}"\n`;
        csvContent += `"Generated: ${new Date().toLocaleString()}"\n\n`;

        // EXECUTIVE SUMMARY
        csvContent += '"EXECUTIVE SUMMARY"\n';
        csvContent += '"Metric","Value","Unit"\n';
        csvContent += `"Total Learners","${data.total_learners}","learners"\n`;
        csvContent += `"Active Learners","${data.active_learners}","learners"\n`;
        csvContent += `"Completed Learners","${data.completed_learners}","learners"\n`;
        csvContent += `"At-Risk Learners","${data.at_risk_learners}","learners"\n`;
        csvContent += `"Priority Tier","${data.priority_tier}","categorical"\n`;
        csvContent += `"Priority Score","${data.priority_score.toFixed(2)}","score"\n`;
        csvContent += `"Dropout Rate","${(data.dropout_rate * 100).toFixed(2)}","%"\n`;
        csvContent += `"Enrollment Trend","${data.enrollment_trend}","categorical"\n\n`;

        // LEARNER COMPOSITION
        const composition = data.detailed_statistics?.learner_composition || {};
        csvContent += '"LEARNER COMPOSITION"\n';
        csvContent += '"Category","Count","Percentage"\n';
        csvContent += `"From AF1 Records","${composition.from_af1 || 0}","${composition.af1_percentage || 0}%"\n`;
        csvContent += `"From Enrollment Form","${composition.from_enrollments_approved || 0}","${composition.enrollment_percentage || 0}%"\n\n`;

        // DEMOGRAPHICS
        const demographics = data.detailed_statistics?.demographics || {};
        csvContent += '"DEMOGRAPHICS"\n';
        csvContent += '"Category","Value"\n';
        csvContent += `"Average Age","${demographics.average_age || 'N/A'} years"\n`;
        csvContent += `"Age Range","${demographics.age_range || 'N/A'}"\n`;
        csvContent += `"Most Common Grade Level","Grade ${demographics.most_common_grade || 'N/A'}"\n\n`;

        // DISTANCE DISTRIBUTION
        const distances = data.detailed_statistics?.distance_distribution || {};
        csvContent += '"DISTANCE DISTRIBUTION"\n';
        csvContent += '"Distance Range","Count"\n';
        csvContent += `"Within 3km","${distances['Within 3km'] || 0}"\n`;
        csvContent += `"3-10km","${distances['3-10km'] || 0}"\n`;
        csvContent += `"Over 10km","${distances['Over 10km'] || 0}"\n`;
        csvContent += `"Unknown","${distances['Unknown'] || 0}"\n\n`;

        // ACCESSIBILITY & BARRIERS
        const accessibility = data.detailed_statistics?.accessibility || {};
        csvContent += '"ACCESSIBILITY & SPECIAL NEEDS"\n';
        csvContent += '"Category","Count","Percentage"\n';
        csvContent += `"PWD (Persons with Disability)","${accessibility.pwd_count || 0}","${accessibility.pwd_percentage || '0'}%"\n`;
        csvContent += `"4PS Beneficiaries","${accessibility.four_ps_count || 0}","${accessibility.four_ps_percentage || '0'}%"\n`;
        csvContent += `"Walking Only (No Transport)","${accessibility.walking_only_count || 0}","${accessibility.walking_only_percentage || '0'}%"\n\n`;

        // TRANSPORTATION MODES
        const transport = data.detailed_statistics?.transportation_modes || {};
        csvContent += '"TRANSPORTATION MODES"\n';
        csvContent += '"Mode","Count"\n';
        csvContent += `"Walking","${transport.walking || 0}"\n`;
        csvContent += `"Motorcycle","${transport.motorcycle || 0}"\n`;
        csvContent += `"Tricycle","${transport.tricycle || 0}"\n`;
        csvContent += `"Other","${transport.other || 0}"\n\n`;

        // KEY BARRIERS SUMMARY
        const barriers = data.barrier_analysis || {};
        csvContent += '"KEY BARRIERS IDENTIFIED"\n';
        csvContent += '"Barrier Type","Affected Learners","Percentage"\n';
        csvContent += `"Distance Barrier","${barriers.distance_barriers || 0}","${((barriers.distance_barriers / (data.total_learners || 1)) * 100).toFixed(1)}%"\n`;
        csvContent += `"Accessibility Barriers","${barriers.accessibility_barriers || 0}","${((barriers.accessibility_barriers / (data.total_learners || 1)) * 100).toFixed(1)}%"\n`;
        csvContent += `"Schedule Conflicts","${barriers.schedule_conflicts || 0}","${((barriers.schedule_conflicts / (data.total_learners || 1)) * 100).toFixed(1)}%"\n\n`;

        // RECOMMENDATIONS
        csvContent += '"RECOMMENDATIONS FOR ACTION"\n';
        csvContent += '"Priority","Title","Category","Description","Expected Impact","Estimated Effort","Timeline"\n';
        if (data.recommendations && Array.isArray(data.recommendations)) {
            data.recommendations.forEach(rec => {
                const priority = rec.priority || '';
                const title = (rec.title || '').replace(/"/g, '""');
                const category = rec.category || '';
                const description = (rec.description || '').replace(/"/g, '""');
                const impact = rec.expected_impact || '';
                const effort = rec.estimated_effort || '';
                const timeline = rec.timeline || '';
                csvContent += `"P${priority}","${title}","${category}","${description}","${impact}","${effort}","${timeline}"\n`;
                
                // Add action items as sub-rows if available
                if (rec.action_items && Array.isArray(rec.action_items)) {
                    rec.action_items.forEach((item, idx) => {
                        const actionItem = (item || '').replace(/"/g, '""');
                        csvContent += `"","→ Action ${idx + 1}: ${actionItem}","","","","",""\n`;
                    });
                }
            });
        }
        csvContent += '\n';

        // RESOURCES NEEDED
        csvContent += '"RESOURCES REQUIRED"\n';
        csvContent += '"Resource","Quantity"\n';
        if (data.resources_needed) {
            Object.entries(data.resources_needed).forEach(([key, value]) => {
                csvContent += `"${key}","${value}"\n`;
            });
        }
        csvContent += '\n';

        // KEY FACTORS
        csvContent += '"KEY SUCCESS FACTORS"\n';
        if (data.key_factors && Array.isArray(data.key_factors)) {
            data.key_factors.forEach((factor, idx) => {
                csvContent += `"Factor ${idx + 1}","${(factor || '').replace(/"/g, '""')}"\n`;
            });
        }

        // Create and download CSV file
        const csvBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(csvBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `DSS_Report_${data.barangay_name}_${timestamp}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        
        console.log('✅ CSV report exported:', `DSS_Report_${data.barangay_name}_${timestamp}.csv`);
    }

    /**
     * Export analysis data as PDF (Full formatted report)
     */
    exportAsPDF() {
        const data = this.currentAnalysis;
        const timestamp = new Date().toISOString().slice(0,10);
        
        if (!data) {
            alert('No analysis data to export');
            return;
        }

        try {
            const composition = data.detailed_statistics?.learner_composition || {};
            const demographics = data.detailed_statistics?.demographics || {};
            const distances = data.detailed_statistics?.distance_distribution || {};
            const accessibility = data.detailed_statistics?.accessibility || {};
            const transport = data.detailed_statistics?.transportation_modes || {};
            const barriers = data.barrier_analysis || {};
            
            let html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
body { font-family: Arial, sans-serif; color: #333; margin: 20px; line-height: 1.6; }
h1 { color: #2563eb; text-align: center; }
h2 { background: #2563eb; color: white; padding: 10px; margin-top: 20px; }
table { width: 100%; border-collapse: collapse; margin: 15px 0; }
th { background: #e0e7ff; padding: 8px; text-align: left; border: 1px solid #2563eb; }
td { padding: 8px; border: 1px solid #ddd; }
.stat { display: inline-block; width: 30%; margin: 10px 1.5%; padding: 10px; background: #f9fafb; border: 1px solid #ddd; }
</style>
</head>
<body>
<h1>DSS ANALYSIS REPORT</h1>
<p><strong>Barangay:</strong> ${data.barangay_name}</p>
<p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
<p><strong>Priority:</strong> ${data.priority_tier.toUpperCase()} (Score: ${data.priority_score.toFixed(2)})</p>

<h2>SUMMARY</h2>
<div class="stat">Total Learners: <strong>${data.total_learners}</strong></div>
<div class="stat">Active: <strong>${data.active_learners}</strong></div>
<div class="stat">At-Risk: <strong>${data.at_risk_learners}</strong></div>
<div class="stat">Completed: <strong>${data.completed_learners}</strong></div>
<div class="stat">Dropout Rate: <strong>${(data.dropout_rate * 100).toFixed(1)}%</strong></div>

<h2>LEARNER COMPOSITION</h2>
<table>
<tr><th>Source</th><th>Count</th><th>Percentage</th></tr>
<tr><td>From AF1 Records</td><td>${composition.from_af1 || 0}</td><td>${composition.af1_percentage || 0}%</td></tr>
<tr><td>From Enrollment Form</td><td>${composition.from_enrollments_approved || 0}</td><td>${composition.enrollment_percentage || 0}%</td></tr>
</table>

<h2>DEMOGRAPHICS</h2>
<p><strong>Average Age:</strong> ${demographics.average_age || 'N/A'} years</p>
<p><strong>Age Range:</strong> ${demographics.age_range || 'N/A'}</p>
<p><strong>Most Common Grade:</strong> Grade ${demographics.most_common_grade || 'N/A'}</p>

<h2>DISTANCE DISTRIBUTION</h2>
<table>
<tr><th>Range</th><th>Count</th></tr>
<tr><td>Within 3km</td><td>${distances['Within 3km'] || 0}</td></tr>
<tr><td>3-10km</td><td>${distances['3-10km'] || 0}</td></tr>
<tr><td>Over 10km</td><td>${distances['Over 10km'] || 0}</td></tr>
</table>

<h2>ACCESSIBILITY</h2>
<table>
<tr><th>Category</th><th>Count</th><th>Percentage</th></tr>
<tr><td>PWD</td><td>${accessibility.pwd_count || 0}</td><td>${accessibility.pwd_percentage || 0}%</td></tr>
<tr><td>4PS Beneficiaries</td><td>${accessibility.four_ps_count || 0}</td><td>${accessibility.four_ps_percentage || 0}%</td></tr>
<tr><td>Walking Only</td><td>${accessibility.walking_only_count || 0}</td><td>${accessibility.walking_only_percentage || 0}%</td></tr>
</table>

<h2>TRANSPORTATION</h2>
<table>
<tr><th>Mode</th><th>Count</th></tr>
<tr><td>Walking</td><td>${transport.walking || 0}</td></tr>
<tr><td>Motorcycle</td><td>${transport.motorcycle || 0}</td></tr>
<tr><td>Tricycle</td><td>${transport.tricycle || 0}</td></tr>
<tr><td>Other</td><td>${transport.other || 0}</td></tr>
</table>

<h2>KEY BARRIERS</h2>
<table>
<tr><th>Barrier</th><th>Count</th><th>Percentage</th></tr>
<tr><td>Distance</td><td>${barriers.distance_barriers || 0}</td><td>${((barriers.distance_barriers || 0) / (data.total_learners || 1) * 100).toFixed(1)}%</td></tr>
<tr><td>Accessibility</td><td>${barriers.accessibility_barriers || 0}</td><td>${((barriers.accessibility_barriers || 0) / (data.total_learners || 1) * 100).toFixed(1)}%</td></tr>
<tr><td>Schedule</td><td>${barriers.schedule_conflicts || 0}</td><td>${((barriers.schedule_conflicts || 0) / (data.total_learners || 1) * 100).toFixed(1)}%</td></tr>
</table>
</body>
</html>`;

            const options = {
                margin: 10,
                filename: `DSS_Report_${data.barangay_name}_${timestamp}.pdf`,
                image: { type: 'jpeg', quality: 0.95 },
                html2canvas: { scale: 2 },
                jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
            };
            
            html2pdf().set(options).from(html).save();
            console.log('✅ PDF exported:', `DSS_Report_${data.barangay_name}_${timestamp}.pdf`);
        } catch (err) {
            console.error('PDF export error:', err);
            alert('Error: ' + err.message);
        }
    }

    /**
     * Export analysis as visual PDF (using html2canvas for visual snapshot)
     */
    exportAsPDFVisual() {
        const data = this.currentAnalysis;
        const timestamp = new Date().toISOString().slice(0,10);
        
        console.log('📸 Generating visual PDF snapshot...');
        
        // Create a snapshot of the DSS panel
        const panel = document.getElementById('dss-panel');
        if (!panel) {
            alert('DSS panel not found. Please open the DSS panel first.');
            return;
        }

        try {
            // Check if html2pdf is available
            if (typeof html2pdf === 'undefined') {
                alert('PDF export library not available.');
                return;
            }
            
            // Clone the panel to avoid modifying the original
            const panelClone = panel.cloneNode(true);
            panelClone.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                background: white;
                z-index: 10001;
                margin: 0;
            `;
            document.body.appendChild(panelClone);
            
            // Wait a moment for styling to apply
            setTimeout(() => {
                // Configure html2pdf options for visual capture
                const options = {
                    margin: [10, 10, 10, 10],
                    filename: `DSS_Report_Visual_${data.barangay_name}_${timestamp}.pdf`,
                    image: { type: 'jpeg', quality: 0.95 },
                    html2canvas: { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff' },
                    jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4', compress: true }
                };
                
                // Generate PDF using html2pdf
                html2pdf().set(options).from(panelClone).save().then(() => {
                    document.body.removeChild(panelClone);
                    console.log('✅ Visual PDF snapshot exported:', `DSS_Report_Visual_${data.barangay_name}_${timestamp}.pdf`);
                }).catch(err => {
                    if (document.body.contains(panelClone)) {
                        document.body.removeChild(panelClone);
                    }
                    console.error('Error creating visual PDF:', err);
                    alert('Error creating visual PDF: ' + err.message);
                });
            }, 300);
        } catch (err) {
            console.error('Error in visual PDF export:', err);
            alert('Error exporting visual PDF: ' + err.message);
        }
    }

    /**
     * Refresh analysis
     */
    refreshAnalysis() {
        this.currentAnalysis = null;
        this.loadAnalysisForCurrentLocation();
    }

    /**
     * Show message
     */
    showMessage(message) {
        document.getElementById('overview-tab').innerHTML = 
            `<p class="dss-message"><i class="fas fa-info-circle"></i> ${message}</p>`;
    }

    /**
     * Show loading animation in all tabs
     */
    showLoadingInAllTabs() {
        const loadingHTML = '<div class="dss-loading"><i class="fas fa-spinner fa-spin"></i> Loading analysis...</div>';
        document.getElementById('overview-tab').innerHTML = loadingHTML;
        document.getElementById('learners-tab').innerHTML = loadingHTML;
        document.getElementById('barriers-tab').innerHTML = loadingHTML;
        document.getElementById('recommendations-tab').innerHTML = loadingHTML;
        document.getElementById('forecast-tab').innerHTML = loadingHTML;
    }

    /**
     * Handle recommendation action
     */
    async actionRecommendation(title, action) {
        try {
            const response = await fetch('/api/dss/save-recommendation-action', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    recommendation_id: title,
                    action: action,
                    barangay: this.currentAnalysis.barangay_name
                })
            });

            if (response.ok) {
                alert(`Recommendation marked as "${action}"`);
                this.displayRecommendations();
            }
        } catch (error) {
            console.error('Error saving action:', error);
            alert('Error saving recommendation action');
        }
    }
}

// ==================== INITIALIZATION ====================

// Create global DSS instance
let dssPlan;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    dssPlan = new ALSDSSPanel();
    // Also expose globally for map integration
    window.dssPanel = dssPlan;
    console.log('✅ DSS Frontend Module Loaded');
});
