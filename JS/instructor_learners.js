
    // Modal functionality
    document.addEventListener('DOMContentLoaded', () => {
        // User authentication and sidebar
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user) {
            window.location.href = '/';
            return;
        }
        document.getElementById('instructorName').textContent = `Welcome, ${user.username}`;

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

        // Modal elements
        const modal = document.getElementById('addLearnerModal');
        const addLearnerBtn = document.getElementById('addLearnerBtn');
        const closeBtn = document.querySelector('.close');
        const cancelBtn = document.getElementById('cancel-add');
        const addLearnerForm = document.getElementById('addLearnerForm');

        addLearnerBtn.onclick = function() {
            modal.style.display = "block";
        };
        closeBtn.onclick = function() {
            modal.style.display = "none";
        };
        cancelBtn.onclick = function() {
            modal.style.display = "none";
        };
        window.onclick = function(event) {
            if (event.target == modal) {
                modal.style.display = "none";
            }
        };

        // Load barangays for dropdowns
        async function loadBarangays() {
            try {
                const response = await fetch('/api/barangays');
                if (!response.ok) throw new Error('Failed to fetch barangays');
                const barangays = await response.json();

                const barangayFilter = document.getElementById('barangayFilter');
                const learnerBarangay = document.getElementById('learner-barangay');

                barangayFilter.innerHTML = '<option value="all">All Barangays</option>';
                learnerBarangay.innerHTML = '<option value="">Select Barangay</option>';

                barangays.forEach(barangay => {
                    const filterOption = new Option(barangay.name, barangay.name);
                    const modalOption = new Option(barangay.name, barangay.name);
                    barangayFilter.appendChild(filterOption);
                    learnerBarangay.appendChild(modalOption);
                });
            } catch (error) {
                console.error('Error loading barangays:', error);
            }
        }

        // Load learners for table
        async function loadLearners() {
            try {
                const response = await fetch('/api/learners');
                const learners = await response.json();
                displayLearners(learners);
            } catch (error) {
                console.error('Error loading learners:', error);
            }
        }

        // Display learners in table
        function displayLearners(learners) {
            const tbody = document.getElementById('learnersTableBody');
            tbody.innerHTML = '';
            learners.forEach(learner => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${learner.name}</td>
                    <td>${learner.barangay}</td>
                    <td>
                        <div class="progress-bar">
                            <div class="progress" style="width: ${learner.progress || 0}%"></div>
                        </div>
                        ${learner.progress || 0}%
                    </td>
                    <td><span class="status-badge ${learner.status}">${learner.status}</span></td>
                    <td>${learner.last_active || 'N/A'}</td>
                    <td>
                        <button class="btn-icon" onclick="editLearner('${learner.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-icon" onclick="deleteLearner('${learner.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }

        // Add learner to database
        addLearnerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const learnerData = {
                name: document.getElementById('learner-name').value,
                status: document.getElementById('learner-status').value,
                barangay: document.getElementById('learner-barangay').value,
                address: document.getElementById('learner-address').value
            };

            try {
                const response = await fetch('/api/learners', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(learnerData)
                });

                if (response.ok) {
                    modal.style.display = "none";
                    addLearnerForm.reset();
                    await loadLearners(); // Refresh the table
                    alert('Learner added successfully!');
                } else {
                    const error = await response.json();
                    throw new Error(error.detail || 'Failed to add learner');
                }
            } catch (error) {
                console.error('Error adding learner:', error);
                alert('Error adding learner: ' + error.message);
            }
        });

        // Filter handlers
        document.getElementById('searchInput').addEventListener('input', filterLearners);
        document.getElementById('barangayFilter').addEventListener('change', filterLearners);
        document.getElementById('statusFilter').addEventListener('change', filterLearners);

        async function filterLearners() {
            const search = document.getElementById('searchInput').value.toLowerCase();
            const barangay = document.getElementById('barangayFilter').value;
            const status = document.getElementById('statusFilter').value;

            try {
                const response = await fetch(`/api/learners?search=${search}&barangay=${barangay}&status=${status}`);
                const learners = await response.json();
                displayLearners(learners);
            } catch (error) {
                console.error('Error filtering learners:', error);
            }
        }

        // Initial load
        loadBarangays();
        loadLearners();

        // Mapped Learner Form Submission
        const addMappedLearnerForm = document.getElementById('addMappedLearnerForm');
        if (addMappedLearnerForm) {
            addMappedLearnerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                // Collect all form data
                const learnerData = {
                    last_name: document.getElementById('addLastName').value,
                    first_name: document.getElementById('addFirstName').value,
                    middle_name: document.getElementById('addMiddleName').value,
                    name_extension: document.getElementById('addNameExtension').value,
                    sex: document.getElementById('addSex').value,
                    date_of_birth: document.getElementById('addDOB').value,
                    age: document.getElementById('addAge').value,
                    ip: document.getElementById('addIP').value,
                    religion: document.getElementById('addReligion').value,
                    mother_tongue: document.getElementById('addMotherTongue').value,
                    house_number: document.getElementById('addHouseNumber').value,
                    street: document.getElementById('addStreet').value,
                    sitio_purok: document.getElementById('addSitioPurok').value,
                    barangay: document.getElementById('addBarangay').value,
                    municipality_city: document.getElementById('addMunicipalityCity').value,
                    province: document.getElementById('addProvince').value,
                    contact_number: document.getElementById('addContactNumber').value,
                    father_name: document.getElementById('addFatherName').value,
                    mother_name: document.getElementById('addMotherName').value,
                    last_grade_completed: document.getElementById('addLastGrade').value,
                    interested_in_als: document.getElementById('addInterestedInALS').value,
                    als_status: document.getElementById('addALSStatus')?.value,
                    preferred_program: document.getElementById('addPreferredProgram')?.value,
                    learner_type_class: document.getElementById('addLearnerTypeClass')?.value,
                    region: document.getElementById('addRegion').value,
                    division: document.getElementById('addDivision').value,
                    district: document.getElementById('addDistrict').value,
                    calendar_year_start: document.getElementById('addCalendarYearStart').value,
                    calendar_year_end: document.getElementById('addCalendarYearEnd').value
                };

                try {
                    const response = await fetch('/api/mapped-learners', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(learnerData)
                    });

                    if (response.ok) {
                        closeAddMappedLearnerModal();
                        addMappedLearnerForm.reset();
                        alert('Learner added successfully!');
                        // Refresh the mapped learners table if available
                        if (typeof loadMappedLearners === 'function') {
                            loadMappedLearners();
                        }
                    } else {
                        const error = await response.json();
                        throw new Error(error.detail || 'Failed to add learner');
                    }
                } catch (error) {
                    console.error('Error adding mapped learner:', error);
                    alert('Error adding learner: ' + error.message);
                }
            });
        }
    });

    // Mapped Learner Modal Functions
    function openAddMappedLearnerModal() {
        const modal = document.getElementById('addMappedLearnerModal');
        if (modal) {
            modal.style.display = 'block';
        }
    }

    function closeAddMappedLearnerModal() {
        const modal = document.getElementById('addMappedLearnerModal');
        if (modal) {
            modal.style.display = 'none';
        }
        // Reset form when closing
        const form = document.getElementById('addMappedLearnerForm');
        if (form) {
            form.reset();
        }
    }

    // Open learners modal
    function openLearnersModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'block';
        }
    }

    // Close learners modal
    function closeLearnersModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // Close modals when clicking outside
    window.addEventListener('click', function(event) {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    });

    // Toggle ALS conditional fields
    document.addEventListener('change', function(e) {
        if (e.target.id === 'addInterestedInALS') {
            const alsConditionalFields = document.getElementById('alsConditionalFields');
            if (alsConditionalFields) {
                alsConditionalFields.style.display = e.target.value === 'true' ? 'block' : 'none';
            }
        }
    });
