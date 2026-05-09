// Global variables
let allLearners = [];
let filteredLearners = [];
let currentLearnerId = null;

function confirmLogout() {
    if (confirm('Are you sure you want to logout?')) {
        window.location.href = '/';
    }
    return false;
}

// Load statistics
async function loadStats() {
    try {
        const response = await fetch('/api/af1-statistics');
        const stats = await response.json();
        
        // Calculate interested count from stats
        const interested = stats.by_status ? Object.keys(stats.by_status).reduce((sum, key) => {
            return sum + (key.toLowerCase().includes('interested') ? stats.by_status[key] : 0);
        }, 0) : 0;
        
        document.getElementById('statTotal').textContent = stats.total || 0;
        document.getElementById('statInterested').textContent = interested || 0;
        document.getElementById('statGeocoded').textContent = 0;
        document.getElementById('statThisYear').textContent = stats.total || 0;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Load AF1 learners data
async function loadLearners() {
    try {
        const response = await fetch('/api/af1-learners');
        allLearners = await response.json();
        filteredLearners = [...allLearners];
        
        populateFilters();
        displayLearners(filteredLearners);
    } catch (error) {
        console.error('Error loading learners:', error);
        const tbody = document.getElementById('learnersTableBody');
        tbody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align: center; padding: 40px;">
                    <div class="empty-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h3>Error Loading Data</h3>
                        <p>Failed to load learners data. Please try again.</p>
                    </div>
                </td>
            </tr>
        `;
    }
}

// Populate filter dropdowns
function populateFilters() {
    // Barangay filter
    const barangays = [...new Set(allLearners.map(l => l.barangay).filter(Boolean))].sort();
    const barangaySelect = document.getElementById('barangayFilter');
    barangays.forEach(barangay => {
        const option = document.createElement('option');
        option.value = barangay;
        option.textContent = barangay;
        barangaySelect.appendChild(option);
    });

    // Learner type filter
    const learnerTypes = [...new Set(allLearners.map(l => l.learner_type).filter(Boolean))].sort();
    const learnerTypeSelect = document.getElementById('learnerTypeFilter');
    learnerTypes.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        learnerTypeSelect.appendChild(option);
    });
}

// Display learners in table
function displayLearners(learners) {
    const tbody = document.getElementById('learnersTableBody');
    
    // Reset to page 1 when filtering
    if (learners !== allLearners) {
        currentPage = 1;
    }
    
    if (learners.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10" style="text-align: center; padding: 40px;">
                    <div class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <h3>No Learners Found</h3>
                        <p>There are no learners matching your filters.</p>
                    </div>
                </td>
            </tr>
        `;
        // Clear pagination controls
        let paginationContainer = document.getElementById('learnersTablePagination');
        if (paginationContainer) {
            paginationContainer.innerHTML = '';
        }
        return;
    }
    
    // Sort learners alphabetically by last name, then first name
    const sortedLearners = [...learners].sort((a, b) => {
        const lastNameA = (a.last_name || '').toLowerCase().trim();
        const lastNameB = (b.last_name || '').toLowerCase().trim();
        
        if (lastNameA !== lastNameB) {
            return lastNameA.localeCompare(lastNameB);
        }
        
        const firstNameA = (a.first_name || '').toLowerCase().trim();
        const firstNameB = (b.first_name || '').toLowerCase().trim();
        return firstNameA.localeCompare(firstNameB);
    });
    
    // Calculate pagination
    const totalPages = Math.ceil(sortedLearners.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedLearners = sortedLearners.slice(startIndex, endIndex);
    
    // Display learners for current page
    tbody.innerHTML = paginatedLearners.map(learner => {
        const fullName = `${learner.last_name} ${learner.first_name} ${learner.middle_name || ''}`.trim();
        const interestedBadge = learner.interested_in_als 
            ? '<span class="status-badge yes"><i class="fas fa-check"></i> Yes</span>'
            : '<span class="status-badge no"><i class="fas fa-times"></i> No</span>';
        const geocodedBadge = learner.geocoded
            ? '<span class="status-badge geocoded"><i class="fas fa-map-marker-alt"></i> Yes</span>'
            : '<span class="status-badge not-geocoded"><i class="fas fa-map-marker-alt"></i> No</span>';
        
        return `
            <tr>
                <td>${fullName}</td>
                <td>${learner.sex || 'N/A'}</td>
                <td>${learner.age || 'N/A'}</td>
                <td>${learner.barangay || 'N/A'}</td>
                <td>${learner.contact_number || 'N/A'}</td>
                <td>${learner.last_grade_completed || 'N/A'}</td>
                <td>${interestedBadge}</td>
                <td>${geocodedBadge}</td>
                <td>
                    <button class="btn-icon" onclick="viewLearner('${learner.id}')" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon" onclick="archiveLearner('${learner.id}')" title="Archive" style="color: #e74c3c; transition: all 0.2s;">
                        <i class="fas fa-archive"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
    
    // Update pagination controls
    updatePaginationControls(totalPages, sortedLearners.length);
}

let currentPage = 1;
const itemsPerPage = 10;

function updatePaginationControls(totalPages, totalItems) {
    let paginationHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 20px; padding: 0 20px;">
            <div style="color: #7f8c8d; font-size: 13px;">
                Showing ${(currentPage - 1) * itemsPerPage + 1} to ${Math.min(currentPage * itemsPerPage, totalItems)} of ${totalItems} learners
            </div>
            <div style="display: flex; gap: 8px;">
    `;
    
    if (currentPage > 1) {
        paginationHTML += `<button class="btn-secondary" onclick="goToPage(1)" style="padding: 6px 10px; font-size: 12px;">First</button>`;
        paginationHTML += `<button class="btn-secondary" onclick="goToPage(${currentPage - 1})" style="padding: 6px 10px; font-size: 12px;">Previous</button>`;
    }
    
    for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
        if (i === currentPage) {
            paginationHTML += `<button class="btn-primary" style="padding: 6px 10px; font-size: 12px; cursor: default;">${i}</button>`;
        } else {
            paginationHTML += `<button class="btn-secondary" onclick="goToPage(${i})" style="padding: 6px 10px; font-size: 12px;">${i}</button>`;
        }
    }
    
    if (currentPage < totalPages) {
        paginationHTML += `<button class="btn-secondary" onclick="goToPage(${currentPage + 1})" style="padding: 6px 10px; font-size: 12px;">Next</button>`;
        paginationHTML += `<button class="btn-secondary" onclick="goToPage(${totalPages})" style="padding: 6px 10px; font-size: 12px;">Last</button>`;
    }
    
    paginationHTML += `</div></div>`;
    
    let paginationContainer = document.getElementById('learnersTablePagination');
    if (!paginationContainer) {
        paginationContainer = document.createElement('div');
        paginationContainer.id = 'learnersTablePagination';
        document.querySelector('.table-container').appendChild(paginationContainer);
    }
    paginationContainer.innerHTML = paginationHTML;
}

function goToPage(page) {
    currentPage = page;
    displayLearners(allLearners);
}

// View learner details
async function viewLearner(id) {
    try {
        // Find learner from the allLearners array
        // Convert id to number since database returns bigint
        const learnerId = parseInt(id, 10);
        const learner = allLearners.find(l => parseInt(l.id, 10) === learnerId);
        
        if (!learner) {
            alert('Learner not found.');
            return;
        }
        
        currentLearnerId = id;
        
        const fullName = `${learner.first_name} ${learner.middle_name || ''} ${learner.last_name} ${learner.name_extension || ''}`.trim();
        
        document.querySelector('#viewModal .modal-content #modalDetailsGrid').innerHTML = `
            <!-- Personal Information -->
            <div class="detail-section">
                <h3><i class="fas fa-user"></i> Personal Information</h3>
                <div class="detail-item">
                    <div class="detail-label">Full Name</div>
                    <div class="detail-value">${fullName}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Sex</div>
                    <div class="detail-value">${learner.sex || 'N/A'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Date of Birth</div>
                    <div class="detail-value">${learner.date_of_birth ? new Date(learner.date_of_birth).toLocaleDateString() : 'N/A'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Age</div>
                    <div class="detail-value">${learner.age || 'N/A'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Learner Type</div>
                    <div class="detail-value">${learner.learner_type || 'N/A'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">IP</div>
                    <div class="detail-value">${learner.ip || 'N/A'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Religion</div>
                    <div class="detail-value">${learner.religion || 'N/A'}</div>
                </div>
            </div>

            <!-- Address Information -->
            <div class="detail-section">
                <h3><i class="fas fa-map-marker-alt"></i> Address Information</h3>
                <div class="detail-item">
                    <div class="detail-label">House Number</div>
                    <div class="detail-value">${learner.house_number || 'N/A'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Street</div>
                    <div class="detail-value">${learner.street || 'N/A'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Sitio/Purok</div>
                    <div class="detail-value">${learner.sitio_purok || 'N/A'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Barangay</div>
                    <div class="detail-value">${learner.barangay || 'N/A'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Municipality/City</div>
                    <div class="detail-value">${learner.municipality_city || 'N/A'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Province</div>
                    <div class="detail-value">${learner.province || 'N/A'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Contact Number</div>
                    <div class="detail-value">${learner.contact_number || 'N/A'}</div>
                </div>
                ${learner.geocoded ? `
                    <div class="detail-item">
                        <div class="detail-label">Coordinates</div>
                        <div class="detail-value">Lat: ${learner.lat}, Lng: ${learner.lng}</div>
                    </div>
                ` : ''}
            </div>

            <!-- Family Information -->
            <div class="detail-section">
                <h3><i class="fas fa-users"></i> Family Information</h3>
                <div class="detail-item">
                    <div class="detail-label">Father's Name</div>
                    <div class="detail-value">${learner.father_name || 'N/A'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Mother's Name</div>
                    <div class="detail-value">${learner.mother_name || 'N/A'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Guardian's Name</div>
                    <div class="detail-value">${learner.guardian_name || 'N/A'}</div>
                </div>
            </div>

            <!-- Education Information -->
            <div class="detail-section">
                <h3><i class="fas fa-graduation-cap"></i> Education Information</h3>
                <div class="detail-item">
                    <div class="detail-label">Last Grade Completed</div>
                    <div class="detail-value">${learner.last_grade_completed || 'N/A'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Last School Attended</div>
                    <div class="detail-value">${learner.last_school_attended || 'N/A'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Year Last Attended</div>
                    <div class="detail-value">${learner.year_last_attended || 'N/A'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Dropout Reason</div>
                    <div class="detail-value">${learner.dropout_reason || 'N/A'}</div>
                </div>
            </div>

            <!-- ALS Information -->
            <div class="detail-section">
                <h3><i class="fas fa-info-circle"></i> ALS Information</h3>
                <div class="detail-item">
                    <div class="detail-label">ALS Status</div>
                    <div class="detail-value">${learner.als_status || 'N/A'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Interested in ALS</div>
                    <div class="detail-value">${learner.interested_in_als ? 'Yes' : 'No'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Preferred Program</div>
                    <div class="detail-value">${learner.preferred_program || 'N/A'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Preferred Learning Site</div>
                    <div class="detail-value">${learner.preferred_learning_site || 'N/A'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Learner Type Class</div>
                    <div class="detail-value">${learner.learner_type_class || 'N/A'}</div>
                </div>
            </div>

            <!-- Administrative Information -->
            <div class="detail-section">
                <h3><i class="fas fa-file-alt"></i> Administrative</h3>
                <div class="detail-item">
                    <div class="detail-label">Region</div>
                    <div class="detail-value">${learner.region || 'N/A'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Division</div>
                    <div class="detail-value">${learner.division || 'N/A'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">District</div>
                    <div class="detail-value">${learner.district || 'N/A'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Calendar Year</div>
                    <div class="detail-value">${learner.calendar_year || 'N/A'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Remarks</div>
                    <div class="detail-value">${learner.remarks || 'N/A'}</div>
                </div>
            </div>
        `;
        
        document.getElementById('viewModal').classList.add('show');
    } catch (error) {
        console.error('Error viewing learner:', error);
        alert('Failed to load learner details. Please try again.');
    }
}

function closeModal() {
    document.getElementById('viewModal').classList.remove('show');
    currentLearnerId = null;
}

// Filter functionality
function applyFilters() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const sexFilter = document.getElementById('sexFilter').value;
    const barangayFilter = document.getElementById('barangayFilter').value;
    const learnerTypeFilter = document.getElementById('learnerTypeFilter').value;
    const interestedFilter = document.getElementById('interestedFilter').value;
    
    filteredLearners = allLearners.filter(learner => {
        const fullName = `${learner.first_name} ${learner.middle_name || ''} ${learner.last_name}`.toLowerCase();
        const barangay = (learner.barangay || '').toLowerCase();
        const contact = (learner.contact_number || '').toLowerCase();
        
        const matchesSearch = fullName.includes(searchTerm) || 
                            barangay.includes(searchTerm) || 
                            contact.includes(searchTerm);
        
        const matchesSex = sexFilter === 'all' || learner.sex === sexFilter;
        const matchesBarangay = barangayFilter === 'all' || learner.barangay === barangayFilter;
        const matchesLearnerType = learnerTypeFilter === 'all' || learner.learner_type === learnerTypeFilter;
        
        let matchesInterested = true;
        if (interestedFilter === 'yes') {
            matchesInterested = learner.interested_in_als === true;
        } else if (interestedFilter === 'no') {
            matchesInterested = learner.interested_in_als === false;
        }
        
        return matchesSearch && matchesSex && matchesBarangay && matchesLearnerType && matchesInterested;
    });
    
    displayLearners(filteredLearners);
}

// Export to CSV
function exportToCSV() {
    // Use only form fields for export
    const headers = AF1_FIELDS.map(field => field.label);
    
    const rows = filteredLearners.map(learner => {
        return AF1_FIELDS.map(field => {
            let value = learner[field.key];
            if (value === null || value === undefined) {
                value = '';
            }
            // Handle boolean fields
            if (field.key === 'interested_in_als' && value !== '') {
                value = value ? 'Yes' : 'No';
            }
            return String(value);
        });
    });
    
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `als_af1_learners_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (!user.id || user.role !== 'admin') {
        alert('Unauthorized access. Redirecting to login.');
        window.location.href = '/';
        return;
    }

    if (user.username) {
        document.getElementById('adminName').textContent = `Welcome, ${user.username}`;
    }

    // Load data
    await loadStats();
    await loadLearners();
    
    // Setup event listeners
    document.getElementById('searchInput').addEventListener('input', applyFilters);
    document.getElementById('sexFilter').addEventListener('change', applyFilters);
    document.getElementById('barangayFilter').addEventListener('change', applyFilters);
    document.getElementById('learnerTypeFilter').addEventListener('change', applyFilters);
    document.getElementById('interestedFilter').addEventListener('change', applyFilters);
});

// Add Learner Modal Functions
function openAddLearnerModal() {
    document.getElementById('addLearnerModal').classList.add('show');
}

function closeAddLearnerModal() {
    document.getElementById('addLearnerModal').classList.remove('show');
    document.getElementById('addLearnerForm').reset();
}

// Handle conditional ALS fields visibility
document.addEventListener('DOMContentLoaded', function() {
    const interestedInALSSelect = document.getElementById('interestedInAls');
    const conditionalFields = document.getElementById('alsConditionalFields');
    
    if (interestedInALSSelect && conditionalFields) {
        interestedInALSSelect.addEventListener('change', function() {
            if (this.value === 'true') {
                conditionalFields.style.display = 'block';
            } else {
                conditionalFields.style.display = 'none';
            }
        });
    }
});

async function submitAddLearner(event) {
    event.preventDefault();
    
    try {
        const learnerData = {
            // Personal Information
            last_name: document.getElementById('lastName').value,
            first_name: document.getElementById('firstName').value,
            middle_name: document.getElementById('middleName').value || null,
            name_extension: document.getElementById('nameExtension').value || null,
            sex: document.getElementById('sex').value || null,
            date_of_birth: document.getElementById('dob').value || null,
            age: document.getElementById('age').value ? parseInt(document.getElementById('age').value) : null,
            ip: document.getElementById('ip').value || null,
            religion: document.getElementById('religion').value || null,
            mother_tongue: document.getElementById('motherTongue').value || null,
            
            // Address Information
            house_number: document.getElementById('houseNumber').value || null,
            street: document.getElementById('street').value || null,
            sitio_purok: document.getElementById('sitioPurok').value || null,
            barangay: document.getElementById('barangay').value,
            municipality_city: document.getElementById('municipalityCity').value || null,
            province: document.getElementById('province').value || null,
            contact_number: document.getElementById('contactNumber').value || null,
            
            // Family Information
            father_name: document.getElementById('fatherName').value || null,
            mother_name: document.getElementById('motherName').value || null,
            
            // Education Information
            last_grade_completed: document.getElementById('lastGrade').value || null,
            
            // ALS Information
            als_status: document.getElementById('alsStatus').value || null,
            interested_in_als: document.getElementById('interestedInAls').value ? document.getElementById('interestedInAls').value === 'true' : null,
            preferred_program: document.getElementById('preferredProgram').value || null,
            learner_type_class: document.getElementById('learnerTypeClass').value || null,
            
            // Administrative Information
            region: document.getElementById('region').value || null,
            division: document.getElementById('division').value || null,
            district: document.getElementById('district').value || null,
            calendar_year: (() => {
                const startYear = document.getElementById('calendarYearStart').value;
                const endYear = document.getElementById('calendarYearEnd').value;
                if (startYear && endYear) {
                    return `S.Y. ${startYear} - ${endYear}`;
                }
                return null;
            })()
        };
        
        const response = await fetch('/api/af1-learners', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(learnerData)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to add learner');
        }

        await response.json();
        
        // Close modal and refresh
        closeAddLearnerModal();
        alert('Learner added successfully!');
        
        // Reload data
        await loadStats();
        await loadLearners();
    } catch (error) {
        console.error('Error adding learner:', error);
        alert('Error adding learner: ' + error.message);
    }
}

// CSV Import Variables
let csvData = [];
let csvHeaders = [];
let columnMapping = {};
let currentImportStep = 1;
let importSettings = {
    region: '4-A',
    division: 'Laguna',
    district: 'Santa Cruz',
    calendar_year_start: new Date().getFullYear(),
    calendar_year_end: new Date().getFullYear()
};

const AF1_FIELDS = [
    // Personal Information
    { key: 'last_name', label: 'Last Name', required: true },
    { key: 'first_name', label: 'First Name', required: true },
    { key: 'middle_name', label: 'Middle Name' },
    { key: 'name_extension', label: 'Name Extension' },
    { key: 'sex', label: 'Sex' },
    { key: 'date_of_birth', label: 'Date of Birth' },
    { key: 'age', label: 'Age' },
    { key: 'ip', label: 'Indigenous People (IP)' },
    { key: 'religion', label: 'Religion' },
    { key: 'mother_tongue', label: 'Mother Tongue' },
    
    // Address Information
    { key: 'house_number', label: 'House Number' },
    { key: 'street', label: 'Street' },
    { key: 'sitio_purok', label: 'Sitio/Purok' },
    { key: 'barangay', label: 'Barangay', required: true },
    { key: 'municipality_city', label: 'Municipality/City' },
    { key: 'province', label: 'Province' },
    { key: 'contact_number', label: 'Contact Number' },
    
    // Family Information
    { key: 'father_name', label: "Father's Name" },
    { key: 'mother_name', label: "Mother's Name" },
    
    // Education Information
    { key: 'last_grade_completed', label: 'Last Grade Completed' },
    
    // ALS Information
    { key: 'interested_in_als', label: 'Interested in ALS' },
    { key: 'als_status', label: 'ALS Status' },
    { key: 'preferred_program', label: 'Preferred Program' },
    { key: 'learner_type_class', label: 'Learner Type Class' },
    
    // Administrative Information
    { key: 'region', label: 'Region' },
    { key: 'division', label: 'Division' },
    { key: 'district', label: 'District' },
    { key: 'calendar_year', label: 'Calendar Year' }
];

// CSV Import Modal Functions
function openImportCSVModal() {
    csvData = [];
    csvHeaders = [];
    columnMapping = {};
    currentImportStep = 1;
    document.getElementById('importCSVModal').classList.add('show');
    showCSVStep(1);
}

function closeImportCSVModal() {
    document.getElementById('importCSVModal').classList.remove('show');
    document.getElementById('csvFile').value = '';
    document.getElementById('csvFileName').style.display = 'none';
}

function handleCSVUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const csv = e.target.result;
            const lines = csv.trim().split('\n');
            
            if (lines.length < 2) {
                alert('CSV file must have at least a header row and one data row');
                return;
            }
            
            // Parse CSV
            csvHeaders = lines[0].split(',').map(h => h.trim());
            csvData = [];
            
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => v.trim());
                const row = {};
                csvHeaders.forEach((header, index) => {
                    row[header] = values[index] || '';
                });
                csvData.push(row);
            }
            
            if (csvData.length === 0) {
                alert('No data rows found in CSV');
                return;
            }
            
            // Auto-map CSV columns to AF1_FIELDS
            columnMapping = {};
            AF1_FIELDS.forEach(field => {
                // Try to find matching CSV header
                const matchingHeader = csvHeaders.find(header => 
                    header.toLowerCase() === field.label.toLowerCase()
                );
                if (matchingHeader) {
                    columnMapping[field.key] = matchingHeader;
                }
            });
            
            // Show success
            document.getElementById('csvNameDisplay').textContent = file.name;
            document.getElementById('csvFileName').style.display = 'block';
            
            // Move to preview step (skip mapping)
            currentImportStep = 3;
            generateCSVPreview();
            showCSVStep(3);
            
        } catch (error) {
            console.error('Error parsing CSV:', error);
            alert('Error parsing CSV file. Please ensure it is properly formatted.');
        }
    };
    reader.readAsText(file);
}

function showCSVStep(step) {
    currentImportStep = step;
    
    // Hide all steps
    document.getElementById('csvImportStep1').style.display = 'none';
    document.getElementById('csvImportStep2').style.display = 'none';
    document.getElementById('csvImportStep3').style.display = 'none';
    
    // Show current step
    document.getElementById(`csvImportStep${step}`).style.display = 'block';
    
    // Update buttons - always show Next button for step 3
    document.getElementById('csvPrevBtn').style.display = step > 1 ? 'inline-block' : 'none';
    document.getElementById('csvNextBtn').style.display = step < 4 ? 'inline-block' : 'none';
    
    if (step === 2) {
        generateColumnMappings();
    } else if (step === 3) {
        generateCSVPreview();
    }
}

function generateColumnMappings() {
    const container = document.getElementById('columnMappingContainer');
    container.innerHTML = '';
    
    AF1_FIELDS.forEach(field => {
        const div = document.createElement('div');
        div.style.padding = '15px';
        div.style.background = '#f9f9f9';
        div.style.borderRadius = '6px';
        div.style.border = '1px solid #ddd';
        
        const label = document.createElement('label');
        label.style.fontWeight = '500';
        label.style.marginBottom = '8px';
        label.style.display = 'block';
        label.style.color = '#2c3e50';
        label.textContent = field.label + (field.required ? ' *' : '');
        
        const select = document.createElement('select');
        select.id = `mapping_${field.key}`;
        select.style.width = '100%';
        select.style.padding = '10px';
        select.style.borderRadius = '4px';
        select.style.border = '1px solid #ddd';
        select.style.fontFamily = 'inherit';
        
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = '-- Skip --';
        select.appendChild(emptyOption);
        
        csvHeaders.forEach(header => {
            const option = document.createElement('option');
            option.value = header;
            option.textContent = header;
            select.appendChild(option);
        });
        
        select.addEventListener('change', (e) => {
            if (e.target.value) {
                columnMapping[field.key] = e.target.value;
            } else {
                delete columnMapping[field.key];
            }
        });
        
        div.appendChild(label);
        div.appendChild(select);
        container.appendChild(div);
    });
}

function generateCSVPreview() {
    const tbody = document.getElementById('csvPreviewTable');
    tbody.innerHTML = '';
    
    // Convert mapped data
    const mappedLearners = csvData.map(row => {
        const learner = {};
        Object.entries(columnMapping).forEach(([key, csvHeader]) => {
            learner[key] = row[csvHeader] || '';
        });
        return learner;
    });
    
    // Show preview of first 5 rows
    mappedLearners.slice(0, 5).forEach(learner => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #ddd';
        tr.innerHTML = `
            <td style="padding: 12px; border-right: 1px solid #ddd;">${learner.last_name || '-'}</td>
            <td style="padding: 12px; border-right: 1px solid #ddd;">${learner.first_name || '-'}</td>
            <td style="padding: 12px; border-right: 1px solid #ddd;">${learner.middle_name || '-'}</td>
            <td style="padding: 12px; border-right: 1px solid #ddd;">${learner.sex || '-'}</td>
            <td style="padding: 12px; border-right: 1px solid #ddd;">${learner.barangay || '-'}</td>
            <td style="padding: 12px;">${learner.contact_number || '-'}</td>
        `;
        tbody.appendChild(tr);
    });
    
    document.getElementById('csvTotalCount').textContent = csvData.length;
}

function showCSVSettingsDialog() {
    const dialog = document.createElement('div');
    dialog.id = 'csvSettingsDialog';
    dialog.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10001;';
    
    dialog.innerHTML = `
        <div style="background: white; border-radius: 8px; padding: 24px; max-width: 500px; width: 90%;">
            <h3 style="margin: 0 0 20px 0; color: #333; font-size: 16px;">Import Settings</h3>
            
            <div style="margin-bottom: 16px;">
                <label style="display: block; font-size: 12px; color: #666; margin-bottom: 6px; font-weight: 600;">Region</label>
                <input type="text" id="csvRegion" value="4-A" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
            </div>
            
            <div style="margin-bottom: 16px;">
                <label style="display: block; font-size: 12px; color: #666; margin-bottom: 6px; font-weight: 600;">Division</label>
                <input type="text" id="csvDivision" value="Laguna" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
            </div>
            
            <div style="margin-bottom: 16px;">
                <label style="display: block; font-size: 12px; color: #666; margin-bottom: 6px; font-weight: 600;">District</label>
                <input type="text" id="csvDistrict" value="Santa Cruz" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
            </div>
            
            <div style="margin-bottom: 16px;">
                <label style="display: block; font-size: 12px; color: #666; margin-bottom: 6px; font-weight: 600;">School Year Start</label>
                <input type="number" id="csvCalendarYearStart" min="2000" max="2100" value="${new Date().getFullYear()}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; font-size: 12px; color: #666; margin-bottom: 6px; font-weight: 600;">School Year End</label>
                <input type="number" id="csvCalendarYearEnd" min="2000" max="2100" value="${new Date().getFullYear()}" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
            </div>
            
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button onclick="closeCSVSettingsDialog()" style="padding: 8px 16px; border: 1px solid #ddd; background: white; color: #333; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 13px;">Cancel</button>
                <button onclick="proceedWithImport()" style="padding: 8px 16px; background: linear-gradient(135deg, #667eea, #764ba2); color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 13px;">Import</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
}

function closeCSVSettingsDialog() {
    const dialog = document.getElementById('csvSettingsDialog');
    if (dialog) dialog.remove();
}

function proceedWithImport() {
    // Capture settings
    importSettings.region = document.getElementById('csvRegion').value || '4-A';
    importSettings.division = document.getElementById('csvDivision').value || 'Laguna';
    importSettings.district = document.getElementById('csvDistrict').value || 'Santa Cruz';
    importSettings.calendar_year_start = parseInt(document.getElementById('csvCalendarYearStart').value);
    importSettings.calendar_year_end = parseInt(document.getElementById('csvCalendarYearEnd').value);
    
    closeCSVSettingsDialog();
    submitCSVImport();
}

function nextCSVStep() {
    if (currentImportStep === 3) {
        // Show settings dialog before final import
        showCSVSettingsDialog();
    }
}

function previousCSVStep() {
    if (currentImportStep > 1) {
        showCSVStep(currentImportStep - 1);
    }
}

async function submitCSVImport() {
    try {
        // Build learner objects with mapped data
        const learnersToImport = csvData.map(row => {
            const learner = {};
            
            // Map each AF1 field
            AF1_FIELDS.forEach(field => {
                // Find the CSV column that matches this field
                const csvColumn = csvHeaders.find(header => 
                    header.toLowerCase() === field.label.toLowerCase()
                );
                
                if (csvColumn && row[csvColumn]) {
                    const value = row[csvColumn];
                    
                    // Handle type conversions
                    if (field.key === 'interested_in_als') {
                        learner[field.key] = value.toLowerCase() === 'yes' || value === 'true' || value === '1';
                    } else if (field.key === 'age') {
                        learner[field.key] = value ? parseInt(value) : null;
                    } else {
                        learner[field.key] = value;
                    }
                }
            });
            
            // Apply import settings to all rows
            learner.region = importSettings.region;
            learner.division = importSettings.division;
            learner.district = importSettings.district;
            learner.calendar_year = `S.Y. ${importSettings.calendar_year_start} - ${importSettings.calendar_year_end}`;
            
            return learner;
        });
        
        const response = await fetch('/api/af1-learners/batch-import', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ learners: learnersToImport })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            alert(`Successfully imported ${result.imported} learner(s)!`);
            closeImportCSVModal();
            
            // Reload data
            await loadStats();
            await loadLearners();
        } else {
            alert('Failed to import learners. Please try again.');
        }
    } catch (error) {
        console.error('Error importing learners:', error);
        alert('Error importing learners. Please check the console for details.');
    }
}

// Image Recognition (OCR) Variables
let ocrExtractedData = [];
let selectedImageFiles = [];

// Image Recognition Modal Functions
function openImageRecognitionModal() {
    ocrExtractedData = [];
    selectedImageFiles = [];
    document.getElementById('imageRecognitionModal').classList.add('show');
    document.getElementById('imageUploadStep').style.display = 'block';
    document.getElementById('imageProcessingStep').style.display = 'none';
    document.getElementById('imageResultsStep').style.display = 'none';
    document.getElementById('imageFiles').value = '';
    document.getElementById('imageFilesList').style.display = 'none';
}

function closeImageRecognitionModal() {
    document.getElementById('imageRecognitionModal').classList.remove('show');
}

function handleImageUpload(event) {
    const files = Array.from(event.target.files);
    if (!files.length) return;
    
    selectedImageFiles = files;
    
    const ul = document.getElementById('filesUL');
    ul.innerHTML = '';
    
    files.forEach(file => {
        const li = document.createElement('li');
        li.style.padding = '8px';
        li.style.background = '#f5f7fa';
        li.style.borderRadius = '4px';
        li.style.marginBottom = '8px';
        li.style.display = 'flex';
        li.style.alignItems = 'center';
        li.style.gap = '10px';
        li.innerHTML = `<i class="fas fa-file-image" style="color: #3498db;"></i> ${file.name}`;
        ul.appendChild(li);
    });
    
    document.getElementById('imageFilesList').style.display = 'block';
    document.getElementById('startOCRBtn').style.display = 'inline-block';
}

async function startOCRProcessing() {
    if (!selectedImageFiles.length) {
        alert('Please select at least one image');
        return;
    }
    
    // Show processing step
    document.getElementById('imageUploadStep').style.display = 'none';
    document.getElementById('imageProcessingStep').style.display = 'block';
    document.getElementById('imageResultsStep').style.display = 'none';
    
    ocrExtractedData = [];
    const totalFiles = selectedImageFiles.length;
    
    try {
        for (let i = 0; i < selectedImageFiles.length; i++) {
            const file = selectedImageFiles[i];
            document.getElementById('processingStatus').textContent = `Processing image ${i + 1} of ${totalFiles}...`;
            document.getElementById('processingProgress').style.width = ((i / totalFiles) * 100) + '%';
            
            // Read image
            const imageData = await readFileAsDataURL(file);
            
            // Run OCR
            const result = await Tesseract.recognize(imageData, 'eng', {
                logger: m => {
                    if (m.status === 'recognizing') {
                        const progress = Math.round(m.progress * 100);
                        document.getElementById('processingProgress').style.width = ((i + m.progress) / totalFiles) * 100 + '%';
                    }
                }
            });
            
            const text = result.data.text;
            const extractedLearners = parseAF1FormText(text);
            ocrExtractedData.push(...extractedLearners);
        }
        
        document.getElementById('processingProgress').style.width = '100%';
        
        // Show results
        setTimeout(() => {
            displayOCRResults();
        }, 500);
        
    } catch (error) {
        console.error('OCR Error:', error);
        alert('Error processing image. Please try again.');
        document.getElementById('imageUploadStep').style.display = 'block';
        document.getElementById('imageProcessingStep').style.display = 'none';
    }
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function parseAF1FormText(text) {
    // AF1 form parser - intelligently extracts learner data from table structure
    
    const learners = [];
    const lines = text.split('\n');
    
    // Strong header/non-data keywords to skip
    const headerKeywords = [
        'department', 'education', 'alternative', 'learning', 'system', 'masterlist', 'mapped',
        'potential', 'complete', 'home', 'parents', 'remarks', 'prepared', 'certified', 'sfrt',
        'signature', 'facilitator', 'principal', 'calendar', 'enrolled', 'total', 'male',
        'female', 'district', 'division', 'region'
    ];
    
    // Barangay list for detection
    const barangays = ['bubukal', 'calios', 'duhat', 'gatid', 'jasaan', 'labuin', 'malinao', 'oogong', 'pagsawitan', 'palasan', 'patimbao', 'san jose', 'san juan', 'san pablo', 'santisima cruz', 'santo angel', 'alipit', 'bagumbayan', 'poblacion'];
    
    // Find lines that look like actual data rows
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Skip empty lines and very short lines
        if (!line || line.length < 10) continue;
        
        const lowerLine = line.toLowerCase();
        
        // Count header keywords in this line
        const headerCount = headerKeywords.filter(kw => lowerLine.includes(kw)).length;
        
        // Skip if too many header keywords (likely a section header)
        if (headerCount >= 3) continue;
        
        // Skip if it's clearly a field label line (contains colons with short values)
        if (lowerLine.match(/^(name|sex|age|date|barangay|province|contact|religion|street|house|guardian|mother|father|grade|school)[\s:]/)) continue;
        
        // Split by multiple spaces to detect table columns
        const parts = line.split(/\s{2,}/).map(p => p.trim()).filter(p => p.length > 0);
        
        // Valid data row should have multiple parts
        if (parts.length >= 3) {
            const extracted = extractFromTableRow(parts, barangays);
            
            // Accept if we have a valid name with at least one additional data field
            if (extracted.first_name && extracted.last_name) {
                learners.push(extracted);
            }
        }
    }
    
    return learners;
}

function extractFromTableRow(parts, barangays) {
    // Extract learner data from table row parts
    const learner = {
        last_name: '',
        first_name: '',
        middle_name: '',
        sex: '',
        age: null,
        barangay: '',
        contact_number: '',
        date_of_birth: '',
        confidence: 0.75
    };
    
    let nameFound = false;
    
    // First pass: Find the name (usually in first 1-2 parts)
    for (let j = 0; j < Math.min(parts.length, 2); j++) {
        const part = parts[j].trim();
        if (!part || part.length < 3) continue;
        
        // Check if this looks like a name (letters, spaces, comma, periods)
        if (part.match(/^[A-Za-z\s,\.'-]+$/) && part.length > 5) {
            const nameData = extractFromNameString(part);
            
            // Accept if we got both first and last name
            if (nameData.first_name && nameData.last_name) {
                Object.assign(learner, nameData);
                nameFound = true;
                learner.confidence = 0.85;
                break;
            }
        }
    }
    
    // If no valid name found, skip this row
    if (!nameFound) {
        return { first_name: '', last_name: '' };
    }
    
    // Second pass: Extract other fields from remaining parts
    for (let j = 0; j < parts.length; j++) {
        const part = parts[j].trim();
        if (!part) continue;
        
        const lowerPart = part.toLowerCase();
        
        // Sex detection (single letter M/F)
        if (part.match(/^[MF]$/i) && !learner.sex) {
            learner.sex = part.toUpperCase() === 'M' ? 'Male' : 'Female';
        }
        
        // Age detection (1-2 digit number, reasonable age)
        if (part.match(/^\d{1,2}$/) && !learner.age) {
            const num = parseInt(part);
            if (num > 5 && num < 100) {
                learner.age = num;
            }
        }
        
        // Phone detection (10+ digits, starting with 0 or +63)
        if (part.match(/^(\+?63|0)[0-9]{9,10}$/) || part.match(/^09\d{8,9}$/)) {
            learner.contact_number = part;
        }
        
        // Barangay detection
        for (const barangay of barangays) {
            if (lowerPart === barangay || lowerPart === barangay.replace(' ', '')) {
                learner.barangay = part;
                break;
            }
        }
        
        // Date of birth (MM/DD/YYYY or DD/MM/YYYY)
        if (part.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/)) {
            learner.date_of_birth = part;
        }
    }
    
    return learner;
}

function extractFromTableRow(parts, barangays) {
    // Extract learner data from table row parts
    const learner = {
        last_name: '',
        first_name: '',
        middle_name: '',
        sex: '',
        age: null,
        barangay: '',
        contact_number: '',
        date_of_birth: '',
        confidence: 0.80
    };
    
    let nameExtracted = false;
    
    for (let j = 0; j < parts.length; j++) {
        const part = parts[j].trim();
        if (!part) continue;
        
        const lowerPart = part.toLowerCase();
        
        // Name extraction (usually first 1-3 parts)
        if (!nameExtracted && j < 3 && part.match(/^[A-Za-z\s.,]+$/) && part.length > 2) {
            const nameData = extractFromNameString(part);
            if (nameData.first_name && nameData.last_name) {
                Object.assign(learner, nameData);
                nameExtracted = true;
                learner.confidence = 0.85;
            }
        }
        
        // Sex detection (single letter M/F or Male/Female)
        if (part.match(/^[MF]$/i) || lowerPart === 'male' || lowerPart === 'female') {
            learner.sex = part.toUpperCase()[0] === 'M' ? 'Male' : 'Female';
        }
        
        // Age detection (2 digit number usually in middle columns)
        if (part.match(/^\d{1,2}$/) && !learner.age) {
            const num = parseInt(part);
            if (num > 5 && num < 120) {
                learner.age = num;
            }
        }
        
        // Phone detection
        if (part.match(/^(\+?63|0)[0-9]{9,10}/)) {
            learner.contact_number = part;
        }
        
        // Barangay detection
        for (const barangay of barangays) {
            if (lowerPart.includes(barangay)) {
                learner.barangay = part;
                break;
            }
        }
        
        // Date of birth detection
        if (part.match(/\d{1,2}\/\d{1,2}\/\d{2,4}/)) {
            learner.date_of_birth = part;
        }
    }
    
    return learner;
}

function extractFromNameString(nameString) {
    // Parse name string into components
    const result = {
        last_name: '',
        first_name: '',
        middle_name: '',
        confidence: 0.85
    };
    
    // Remove common name extensions first
    let name = nameString.replace(/\b(Jr\.|Sr\.|III|II|IV|V)\b/gi, '').trim();
    
    // Split by comma first (some formats: "Smith, John Michael")
    let parts = [];
    if (name.includes(',')) {
        parts = name.split(',').map(p => p.trim());
        result.last_name = parts[0];
        if (parts[1]) {
            const remainingParts = parts[1].split(/\s+/);
            result.first_name = remainingParts[0];
            result.middle_name = remainingParts.slice(1).join(' ');
        }
    } else {
        // Split by spaces
        parts = name.split(/\s+/).filter(p => p.length > 1);
        
        if (parts.length >= 2) {
            // Assume first capitalized word is likely last name in forms
            // But check context - if format appears to be "FirstName LastName Middle"
            // Look for all-caps (typical of forms)
            const allCaps = parts.filter(p => /^[A-Z][a-z]+$/.test(p) || /^[A-Z]+$/.test(p));
            
            if (allCaps.length >= 2) {
                result.last_name = allCaps[0];
                result.first_name = allCaps[1];
                result.middle_name = allCaps.slice(2).join(' ');
            } else {
                result.last_name = parts[0];
                result.first_name = parts[1];
                result.middle_name = parts.slice(2).join(' ');
            }
        } else if (parts.length === 1) {
            result.last_name = parts[0];
        }
    }
    
    return result;
}

function extractFieldsFromLine(line, barangays) {
    // Extract individual fields from a single line
    const fields = {
        confidence: 0.70
    };
    
    const lowerLine = line.toLowerCase();
    
    // Sex
    if (lowerLine.includes('male')) {
        fields.sex = 'Male';
    } else if (lowerLine.includes('female')) {
        fields.sex = 'Female';
    } else if (line.match(/\b[MF]\b/i)) {
        fields.sex = line.match(/\b[MF]\b/i)[0].toUpperCase() === 'M' ? 'Male' : 'Female';
    }
    
    // Age
    const ageMatch = line.match(/\b([0-9]{1,2})\b/);
    if (ageMatch) {
        const age = parseInt(ageMatch[1]);
        if (age > 5 && age < 120) {
            fields.age = age;
        }
    }
    
    // Phone
    const phoneMatch = line.match(/(\+?63|0)[0-9]{9,10}/);
    if (phoneMatch) {
        fields.contact_number = phoneMatch[0];
    }
    
    // Barangay
    for (const barangay of barangays) {
        if (lowerLine.includes(barangay)) {
            fields.barangay = line.match(new RegExp(barangay, 'i'))[0];
            break;
        }
    }
    
    // Date
    const dateMatch = line.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
    if (dateMatch) {
        fields.date_of_birth = `${dateMatch[2]}/${dateMatch[1]}/${dateMatch[3]}`;
    }
    
    return fields;
}

function displayOCRResults() {
    document.getElementById('imageUploadStep').style.display = 'none';
    document.getElementById('imageProcessingStep').style.display = 'none';
    document.getElementById('imageResultsStep').style.display = 'block';
    
    const tbody = document.getElementById('ocrResultsTable');
    tbody.innerHTML = '';
    
    ocrExtractedData.forEach((learner, idx) => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #ddd';
        
        const confidence = Math.round((learner.confidence || 0.8) * 100);
        const confColor = confidence > 90 ? '#27ae60' : confidence > 70 ? '#f39c12' : '#e74c3c';
        
        tr.innerHTML = `
            <td style="padding: 10px; border-right: 1px solid #ddd;">
                <input type="text" value="${learner.last_name || ''}" onchange="ocrExtractedData[${idx}].last_name = this.value" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
            </td>
            <td style="padding: 10px; border-right: 1px solid #ddd;">
                <input type="text" value="${learner.first_name || ''}" onchange="ocrExtractedData[${idx}].first_name = this.value" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
            </td>
            <td style="padding: 10px; border-right: 1px solid #ddd;">
                <input type="text" value="${learner.middle_name || ''}" onchange="ocrExtractedData[${idx}].middle_name = this.value" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
            </td>
            <td style="padding: 10px; border-right: 1px solid #ddd;">
                <input type="text" value="${learner.sex || ''}" onchange="ocrExtractedData[${idx}].sex = this.value" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
            </td>
            <td style="padding: 10px; border-right: 1px solid #ddd;">
                <input type="number" value="${learner.age || ''}" onchange="ocrExtractedData[${idx}].age = this.value ? parseInt(this.value) : null" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
            </td>
            <td style="padding: 10px; border-right: 1px solid #ddd;">
                <input type="text" value="${learner.barangay || ''}" onchange="ocrExtractedData[${idx}].barangay = this.value" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
            </td>
            <td style="padding: 10px; border-right: 1px solid #ddd;">
                <input type="text" value="${learner.contact_number || ''}" onchange="ocrExtractedData[${idx}].contact_number = this.value" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
            </td>
            <td style="padding: 10px; text-align: center;">
                <span style="background: ${confColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600;">${confidence}%</span>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    document.getElementById('ocrTotalCount').textContent = ocrExtractedData.length;
}

function uploadMoreImages() {
    document.getElementById('imageUploadStep').style.display = 'block';
    document.getElementById('imageResultsStep').style.display = 'none';
    document.getElementById('imageFiles').value = '';
}

async function submitOCRImport() {
    try {
        const learnersToImport = ocrExtractedData.map(learner => {
            const obj = {};
            if (learner.last_name) obj.last_name = learner.last_name;
            if (learner.first_name) obj.first_name = learner.first_name;
            if (learner.middle_name) obj.middle_name = learner.middle_name;
            if (learner.sex) obj.sex = learner.sex;
            if (learner.age) obj.age = parseInt(learner.age);
            if (learner.barangay) obj.barangay = learner.barangay;
            if (learner.contact_number) obj.contact_number = learner.contact_number;
            return obj;
        });
        
        if (learnersToImport.length === 0) {
            alert('No valid learners to import');
            return;
        }
        
        const response = await fetch('/api/af1-learners/batch-import', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(learnersToImport)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            alert(`Successfully imported ${result.imported} learner(s) from images!`);
            closeImageRecognitionModal();
            
            // Reload data
            await loadStats();
            await loadLearners();
        } else {
            alert('Failed to import learners. Please try again.');
        }
    } catch (error) {
        console.error('Error importing OCR data:', error);
        alert('Error importing learners. Please check the console for details.');
    }
}

// Archive Learner
async function archiveLearner(id) {
    if (!confirm('Archive this learner? It will be hidden from the main list but can be recovered later.')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/af1-learners/${id}/archive`, {
            method: 'PATCH'
        });
        
        if (!response.ok) {
            throw new Error('Failed to archive learner');
        }
        
        alert('Learner archived successfully');
        await loadStats();
        await loadLearners();
    } catch (error) {
        console.error('Error archiving learner:', error);
        alert('Error archiving learner: ' + error.message);
    }
}

// Open Archived Learners Modal
async function openArchivedLearnersModal() {
    const modal = document.getElementById('archivedModal');
    modal.classList.add('show');
    await loadArchivedLearners();
}

// Close Archived Learners Modal
function closeArchivedModal() {
    const modal = document.getElementById('archivedModal');
    modal.classList.remove('show');
}

// Load Archived Learners
async function loadArchivedLearners() {
    try {
        const response = await fetch('/api/af1-learners/archived');
        if (!response.ok) throw new Error('Failed to fetch archived learners');
        
        const archivedLearners = await response.json();
        displayArchivedLearners(archivedLearners);
    } catch (error) {
        console.error('Error loading archived learners:', error);
        const tbody = document.getElementById('archivedLearnersTableBody');
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 40px; color: #e74c3c;">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Error loading archived learners. Please try again.</p>
                </td>
            </tr>
        `;
    }
}

// Display Archived Learners
function displayArchivedLearners(learners) {
    const tbody = document.getElementById('archivedLearnersTableBody');
    
    if (!learners || learners.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 40px;">
                    <div class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <p>No archived learners</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    const sortedLearners = [...learners].sort((a, b) => {
        const lastNameA = (a.last_name || '').toLowerCase().trim();
        const lastNameB = (b.last_name || '').toLowerCase().trim();
        
        if (lastNameA !== lastNameB) {
            return lastNameA.localeCompare(lastNameB);
        }
        
        const firstNameA = (a.first_name || '').toLowerCase().trim();
        const firstNameB = (b.first_name || '').toLowerCase().trim();
        return firstNameA.localeCompare(firstNameB);
    });
    
    tbody.innerHTML = sortedLearners.map(learner => {
        const fullName = `${learner.last_name} ${learner.first_name} ${learner.middle_name || ''}`.trim();
        
        return `
            <tr>
                <td>${fullName}</td>
                <td>${learner.sex || 'N/A'}</td>
                <td>${learner.age || 'N/A'}</td>
                <td>${learner.barangay || 'N/A'}</td>
                <td>${learner.contact_number || 'N/A'}</td>
                <td>${learner.learner_type || 'N/A'}</td>
                <td>${learner.last_grade_completed || 'N/A'}</td>
                <td>
                    <button class="btn-icon" onclick="unarchiveLearner('${learner.id}')" style="color: #27ae60;">
                        <i class="fas fa-undo"></i> Restore
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Unarchive Learner
async function unarchiveLearner(id) {
    if (!confirm('Restore this learner to the main list?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/af1-learners/${id}/unarchive`, {
            method: 'PATCH'
        });
        
        if (!response.ok) {
            throw new Error('Failed to unarchive learner');
        }
        
        alert('Learner restored successfully');
        await loadArchivedLearners();
        await loadStats();
        await loadLearners();
    } catch (error) {
        console.error('Error restoring learner:', error);
        alert('Error restoring learner: ' + error.message);
    }
}

// Filter Archived Learners
function filterArchivedLearners() {
    const searchTerm = document.getElementById('archivedSearchInput').value.toLowerCase();
    const tbody = document.getElementById('archivedLearnersTableBody');
    const rows = tbody.getElementsByTagName('tr');
    
    Array.from(rows).forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('viewModal');
    const addModal = document.getElementById('addLearnerModal');
    const imageModal = document.getElementById('imageRecognitionModal');
    const archivedModal = document.getElementById('archivedModal');
    if (event.target === modal) {
        closeModal();
    }
    if (event.target === addModal) {
        closeAddLearnerModal();
    }
    if (event.target === imageModal) {
        closeImageRecognitionModal();
    }
    if (event.target === archivedModal) {
        closeArchivedModal();
    }
}