import { populateBarangaySelect } from './santa_cruz_barangays.js';

// ALS Portal JavaScript - Main functionality
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();

    // Populate the barangay dropdown
    populateBarangaySelect('learner-barangay'); // <-- pass the select element's ID

    if (document.getElementById("learners-tbody")) {
        loadLearners();
    }
});




// Global variables
let mainMap;
let miniMap;

// Initialize the application
function initializeApp() {
    setupModals();
    setupFilters();
    setupSearch();
    initializeMaps();
    setupFormHandlers();
}

// ---------------- MAP HANDLING ----------------
function initializeMaps() {
    initializeMiniMap();
    initializeMainMap();
}

function initializeMiniMap() {
    const miniMapContainer = document.getElementById('mini-map');
    if (miniMapContainer && !miniMap) {
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
    }
}

function initializeMainMap() {
    setTimeout(() => {
        const mainMapContainer = document.getElementById('main-map');
        if (mainMapContainer && !mainMap) {
            const santaCruzCenter = [14.2843, 121.4158];
            mainMap = L.map('main-map').setView(santaCruzCenter, 13);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(mainMap);
        }
    }, 100);
}

// ---------------- MODALS ----------------
function setupModals() {
    const addLearnerBtn = document.getElementById('add-learner');
    const addLearnerModal = document.getElementById('add-learner-modal');
    if (!addLearnerBtn || !addLearnerModal) return;

    const closeBtn = addLearnerModal.querySelector('.close');
    const cancelBtn = document.getElementById('cancel-add');

    addLearnerBtn.addEventListener('click', () => addLearnerModal.style.display = 'block');
    closeBtn.addEventListener('click', () => addLearnerModal.style.display = 'none');
    cancelBtn.addEventListener('click', () => addLearnerModal.style.display = 'none');

    window.addEventListener('click', (e) => {
        if (e.target === addLearnerModal) addLearnerModal.style.display = 'none';
    });
}

// ---------------- FILTERS ----------------
function setupFilters() {
    const learnerTypeFilter = document.getElementById('learner-type');
    const barangayFilter = document.getElementById('barangay-filter');
    const refreshMapBtn = document.getElementById('refresh-map');

    if (learnerTypeFilter) learnerTypeFilter.addEventListener('change', filterMapData);
    if (barangayFilter) barangayFilter.addEventListener('change', filterMapData);
    if (refreshMapBtn) refreshMapBtn.addEventListener('click', refreshMapData);
}

function filterMapData() { if (mainMap) loadMapData(); }
function refreshMapData() {
    if (mainMap) {
        mainMap.eachLayer(layer => { if (layer instanceof L.CircleMarker) mainMap.removeLayer(layer); });
    }
}
// ---------------- MAP DATA (Fetch from DB) ----------------
async function loadMapData() {
    refreshMapData(); // Clear existing markers

    try {
        // Fetch learners from backend API
        // new: get selected filter values
        const selectedStatus = document.getElementById('learner-type').value;
        const selectedBarangay = document.getElementById('barangay-filter').value;

        const response = await fetch(`http://127.0.0.1:5000/api/learners?status=${selectedStatus}&barangay=${selectedBarangay}`);

        const learners = await response.json();

        learners.forEach(learner => {
            if (learner.lat && learner.lng) {
                const marker = L.circleMarker([learner.lat, learner.lng], {
                    radius: 8,
                    color: getStatusColor(learner.status),
                    fillColor: getStatusColor(learner.status),
                    fillOpacity: 0.7
                }).addTo(mainMap);

                marker.bindPopup(`
                    <strong>${learner.name}</strong><br>
                    Status: ${capitalizeStatus(learner.status)}<br>
                    Barangay: ${learner.barangay}<br>
                    Address: ${learner.address || "-"}
                `);
            }
        });
    } catch (err) {
        console.error("Error loading map data:", err);
    }
}

// Helper: Assign different colors based on learner status
function getStatusColor(status) {
    switch (status) {
        case "graduate": return "#4CAF50"; // green
        case "current": return "#2196F3";  // blue
        case "at-risk": return "#FF9800";  // orange
        case "not-enrolled": return "#F44336"; // red
        default: return "#888888";         // gray
    }
}


// ---------------- SEARCH ----------------
function setupSearch() {
    const searchInput = document.getElementById('learner-search');
    if (!searchInput) return;

    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        filterLearnersTable(searchTerm);
    });
}

function filterLearnersTable(searchTerm) {
    const tableRows = document.querySelectorAll('#learners-tbody tr');
    tableRows.forEach(row => {
        const name = row.cells[0].textContent.toLowerCase();
        const status = row.cells[1].textContent.toLowerCase();
        const barangay = row.cells[2].textContent.toLowerCase();

        row.style.display = (name.includes(searchTerm) || status.includes(searchTerm) || barangay.includes(searchTerm)) ? '' : 'none';
    });
}

// ---------------- FORM HANDLERS ----------------
function setupFormHandlers() {
    const addLearnerForm = document.getElementById('add-learner-form');
    const generateReportBtn = document.getElementById('generate-report');

    if (addLearnerForm) addLearnerForm.addEventListener('submit', handleAddLearner);
    if (generateReportBtn) generateReportBtn.addEventListener('click', handleGenerateReport);

    setupTableActions();
}

async function handleAddLearner(e) {
    e.preventDefault();

    const learnerData = {
        name: document.getElementById('learner-name').value,
        status: document.getElementById('learner-status').value,
        barangay: document.getElementById('learner-barangay').value,
        address: document.getElementById('learner-address').value
    };

    try {
        const response = await fetch("http://127.0.0.1:5000/api/learners", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(learnerData)
        });

        if (!response.ok) throw new Error("Failed to add learner");
        await loadLearners();

        document.getElementById('add-learner-modal').style.display = 'none';
        e.target.reset();

        alert("✅ Learner added successfully!");
    } catch (err) {
        console.error("Error adding learner:", err);
        alert("❌ Error adding learner. Check console for details.");
    }
}

function handleGenerateReport() {
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

// ---------------- TABLE ACTIONS ----------------
function setupTableActions() {
    document.addEventListener('click', function(e) {
        if (e.target.closest('.btn-view')) {
            const row = e.target.closest('tr');
            alert(`Viewing details for: ${row.cells[0].textContent}`);
        }
        if (e.target.closest('.btn-edit')) {
            const row = e.target.closest('tr');
            alert(`Editing: ${row.cells[0].textContent}`);
        }
        if (e.target.closest('.btn-download')) {
            const reportItem = e.target.closest('.report-item');
            alert(`Downloading: ${reportItem.querySelector('h4').textContent}`);
        }
    });
}

// ---------------- LEARNERS TABLE (API Integration) ----------------
async function loadLearners() {
    const tbody = document.getElementById("learners-tbody");
    if (!tbody) return;

    try {
        const response = await fetch("http://127.0.0.1:5000/api/learners");
        const learners = await response.json();

        tbody.innerHTML = "";

        learners.forEach(learner => {
            const tr = document.createElement("tr");

            tr.innerHTML = `
                <td>${learner.name}</td>
                <td><span class="status-badge ${learner.status}">${capitalizeStatus(learner.status)}</span></td>
                <td>${learner.barangay}</td>
                <td>${learner.address || "-"}</td>
                <td>
                    <button class="btn-small btn-view"><i class="fas fa-eye"></i></button>
                    <button class="btn-small btn-edit"><i class="fas fa-edit"></i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error("Error loading learners:", err);
    }
}

function capitalizeStatus(status) {
    switch (status) {
        case "graduate": return "Graduate";
        case "current": return "Current";
        case "at-risk": return "At-Risk";
        case "not-enrolled": return "Not Enrolled";
        default: return status;
    }
}
