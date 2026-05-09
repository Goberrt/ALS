// ALS Portal JavaScript - Main functionality
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the application
    initializeApp();
});

// Global variables
let mainMap;
let miniMap;
let currentTab = 'dashboard';

// Sample data for demonstration
const sampleLearners = [
    {
        id: 1,
        name: 'Juan Dela Cruz',
        status: 'graduate',
        barangay: 'Poblacion',
        lat: 14.2843,
        lng: 121.4158,
        lastContact: '2024-08-15',
        progress: 100
    },
    {
        id: 2,
        name: 'Maria Santos',
        status: 'current',
        barangay: 'San Jose',
        lat: 14.2893,
        lng: 121.4208,
        lastContact: '2024-08-28',
        progress: 65
    },
    {
        id: 3,
        name: 'Pedro Rodriguez',
        status: 'at-risk',
        barangay: 'Bagumbayan',
        lat: 14.2793,
        lng: 121.4108,
        lastContact: '2024-07-20',
        progress: 30
    },
    {
        id: 4,
        name: 'Ana Reyes',
        status: 'not-enrolled',
        barangay: 'Jasaan',
        lat: 14.2943,
        lng: 121.4258,
        lastContact: '2024-08-01',
        progress: 0
    },
    {
        id: 5,
        name: 'Carlos Mendoza',
        status: 'current',
        barangay: 'Pagsawitan',
        lat: 14.2743,
        lng: 121.4058,
        lastContact: '2024-08-25',
        progress: 80
    }
];

// Initialize the application
function initializeApp() {
    setupTabNavigation();
    setupModals();
    setupFilters();
    setupSearch();
    initializeMaps();
    updateDashboardStats();
    setupFormHandlers();
    
    // Show dashboard by default
    showTab('dashboard');
}

// Tab Navigation
function setupTabNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const tabName = this.getAttribute('data-tab');
            showTab(tabName);
            
            // Update active state
            navLinks.forEach(nl => nl.classList.remove('active'));
            this.classList.add('active');
        });
    });
}

function showTab(tabName) {
    // Hide all tabs
    const allTabs = document.querySelectorAll('.tab-content');
    allTabs.forEach(tab => tab.classList.remove('active'));
    
    // Show selected tab
    const selectedTab = document.getElementById(tabName);
    if (selectedTab) {
        selectedTab.classList.add('active');
        currentTab = tabName;
        
        // Initialize specific tab content
        if (tabName === 'mapping') {
            setTimeout(() => {
                if (mainMap) {
                    mainMap.invalidateSize();
                    loadMapData();
                }
            }, 100);
        }
    }
}

// Map Initialization
function initializeMaps() {
    // Initialize mini map for dashboard
    initializeMiniMap();
    
    // Initialize main map for mapping tab
    initializeMainMap();
}

function initializeMiniMap() {
    const miniMapContainer = document.getElementById('mini-map');
    if (miniMapContainer && !miniMap) {
        // Santa Cruz, Laguna coordinates
        const santaCruzCenter = [14.2843, 121.4158];
        
        miniMap = L.map('mini-map', {
            zoomControl: false,
            dragging: false,
            touchZoom: false,
            doubleClickZoom: false,
            scrollWheelZoom: false,
            boxZoom: false,
            keyboard: false
        }).setView(santaCruzCenter, 13);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(miniMap);
        
        // Add sample markers
        addSampleMarkersToMap(miniMap, true);
    }
}

function initializeMainMap() {
    setTimeout(() => {
        const mainMapContainer = document.getElementById('main-map');
        if (mainMapContainer && !mainMap) {
            // Santa Cruz, Laguna coordinates
            const santaCruzCenter = [14.2843, 121.4158];
            
            mainMap = L.map('main-map').setView(santaCruzCenter, 13);
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(mainMap);
            
            // Add sample markers
            addSampleMarkersToMap(mainMap, false);
        }
    }, 100);
}

function addSampleMarkersToMap(map, isMini = false) {
    const markerColors = {
        graduate: '#27ae60',
        current: '#3498db',
        'at-risk': '#e74c3c',
        'not-enrolled': '#f39c12'
    };
    
    sampleLearners.forEach(learner => {
        const marker = L.circleMarker([learner.lat, learner.lng], {
            radius: isMini ? 5 : 8,
            fillColor: markerColors[learner.status],
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(map);
        
        if (!isMini) {
            marker.bindPopup(`
                <div class="marker-popup">
                    <h4>${learner.name}</h4>
                    <p><strong>Status:</strong> ${learner.status.replace('-', ' ').toUpperCase()}</p>
                    <p><strong>Barangay:</strong> ${learner.barangay}</p>
                    <p><strong>Progress:</strong> ${learner.progress}%</p>
                    <p><strong>Last Contact:</strong> ${learner.lastContact}</p>
                </div>
            `);
        }
    });
}

// Dashboard Statistics
function updateDashboardStats() {
    const graduates = sampleLearners.filter(l => l.status === 'graduate').length;
    const atRisk = sampleLearners.filter(l => l.status === 'at-risk').length;
    const totalMapped = new Set(sampleLearners.map(l => l.barangay)).size;
    const avgProgress = Math.round(sampleLearners.reduce((sum, l) => sum + l.progress, 0) / sampleLearners.length);
    
    document.getElementById('total-als-graduates').textContent = graduates + 240; // Adding base numbers
    document.getElementById('at-risk-learners').textContent = atRisk + 64;
    document.getElementById('mapped-locations').textContent = totalMapped + 13;
    document.getElementById('completion-rate').textContent = avgProgress + '%';
}

// Modal Handling
function setupModals() {
    const addLearnerBtn = document.getElementById('add-learner');
    const addLearnerModal = document.getElementById('add-learner-modal');
    const closeBtn = addLearnerModal.querySelector('.close');
    const cancelBtn = document.getElementById('cancel-add');
    
    addLearnerBtn.addEventListener('click', () => {
        addLearnerModal.style.display = 'block';
    });
    
    closeBtn.addEventListener('click', () => {
        addLearnerModal.style.display = 'none';
    });
    
    cancelBtn.addEventListener('click', () => {
        addLearnerModal.style.display = 'none';
    });
    
    window.addEventListener('click', (e) => {
        if (e.target === addLearnerModal) {
            addLearnerModal.style.display = 'none';
        }
    });
}

// Filter Handling
function setupFilters() {
    const learnerTypeFilter = document.getElementById('learner-type');
    const barangayFilter = document.getElementById('barangay-filter');
    const refreshMapBtn = document.getElementById('refresh-map');
    
    if (learnerTypeFilter) {
        learnerTypeFilter.addEventListener('change', filterMapData);
    }
    
    if (barangayFilter) {
        barangayFilter.addEventListener('change', filterMapData);
    }
    
    if (refreshMapBtn) {
        refreshMapBtn.addEventListener('click', refreshMapData);
    }
}

function filterMapData() {
    const learnerType = document.getElementById('learner-type').value;
    const barangay = document.getElementById('barangay-filter').value;
    
    // This would filter the map markers based on selected criteria
    console.log('Filtering map data:', { learnerType, barangay });
    
    // For demo purposes, just refresh the map
    if (mainMap) {
        loadMapData();
    }
}

function refreshMapData() {
    if (mainMap) {
        // Clear existing markers
        mainMap.eachLayer(layer => {
            if (layer instanceof L.CircleMarker) {
                mainMap.removeLayer(layer);
            }
        });
        
        // Reload markers
        addSampleMarkersToMap(mainMap, false);
    }
}

function loadMapData() {
    // This function would load filtered data based on current filters
    refreshMapData();
}

// Search Functionality
function setupSearch() {
    const searchInput = document.getElementById('learner-search');
    
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            filterLearnersTable(searchTerm);
        });
    }
}

function filterLearnersTable(searchTerm) {
    const tableRows = document.querySelectorAll('#learners-tbody tr');
    
    tableRows.forEach(row => {
        const name = row.cells[0].textContent.toLowerCase();
        const status = row.cells[1].textContent.toLowerCase();
        const barangay = row.cells[2].textContent.toLowerCase();
        
        if (name.includes(searchTerm) || status.includes(searchTerm) || barangay.includes(searchTerm)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

// Form Handlers
function setupFormHandlers() {
    const addLearnerForm = document.getElementById('add-learner-form');
    const generateReportBtn = document.getElementById('generate-report');
    
    if (addLearnerForm) {
        addLearnerForm.addEventListener('submit', handleAddLearner);
    }
    
    if (generateReportBtn) {
        generateReportBtn.addEventListener('click', handleGenerateReport);
    }
    
    // Setup table action buttons
    setupTableActions();
}

function handleAddLearner(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const learnerData = {
        name: document.getElementById('learner-name').value,
        status: document.getElementById('learner-status').value,
        barangay: document.getElementById('learner-barangay').value,
        address: document.getElementById('learner-address').value
    };
    
    console.log('Adding new learner:', learnerData);
    
    // Here you would send the data to your Python backend
    // For demo purposes, just close the modal and show success
    document.getElementById('add-learner-modal').style.display = 'none';
    
    // Reset form
    e.target.reset();
    
    // Show success message (you could implement a toast notification)
    alert('Learner added successfully!');
    
    // Refresh the learners table
    // refreshLearnersTable();
}

function handleGenerateReport() {
    const reportType = document.getElementById('report-type').value;
    const startDate = document.getElementById('start-date').value;
    const endDate = document.getElementById('end-date').value;
    
    console.log('Generating report:', { reportType, startDate, endDate });
    
    // Here you would send the request to your Python backend
    // For demo purposes, just show a loading message
    const btn = document.getElementById('generate-report');
    const originalText = btn.innerHTML;
    
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
    btn.disabled = true;
    
    setTimeout(() => {
        btn.innerHTML = originalText;
        btn.disabled = false;
        alert('Report generated successfully!');
    }, 2000);
}

function setupTableActions() {
    // Setup view and edit buttons in learners table
    document.addEventListener('click', function(e) {
        if (e.target.closest('.btn-view')) {
            const row = e.target.closest('tr');
            const learnerName = row.cells[0].textContent;
            alert(`Viewing details for: ${learnerName}`);
        }
        
        if (e.target.closest('.btn-edit')) {
            const row = e.target.closest('tr');
            const learnerName = row.cells[0].textContent;
            alert(`Editing: ${learnerName}`);
        }
        
        if (e.target.closest('.btn-download')) {
            const reportItem = e.target.closest('.report-item');
            const reportName = reportItem.querySelector('h4').textContent;
            alert(`Downloading: ${reportName}`);
        }
    });
}

// Utility Functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function showNotification(message, type = 'info') {
    // Simple notification system
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: #3498db;
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        z-index: 3000;
        animation: slideIn 0.3s ease;
    `;
    
    if (type === 'success') {
        notification.style.background = '#27ae60';
    } else if (type === 'error') {
        notification.style.background = '#e74c3c';
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// API Functions (to be connected with Python backend)
const API = {
    // Base URL for your Python backend
    baseURL: 'http://localhost:5000/api',
    
    async getLearners() {
        try {
            // const response = await fetch(`${this.baseURL}/learners`);
            // return await response.json();
            
            // For demo, return sample data
            return sampleLearners;
        } catch (error) {
            console.error('Error fetching learners:', error);
            return sampleLearners;
        }
    },
    
    async addLearner(learnerData) {
        try {
            // const response = await fetch(`${this.baseURL}/learners`, {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify(learnerData)
            // });
            // return await response.json();
            
            console.log('Would send to backend:', learnerData);
            return { success: true, message: 'Learner added successfully' };
        } catch (error) {
            console.error('Error adding learner:', error);
            return { success: false, message: 'Failed to add learner' };
        }
    },
    
    async generateReport(reportParams) {
        try {
            // const response = await fetch(`${this.baseURL}/reports`, {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify(reportParams)
            // });
            // return await response.json();
            
            console.log('Would generate report:', reportParams);
            return { success: true, reportUrl: '/downloads/report.pdf' };
        } catch (error) {
            console.error('Error generating report:', error);
            return { success: false, message: 'Failed to generate report' };
        }
    }
};

// Export for use in Python backend integration
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { API, sampleLearners };
}