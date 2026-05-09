// Shared sidebar utilities for all student pages

async function loadSidebarProfile() {
    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        if (!user.id) {
            return;
        }

        // Fetch profile data from backend
        const response = await fetch(`/api/student-profile/${user.id}`);
        
        if (!response.ok) {
            console.warn('Could not load profile data for sidebar');
            return;
        }

        const profileData = await response.json();
        
        // Update sidebar student name
        const studentNameEl = document.getElementById('studentName');
        if (studentNameEl && profileData) {
            const fullName = `${profileData.first_name || ''} ${profileData.middle_name || ''} ${profileData.last_name || ''}`.trim();
            studentNameEl.textContent = fullName || 'Student';
        }
        
        // Display profile photo in sidebar
        if (profileData && profileData.profile_photo) {
            displaySidebarPhoto(profileData.profile_photo);
        }
        
        // Setup photo upload functionality
        setupSidebarPhotoUpload();
        
    } catch (error) {
        console.error('Error loading sidebar profile:', error);
    }
}

function displaySidebarPhoto(filename) {
    if (!filename) return;
    
    const sidebarPhotoImg = document.getElementById('sidebarProfilePhoto');
    const sidebarPhotoPlaceholder = document.getElementById('profilePhotoHeaderPlaceholder');
    
    if (sidebarPhotoImg && sidebarPhotoPlaceholder) {
        sidebarPhotoImg.src = `/PFP/${filename}`;
        sidebarPhotoImg.style.display = 'block';
        sidebarPhotoPlaceholder.style.display = 'none';
    }
}

function setupSidebarPhotoUpload() {
    const sidebarPhotoInput = document.getElementById('sidebarPhotoInput');
    if (sidebarPhotoInput) {
        sidebarPhotoInput.addEventListener('change', handleSidebarPhotoUpload);
        
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
}

async function handleSidebarPhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        if (!user.id) {
            console.error('User not found');
            return;
        }

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            alert('Invalid file type. Please upload a JPG, PNG, or GIF image.');
            return;
        }
        
        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            alert('File size must be less than 5MB');
            return;
        }

        // Create FormData
        const formData = new FormData();
        formData.append('file', file);

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
        
        // Display the photo
        displaySidebarPhoto(result.filename);
        
        // Reset file input
        event.target.value = '';
        
        alert('Photo uploaded successfully!');
        
    } catch (error) {
        console.error('Error uploading photo:', error);
        alert(`Failed to upload photo: ${error.message}`);
    }
}
