// Global variables
let currentRegistrations = [];
let currentRegistrationId = null;
let currentApprovalRegistrationId = null;
let currentApprovalRegistration = null;

function confirmLogout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('user');
        window.location.href = '/';
    }
    return false;
}

// Load registration statistics
async function loadStats() {
    try {
        const response = await fetch('/api/registrations/stats');
        const stats = await response.json();
        
        document.getElementById('statPending').textContent = stats.pending || 0;
        document.getElementById('statApproved').textContent = stats.approved || 0;
        document.getElementById('statRejected').textContent = stats.rejected || 0;
        document.getElementById('statToday').textContent = stats.today || 0;
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

// Load registrations based on filter
async function loadRegistrations() {
    const statusFilter = document.getElementById('statusFilter').value;
    const barangayFilter = document.getElementById('barangayFilter').value;
    
    try {
        const response = await fetch(`/api/registrations?status=${statusFilter}`);
        let registrations = await response.json();
        
        // Filter by barangay if selected
        if (barangayFilter !== 'all') {
            registrations = registrations.filter(r => 
                r.barangay && r.barangay.toLowerCase() === barangayFilter.toLowerCase()
            );
        }
        
        currentRegistrations = registrations;
        displayRegistrations(registrations);
    } catch (error) {
        console.error('Error loading registrations:', error);
        alert('Failed to load registrations. Please try again.');
    }
}

// Display registrations in table
function displayRegistrations(registrations) {
    const tbody = document.getElementById('registrationsTableBody');
    
    if (registrations.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 40px;">
                    <div class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <h3>No registrations found</h3>
                        <p>There are no registrations matching your filters.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = registrations.map(reg => {
        const fullName = `${reg.first_name} ${reg.middle_name || ''} ${reg.last_name} ${reg.name_extension || ''}`.trim();
        const enrollmentDate = reg.enrollment_date ? new Date(reg.enrollment_date).toLocaleDateString() : 'N/A';
        const statusClass = reg.status === 'approved' ? 'approved' : 'pending';
        
        return `
            <tr>
                <td>${reg.lrn || 'N/A'}</td>
                <td>${fullName}</td>
                <td>${reg.barangay || 'N/A'}</td>
                <td>${reg.contact_numbers || 'N/A'}</td>
                <td>${enrollmentDate}</td>
                <td><span class="status-badge ${statusClass}">${reg.status || 'pending'}</span></td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-icon btn-view" onclick="viewRegistration('${reg.id}')">
                            <i class="fas fa-eye"></i> View
                        </button>
                        ${reg.status === 'pending' ? `
                            <button class="btn-icon btn-approve" onclick="approveRegistration('${reg.id}')">
                                <i class="fas fa-check"></i> Approve
                            </button>
                            <button class="btn-icon btn-reject" onclick="rejectRegistration('${reg.id}')">
                                <i class="fas fa-times"></i> Reject
                            </button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// View registration details
async function viewRegistration(id) {
    try {
        const response = await fetch(`/api/registrations/${id}`);
        const reg = await response.json();
        
        currentRegistrationId = id;
        
        // Populate modal with registration data
        const fullName = `${reg.first_name} ${reg.middle_name || ''} ${reg.last_name} ${reg.name_extension || ''}`.trim();
        
        document.querySelector('#viewModal .modal-content').innerHTML = `
            <div class="modal-header">
                <h2><i class="fas fa-user-circle"></i> Registration Details</h2>
                <span class="close" onclick="closeModal()">&times;</span>
            </div>

            <div class="detail-grid">
                <!-- Personal Information -->
                <div class="detail-section">
                    <h3><i class="fas fa-id-card"></i> Personal Information</h3>
                    <div class="detail-item">
                        <div class="detail-label">LRN</div>
                        <div class="detail-value">${reg.lrn || 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Full Name</div>
                        <div class="detail-value">${fullName}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Birthdate</div>
                        <div class="detail-value">${reg.birthdate ? new Date(reg.birthdate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Place of Birth</div>
                        <div class="detail-value">${reg.place_of_birth || 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Sex</div>
                        <div class="detail-value">${reg.sex || 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Civil Status</div>
                        <div class="detail-value">${reg.civil_status || 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Religion</div>
                        <div class="detail-value">${reg.religion || 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Mother Tongue</div>
                        <div class="detail-value">${reg.mother_tongue || 'N/A'}</div>
                    </div>
                    ${reg.ip_ethnic_group ? `
                        <div class="detail-item">
                            <div class="detail-label">IP/Ethnic Group</div>
                            <div class="detail-value">${reg.ip_ethnic_group}</div>
                        </div>
                    ` : ''}
                    <div class="detail-item">
                        <div class="detail-label">PWD</div>
                        <div class="detail-value">${reg.is_pwd ? 'Yes' : 'No'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">4Ps Beneficiary</div>
                        <div class="detail-value">${reg.is_4ps ? 'Yes' : 'No'}</div>
                    </div>
                </div>

                <!-- Contact & Address -->
                <div class="detail-section">
                    <h3><i class="fas fa-map-marker-alt"></i> Contact & Address</h3>
                    <div class="detail-item">
                        <div class="detail-label">Contact Number</div>
                        <div class="detail-value">${reg.contact_numbers || 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">House No./Street/Sitio</div>
                        <div class="detail-value">${reg.house_no_street_sitio || 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Barangay</div>
                        <div class="detail-value">${reg.barangay || 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Municipality/City</div>
                        <div class="detail-value">${reg.municipality_city || 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Province</div>
                        <div class="detail-value">${reg.province || 'N/A'}</div>
                    </div>
                </div>

                <!-- Educational Background -->
                <div class="detail-section">
                    <h3><i class="fas fa-graduation-cap"></i> Educational Background</h3>
                    <div class="detail-item">
                        <div class="detail-label">Last Grade Completed</div>
                        <div class="detail-value">${reg.last_grade_level_completed || 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Elementary School</div>
                        <div class="detail-value">${reg.elementary_school || 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Junior High School</div>
                        <div class="detail-value">${reg.junior_high_school || 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Dropout Reason</div>
                        <div class="detail-value">${reg.dropout_reason || 'N/A'}</div>
                    </div>
                    ${reg.dropout_reason === 'Others' && reg.dropout_reason_others ? `
                        <div class="detail-item">
                            <div class="detail-label">Other Reason</div>
                            <div class="detail-value">${reg.dropout_reason_others}</div>
                        </div>
                    ` : ''}
                    <div class="detail-item">
                        <div class="detail-label">Attended ALS Before</div>
                        <div class="detail-value">${reg.attended_als_before ? 'Yes' : 'No'}</div>
                    </div>
                    ${reg.attended_als_before ? `
                        <div class="detail-item">
                            <div class="detail-label">Previous Program</div>
                            <div class="detail-value">${reg.previous_program_name || 'N/A'}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Previous Literacy Level</div>
                            <div class="detail-value">${reg.previous_literacy_level || 'N/A'}</div>
                        </div>
                    ` : ''}
                </div>

                <!-- Family Information -->
                <div class="detail-section">
                    <h3><i class="fas fa-users"></i> Family Information</h3>
                    <div class="detail-item">
                        <div class="detail-label">Father/Guardian</div>
                        <div class="detail-value">${reg.father_guardian_first_name || ''} ${reg.father_guardian_middle_name || ''} ${reg.father_guardian_last_name || ''}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Father's Occupation</div>
                        <div class="detail-value">${reg.father_guardian_occupation || 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Mother</div>
                        <div class="detail-value">${reg.mother_maiden_first_name || ''} ${reg.mother_maiden_middle_name || ''} ${reg.mother_maiden_last_name || ''}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Mother's Occupation</div>
                        <div class="detail-value">${reg.mother_maiden_occupation || 'N/A'}</div>
                    </div>
                </div>
            </div>

            <!-- Schedule Availability -->
            <div class="detail-section" style="width: 100%; margin-top: 20px;">
                <h3><i class="fas fa-calendar-alt"></i> Schedule Availability</h3>
                <div class="schedule-grid">
                    ${['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map(day => `
                        <div class="schedule-day ${reg[`${day}_available`] ? 'available' : ''}">
                            <div class="schedule-day-name">${day.charAt(0).toUpperCase() + day.slice(1)}</div>
                            <div class="schedule-time">${reg[`${day}_available`] ? (reg[`${day}_time`] || 'Available') : 'Not Available'}</div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="modal-actions">
                <button class="btn-secondary" onclick="closeModal()">Close</button>
                ${reg.status === 'pending' ? `
                    <button class="btn-icon btn-approve" onclick="approveFromModal()">
                        <i class="fas fa-check"></i> Approve Registration
                    </button>
                    <button class="btn-icon btn-reject" onclick="rejectFromModal()">
                        <i class="fas fa-times"></i> Reject Registration
                    </button>
                ` : ''}
            </div>
        `;
        
        document.getElementById('viewModal').classList.add('show');
    } catch (error) {
        console.error('Error viewing registration:', error);
        alert('Failed to load registration details. Please try again.');
    }
}

function closeModal() {
    document.getElementById('viewModal').classList.remove('show');
    currentRegistrationId = null;
}

async function approveRegistration(id) {
    // Find the registration
    const registration = currentRegistrations.find(r => r.id === id);
    if (!registration) {
        alert('Registration not found');
        return;
    }
    
    // Store registration ID for later use
    currentApprovalRegistrationId = id;
    currentApprovalRegistration = registration;
    
    // Populate the approval modal
    document.getElementById('approvalStudentName').textContent = 
        `${registration.first_name} ${registration.last_name}`;
    
    const suggestedUsername = registration.lrn || `${registration.first_name.toLowerCase()}.${registration.last_name.toLowerCase()}`;
    document.getElementById('approvalUsername').value = suggestedUsername;
    document.getElementById('approvalEmail').value = registration.email_address || '';
    document.getElementById('approvalPassword').value = 'ALS2025!';
    
    // Reset password visibility
    document.getElementById('approvalPassword').type = 'password';
    document.querySelector('.toggle-password i').className = 'fas fa-eye';
    
    // Reset password strength
    updatePasswordStrength();
    
    // Show the approval modal
    document.getElementById('approvalModal').classList.add('show');
}

function closeApprovalModal() {
    document.getElementById('approvalModal').classList.remove('show');
    document.getElementById('approvalForm').reset();
}

function openRejectionModal(registrationId, registration) {
    currentRegistrationId = registrationId;
    currentApprovalRegistration = registration;
    
    const studentName = `${registration.first_name} ${registration.last_name}`;
    document.getElementById('rejectionStudentName').textContent = studentName;
    document.getElementById('rejectionReason').value = '';
    document.getElementById('notifyApplicant').checked = true;
    
    document.getElementById('rejectionModal').classList.add('show');
}

function closeRejectionModal() {
    document.getElementById('rejectionModal').classList.remove('show');
    document.getElementById('rejectionForm').reset();
}

function toggleApprovalPassword() {
    const passwordInput = document.getElementById('approvalPassword');
    const toggleBtn = document.querySelector('.toggle-password i');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleBtn.className = 'fas fa-eye-slash';
    } else {
        passwordInput.type = 'password';
        toggleBtn.className = 'fas fa-eye';
    }
}

function updatePasswordStrength() {
    const password = document.getElementById('approvalPassword').value;
    const strengthBar = document.querySelector('.strength-fill');
    const strengthText = document.querySelector('.strength-text');
    
    let strength = 0;
    let strengthLabel = 'Weak';
    
    // Check password length
    if (password.length >= 8) strength += 25;
    if (password.length >= 12) strength += 25;
    
    // Check for lowercase
    if (/[a-z]/.test(password)) strength += 12;
    
    // Check for uppercase
    if (/[A-Z]/.test(password)) strength += 12;
    
    // Check for numbers
    if (/\d/.test(password)) strength += 12;
    
    // Check for special characters
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) strength += 14;
    
    // Determine label
    if (strength < 30) {
        strengthLabel = 'Weak';
    } else if (strength < 60) {
        strengthLabel = 'Fair';
    } else if (strength < 80) {
        strengthLabel = 'Good';
    } else {
        strengthLabel = 'Strong';
    }
    
    // Update UI
    strengthBar.style.width = strength + '%';
    strengthText.innerHTML = `Password strength: <strong>${strengthLabel}</strong>`;
}

// Add event listener for password strength
document.addEventListener('DOMContentLoaded', function() {
    const approvalPasswordInput = document.getElementById('approvalPassword');
    if (approvalPasswordInput) {
        approvalPasswordInput.addEventListener('input', updatePasswordStrength);
    }
    
    const approvalForm = document.getElementById('approvalForm');
    if (approvalForm) {
        approvalForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            await submitApprovalForm();
        });
    }
    
    const rejectionForm = document.getElementById('rejectionForm');
    if (rejectionForm) {
        rejectionForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            await submitRejectionForm();
        });
    }
});

async function submitApprovalForm() {
    const username = document.getElementById('approvalUsername').value.trim();
    const password = document.getElementById('approvalPassword').value;
    const email = document.getElementById('approvalEmail').value;
    
    // Validation
    if (!username || username.length < 3) {
        alert('Username must be at least 3 characters');
        return;
    }
    
    if (password.length < 8) {
        alert('Password must be at least 8 characters');
        return;
    }
    
    if (!email) {
        alert('Email is required');
        return;
    }
    
    if (!confirm(`Approve registration for ${currentApprovalRegistration.first_name} ${currentApprovalRegistration.last_name}?\n\nUsername: ${username}\nEmail: ${email}\n\nThis will create a student account.`)) {
        return;
    }
    
    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        const response = await fetch(`/api/registrations/${currentApprovalRegistrationId}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                registration_id: currentApprovalRegistrationId,
                username: username,
                password: password,
                email: email,
                admin_id: user.id
            })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            alert(`✅ Registration approved!\n\nUsername: ${username}\nPassword: ${password}\n\nPlease provide these credentials to the student.`);
            closeApprovalModal();
            await loadRegistrations();
            await loadStats();
        } else {
            const errorMsg = result.detail || result.message || JSON.stringify(result);
            throw new Error(errorMsg);
        }
    } catch (error) {
        console.error('Error approving registration:', error);
        alert(`❌ Failed to approve registration:\n\n${error.message || error}`);
    }
}

async function submitRejectionForm() {
    const reason = document.getElementById('rejectionReason').value.trim();
    const notifyApplicant = document.getElementById('notifyApplicant').checked;
    
    if (!reason) {
        alert('Please provide a rejection reason');
        return;
    }
    
    await rejectRegistration(currentRegistrationId, reason);
}

async function rejectRegistration(id, reason) {
    if (!reason || reason.trim() === '') {
        alert('Please provide a rejection reason');
        return;
    }
    
    if (!confirm(`Are you sure you want to reject this registration?\n\nThis action cannot be undone.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/registrations/${id}/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: reason })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            alert('Registration rejected successfully. Notification email has been sent.');
            closeRejectionModal();
            await loadRegistrations();
            await loadStats();
        } else {
            throw new Error(result.detail || 'Failed to reject registration');
        }
    } catch (error) {
        console.error('Error rejecting registration:', error);
        alert(`Failed to reject registration: ${error.message}`);
    }
}

function approveFromModal() {
    if (currentRegistrationId) {
        closeModal();
        approveRegistration(currentRegistrationId);
    }
}

function rejectFromModal() {
    if (currentRegistrationId) {
        closeModal();
        openRejectionModal(currentRegistrationId, currentApprovalRegistration);
    }
}

function exportRegistrations() {
    const statusFilter = document.getElementById('statusFilter').value;
    
    // Create CSV content
    const headers = ['LRN', 'Full Name', 'Barangay', 'Contact', 'Enrollment Date', 'Status'];
    const rows = currentRegistrations.map(reg => {
        const fullName = `${reg.first_name} ${reg.middle_name || ''} ${reg.last_name} ${reg.name_extension || ''}`.trim();
        return [
            reg.lrn || 'N/A',
            fullName,
            reg.barangay || 'N/A',
            reg.contact_numbers || 'N/A',
            reg.enrollment_date ? new Date(reg.enrollment_date).toLocaleDateString() : 'N/A',
            reg.status || 'pending'
        ];
    });
    
    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `als_registrations_${statusFilter}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

// Search functionality
document.getElementById('searchInput').addEventListener('input', function(e) {
    const searchTerm = e.target.value.toLowerCase();
    const filtered = currentRegistrations.filter(reg => {
        const fullName = `${reg.first_name} ${reg.middle_name || ''} ${reg.last_name}`.toLowerCase();
        const lrn = (reg.lrn || '').toLowerCase();
        const barangay = (reg.barangay || '').toLowerCase();
        
        return fullName.includes(searchTerm) || 
               lrn.includes(searchTerm) || 
               barangay.includes(searchTerm);
    });
    
    displayRegistrations(filtered);
});

// Filter functionality
document.getElementById('statusFilter').addEventListener('change', loadRegistrations);
document.getElementById('barangayFilter').addEventListener('change', function() {
    const barangayFilter = this.value;
    if (barangayFilter === 'all') {
        displayRegistrations(currentRegistrations);
    } else {
        const filtered = currentRegistrations.filter(r => 
            r.barangay && r.barangay.toLowerCase() === barangayFilter.toLowerCase()
        );
        displayRegistrations(filtered);
    }
});

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
    await loadRegistrations();
});

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('viewModal');
    if (event.target === modal) {
        closeModal();
    }
}