async function loadProfileData() {
    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        if (!user.id) {
            showError('User not found. Please login again.');
            return;
        }

        // Fetch profile data from backend
        const response = await fetch(`/api/student-profile/${user.id}`);
        
        if (!response.ok) {
            throw new Error('Failed to load profile data');
        }

        const profileData = await response.json();
        
        // Store profile data for later use
        window.currentProfileData = profileData;
        
        // Populate the profile
        populateProfile(profileData);
        
        // Load photo if exists
        if (profileData.profile_photo) {
            displayPhoto(profileData.profile_photo);
        }
        
        // Setup sidebar photo input listener
        const sidebarPhotoInput = document.getElementById('sidebarPhotoInput');
        if (sidebarPhotoInput) {
            sidebarPhotoInput.addEventListener('change', handlePhotoUpload);
            
            // Make profile photo clickable in sidebar
            const profilePhotoHeader = document.querySelector('.profile-photo-header');
            if (profilePhotoHeader) {
                profilePhotoHeader.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    sidebarPhotoInput.click();
                });
                profilePhotoHeader.style.cursor = 'pointer';
                profilePhotoHeader.style.zIndex = '1';
            }
        }
        
        // Hide loading message
        document.getElementById('loadingMessage').classList.add('hidden');
        
    } catch (error) {
        console.error('Error loading profile:', error);
        showError('Failed to load your profile. Please refresh the page.');
        document.getElementById('loadingMessage').classList.add('hidden');
    }
}

function populateProfile(data) {
    // Profile header info
    const fullName = `${data.first_name || ''} ${data.middle_name || ''} ${data.last_name || ''}`.trim();
    document.getElementById('studentFullName').textContent = fullName || 'Student';
    document.getElementById('studentRoleInfo').textContent = 'ALS Learner';
    
    // Profile details
    document.getElementById('lrnValue').textContent = data.lrn || '-';
    document.getElementById('birthdateValue').textContent = formatDate(data.birthdate) || '-';
    document.getElementById('sexValue').textContent = data.sex || '-';
    document.getElementById('contactValue').textContent = data.contact_numbers || '-';
    
    // Academic Details
    document.getElementById('enrollmentDate').value = formatDate(data.enrollment_date) || '';
    document.getElementById('lastGradeLevel').value = data.last_grade_level_completed || '';
    document.getElementById('elementarySchool').value = data.elementary_school || '';
    document.getElementById('juniorHighSchool').value = data.junior_high_school || '';
    document.getElementById('previousLiteracyLevel').value = data.previous_literacy_level || '';
    document.getElementById('attendedAlsBefore').value = data.attended_als_before ? 'Yes' : 'No';
    
    // Personal Information
    document.getElementById('firstName').value = data.first_name || '';
    document.getElementById('middleName').value = data.middle_name || '';
    document.getElementById('lastName').value = data.last_name || '';
    document.getElementById('emailAddress').value = data.email_address || '';
    document.getElementById('civilStatus').value = data.civil_status || '';
    document.getElementById('religion').value = data.religion || '';
    document.getElementById('ipEthnicGroup').value = data.ip_ethnic_group || '';
    document.getElementById('motherTongue').value = data.mother_tongue || '';
    document.getElementById('isPwd').value = data.is_pwd ? 'Yes' : 'No';
    document.getElementById('is4ps').value = data.is_4ps ? 'Yes' : 'No';
    
    // Complete Address
    document.getElementById('houseNoStreet').value = data.house_no_street_sitio || '';
    document.getElementById('barangay').value = data.barangay || '';
    document.getElementById('municipalityCity').value = data.municipality_city || '';
    document.getElementById('province').value = data.province || '';
    
    // Other Information
    let distanceText = '-';
    if (data.distance_to_learning_center_km) {
        distanceText = `${data.distance_to_learning_center_km} km`;
        if (data.distance_to_learning_center_hours || data.distance_to_learning_center_mins) {
            distanceText += ` (${data.distance_to_learning_center_hours || 0}h ${data.distance_to_learning_center_mins || 0}m)`;
        }
    }
    document.getElementById('distanceLearningCenter').value = distanceText;
    document.getElementById('transportationMode').value = data.transportation_mode || '';
    
    // Parent/Guardian Information
    const fatherName = `${data.father_guardian_first_name || ''} ${data.father_guardian_middle_name || ''} ${data.father_guardian_last_name || ''}`.trim();
    document.getElementById('fatherName').value = fatherName || '';
    document.getElementById('fatherOccupation').value = data.father_guardian_occupation || '';
    
    const motherName = `${data.mother_maiden_first_name || ''} ${data.mother_maiden_middle_name || ''} ${data.mother_maiden_last_name || ''}`.trim();
    document.getElementById('motherName').value = motherName || '';
    document.getElementById('motherOccupation').value = data.mother_maiden_occupation || '';
    
    // Update sidebar student name
    document.getElementById('studentName').textContent = fullName || 'Student';
}

function formatDate(dateString) {
    if (!dateString) return null;
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return null;
    
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

function showError(message) {
    const errorEl = document.getElementById('errorMessage');
    errorEl.textContent = message;
    errorEl.classList.add('show');
    setTimeout(() => {
        errorEl.classList.remove('show');
    }, 5000);
}

function showSuccess(message) {
    const successEl = document.getElementById('successMessage');
    successEl.textContent = message;
    successEl.classList.add('show');
    setTimeout(() => {
        successEl.classList.remove('show');
    }, 5000);
}

function enableEditMode() {
    const editableFields = document.querySelectorAll('.form-group.editable input');
    editableFields.forEach(field => {
        field.removeAttribute('readonly');
    });
    
    document.querySelector('.edit-btn').style.display = 'none';
    document.querySelector('.save-btn').classList.add('show');
    document.querySelector('.cancel-btn').classList.add('show');
}

function cancelEditMode() {
    const editableFields = document.querySelectorAll('.form-group.editable input');
    editableFields.forEach(field => {
        field.setAttribute('readonly', '');
    });
    
    // Restore original values
    if (window.currentProfileData) {
        document.getElementById('houseNoStreet').value = window.currentProfileData.house_no_street_sitio || '';
        document.getElementById('barangay').value = window.currentProfileData.barangay || '';
        document.getElementById('municipalityCity').value = window.currentProfileData.municipality_city || '';
        document.getElementById('province').value = window.currentProfileData.province || '';
    }
    
    document.querySelector('.edit-btn').style.display = 'inline-block';
    document.querySelector('.save-btn').classList.remove('show');
    document.querySelector('.cancel-btn').classList.remove('show');
}

async function saveAddressChanges() {
    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        const addressData = {
            house_no_street_sitio: document.getElementById('houseNoStreet').value,
            barangay: document.getElementById('barangay').value,
            municipality_city: document.getElementById('municipalityCity').value,
            province: document.getElementById('province').value
        };
        
        const response = await fetch(`/api/student-profile/${user.id}/address`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(addressData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to save address');
        }
        
        // Update stored data
        window.currentProfileData.house_no_street_sitio = addressData.house_no_street_sitio;
        window.currentProfileData.barangay = addressData.barangay;
        window.currentProfileData.municipality_city = addressData.municipality_city;
        window.currentProfileData.province = addressData.province;
        
        // Disable edit mode
        const editableFields = document.querySelectorAll('.form-group.editable input');
        editableFields.forEach(field => {
            field.setAttribute('readonly', '');
        });
        
        document.querySelector('.edit-btn').style.display = 'inline-block';
        document.querySelector('.save-btn').classList.remove('show');
        document.querySelector('.cancel-btn').classList.remove('show');
        
        showSuccess('Address updated successfully!');
        
    } catch (error) {
        console.error('Error saving address:', error);
        showError(`Failed to save address: ${error.message}`);
    }
}
// Photo upload handlers
function displayPhoto(filename) {
    if (!filename) return;
    
    const photoImg = document.getElementById('profilePhotoImg');
    const photoPlaceholder = document.getElementById('profilePhotoPlaceholder');
    
    if (photoImg && photoPlaceholder) {
        photoImg.src = `/PFP/${filename}`;
        photoImg.style.display = 'block';
        photoPlaceholder.style.display = 'none';
    }
    
    // Also display in sidebar if available
    const sidebarPhotoImg = document.getElementById('sidebarProfilePhoto');
    const sidebarPhotoPlaceholder = document.getElementById('profilePhotoHeaderPlaceholder');
    
    if (sidebarPhotoImg && sidebarPhotoPlaceholder) {
        sidebarPhotoImg.src = `/PFP/${filename}`;
        sidebarPhotoImg.style.display = 'block';
        sidebarPhotoPlaceholder.style.display = 'none';
    }
}

async function handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            showError('Invalid file type. Please upload a JPG, PNG, or GIF image.');
            return;
        }
        
        // Validate file size (5MB)
        if (file.size > 5 * 1024 * 1024) {
            showError('File size must be less than 5MB.');
            return;
        }
        
        // Show uploading message
        const statusEl = document.getElementById('photoUploadStatus');
        if (statusEl) {
            statusEl.textContent = 'Uploading...';
            statusEl.className = 'photo-upload-status uploading';
        }
        
        // Prepare form data
        const formData = new FormData();
        formData.append('file', file);
        
        // Get user ID
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        // Upload to backend
        const response = await fetch(`/api/student-profile/${user.id}/photo`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to upload photo');
        }
        
        const result = await response.json();
        
        // Update the profile data
        if (window.currentProfileData) {
            window.currentProfileData.profile_photo = result.filename;
        }
        
        // Display the uploaded photo
        displayPhoto(result.filename);
        
        // Show success message
        if (statusEl) {
            statusEl.textContent = 'Photo uploaded successfully!';
            statusEl.className = 'photo-upload-status success';
            setTimeout(() => {
                statusEl.textContent = '';
                statusEl.className = 'photo-upload-status';
            }, 3000);
        }
        
        showSuccess('Photo uploaded successfully!');
        
        // Reset file input
        event.target.value = '';
        
    } catch (error) {
        console.error('Error uploading photo:', error);
        showError(`Failed to upload photo: ${error.message}`);
        
        const statusEl = document.getElementById('photoUploadStatus');
        if (statusEl) {
            statusEl.textContent = 'Upload failed';
            statusEl.className = 'photo-upload-status error';
            setTimeout(() => {
                statusEl.textContent = '';
                statusEl.className = 'photo-upload-status';
            }, 3000);
        }
    }
}

async function removePhoto() {
    if (!confirm('Are you sure you want to remove your profile photo?')) {
        return;
    }
    
    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        const response = await fetch(`/api/student-profile/${user.id}/photo`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to remove photo');
        }
        
        // Update the profile data
        if (window.currentProfileData) {
            window.currentProfileData.profile_photo = null;
        }
        
        // Hide the photo
        const photoImg = document.getElementById('profilePhotoImg');
        const photoPlaceholder = document.getElementById('profilePhotoPlaceholder');
        
        if (photoImg) photoImg.style.display = 'none';
        if (photoPlaceholder) photoPlaceholder.style.display = 'block';
        
        // Hide the photo in sidebar
        const sidebarPhotoImg = document.getElementById('sidebarProfilePhoto');
        const sidebarPhotoPlaceholder = document.getElementById('profilePhotoHeaderPlaceholder');
        
        if (sidebarPhotoImg) sidebarPhotoImg.style.display = 'none';
        if (sidebarPhotoPlaceholder) sidebarPhotoPlaceholder.style.display = 'block';
        
        // Hide remove button
        const removeBtn = document.getElementById('photoRemoveBtn');
        if (removeBtn) removeBtn.style.display = 'none';
        
        showSuccess('Photo removed successfully!');
        
    } catch (error) {
        console.error('Error removing photo:', error);
        showError(`Failed to remove photo: ${error.message}`);
    }
}