// registration.js - Updated with Backend Integration

/**
 * Generate a random LRN with format 108440xxxxxx
 */
function generateLRN() {
    const prefix = '108440';
    const randomSuffix = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    return prefix + randomSuffix;
}

/**
 * Toggle name extension input visibility (global function for onchange)
 */
function toggleNameExtensionInput() {
    const extensionSelect = document.getElementById('name_extension');
    const extensionCustom = document.getElementById('name_extension_custom');
    const helpText = document.getElementById('extension_help');

    if (extensionSelect && extensionSelect.value === 'others') {
        extensionCustom.style.display = 'block';
        helpText.style.display = 'block';
        extensionCustom.focus();
    } else if (extensionCustom) {
        extensionCustom.style.display = 'none';
        helpText.style.display = 'none';
        extensionCustom.value = '';
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Initialize
    let currentStep = 1;
    const totalSteps = 4;
    
    // Get elements
    const form = document.getElementById('registrationForm');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const submitBtn = document.getElementById('submitBtn');
    const successModal = document.getElementById('successModal');

    // Duplicate check variables
    let lrnCheckTimeout;
    let emailCheckTimeout;


    // Initialize form
    initializeForm();
    updateFormNavigation();

    // Event Listeners
    nextBtn.addEventListener('click', handleNext);
    prevBtn.addEventListener('click', handlePrevious);
    form.addEventListener('submit', handleSubmit);

    // Setup LRN generator button
    const generateLrnBtn = document.getElementById('generateLrnBtn');
    if (generateLrnBtn) {
        generateLrnBtn.addEventListener('click', function(e) {
            e.preventDefault();
            const lrnInput = document.getElementById('lrn');
            lrnInput.value = generateLRN();
            lrnInput.style.borderColor = '';
            // Remove error message if exists
            const errorMsg = lrnInput.parentNode.querySelector('.error-message');
            if (errorMsg) {
                errorMsg.remove();
            }
        });
    }

    // Conditional field displays
    setupConditionalFields();

    // Schedule availability toggles with dropdown
    setupScheduleToggles();

    // Auto-set enrollment date to today
    document.getElementById('enrollment_date').valueAsDate = new Date();

    // Setup name extension toggle
    setupNameExtensionToggle();

    /**
     * Initialize form
     */
    function initializeForm() {
        showStep(currentStep);
    }

    /**
     * Setup name extension dropdown toggle
     */
    function setupNameExtensionToggle() {
        const extensionSelect = document.getElementById('name_extension');
        const extensionCustom = document.getElementById('name_extension_custom');
        const helpText = document.getElementById('extension_help');

        if (extensionSelect) {
            extensionSelect.addEventListener('change', function() {
                if (this.value === 'others') {
                    extensionCustom.style.display = 'block';
                    helpText.style.display = 'block';
                    extensionCustom.focus();
                } else {
                    extensionCustom.style.display = 'none';
                    helpText.style.display = 'none';
                    extensionCustom.value = '';
                }
            });
        }
    }

    /**
     * Show specific step
     */
    function showStep(step) {
        // Hide all steps
        const steps = document.querySelectorAll('.form-step');
        steps.forEach(s => s.classList.remove('active'));

        // Show current step
        const currentStepElement = document.querySelector(`.form-step[data-step="${step}"]`);
        if (currentStepElement) {
            currentStepElement.classList.add('active');
        }

        // Update progress indicators
        updateProgressIndicators(step);
    }

    /**
     * Update progress indicators
     */
    function updateProgressIndicators(step) {
        const progressSteps = document.querySelectorAll('.progress-step');
        
        progressSteps.forEach((progressStep, index) => {
            const stepNumber = index + 1;
            
            // Remove all classes
            progressStep.classList.remove('active', 'completed');
            
            if (stepNumber < step) {
                progressStep.classList.add('completed');
            } else if (stepNumber === step) {
                progressStep.classList.add('active');
            }
        });
    }

    /**
     * Update form navigation buttons
     */
    function updateFormNavigation() {
        // Show/hide previous button
        if (currentStep === 1) {
            prevBtn.style.display = 'none';
        } else {
            prevBtn.style.display = 'inline-flex';
        }

        // Show/hide next and submit buttons
        if (currentStep === totalSteps) {
            nextBtn.style.display = 'none';
            submitBtn.style.display = 'inline-flex';
        } else {
            nextBtn.style.display = 'inline-flex';
            submitBtn.style.display = 'none';
        }
    }

    /**
     * Handle next button
     */
    function handleNext() {
        if (validateCurrentStep()) {
            if (currentStep < totalSteps) {
                currentStep++;
                showStep(currentStep);
                updateFormNavigation();
                scrollToTop();
            }
        }
    }

    /**
     * Handle previous button
     */
    function handlePrevious() {
        if (currentStep > 1) {
            currentStep--;
            showStep(currentStep);
            updateFormNavigation();
            scrollToTop();
        }
    }

    /**
     * Validate current step
     */
    function validateCurrentStep() {
        const currentStepElement = document.querySelector(`.form-step[data-step="${currentStep}"]`);
        const requiredFields = currentStepElement.querySelectorAll('[required]');
        
        let isValid = true;
        let firstInvalidField = null;

        requiredFields.forEach(field => {
            if (!field.value.trim()) {
                isValid = false;
                field.style.borderColor = 'var(--danger-color)';
                
                if (!firstInvalidField) {
                    firstInvalidField = field;
                }

                // Add error message if not exists
                if (!field.nextElementSibling || !field.nextElementSibling.classList.contains('error-message')) {
                    const errorMsg = document.createElement('small');
                    errorMsg.className = 'error-message';
                    errorMsg.style.color = 'var(--danger-color)';
                    errorMsg.textContent = 'This field is required';
                    field.parentNode.appendChild(errorMsg);
                }
            } else {
                field.style.borderColor = '';
                
                // Remove error message if exists
                const errorMsg = field.parentNode.querySelector('.error-message');
                if (errorMsg) {
                    errorMsg.remove();
                }
            }
        });

        // Validate LRN format if provided
        const lrnField = document.getElementById('lrn');
        if (currentStep === 1 && lrnField && lrnField.value.trim()) {
            if (lrnField.value.length !== 12 || !/^\d{12}$/.test(lrnField.value)) {
                isValid = false;
                lrnField.style.borderColor = 'var(--danger-color)';
                
                if (!lrnField.nextElementSibling || !lrnField.nextElementSibling.classList.contains('error-message')) {
                    const errorMsg = document.createElement('small');
                    errorMsg.className = 'error-message';
                    errorMsg.style.color = 'var(--danger-color)';
                    errorMsg.textContent = 'LRN must be exactly 12 digits';
                    lrnField.parentNode.appendChild(errorMsg);
                }
                
                if (!firstInvalidField) {
                    firstInvalidField = lrnField;
                }
            }
        }

        if (!isValid) {
            if (firstInvalidField) {
                firstInvalidField.focus();
            }
            showNotification('Please fill in all required fields correctly', 'error');
        }

        return isValid;
    }

    /**
     * Handle form submission - UPDATED WITH BACKEND INTEGRATION
     */
    /**
     * Handle form submission - UPDATED WITH BACKEND INTEGRATION
     */
    async function handleSubmit(e) {
        e.preventDefault();

        // Validate all steps
        if (!validateAllSteps()) {
            showNotification('Please complete all required fields', 'error');
            return;
        }

        // Check terms agreement
        const termsCheckbox = document.getElementById('terms_agreement');
        if (!termsCheckbox.checked) {
            showNotification('Please agree to the terms and conditions', 'error');
            termsCheckbox.focus();
            return;
        }
        
        // ✅ FINAL DUPLICATE CHECK BEFORE SUBMISSION
        const lrn = document.getElementById('lrn').value.trim();
        const email = document.getElementById('email_address').value.trim();
        
        try {
            const duplicateCheck = await fetch(`/api/check-duplicate?lrn=${lrn}&email=${encodeURIComponent(email)}`);
            const duplicateResult = await duplicateCheck.json();
            
            if (duplicateResult.lrn_exists || duplicateResult.email_exists) {
                showNotification(duplicateResult.message, 'error');
                
                // Scroll to the problematic field
                if (duplicateResult.lrn_exists) {
                    currentStep = 1; // Go to step 1 where LRN is
                    showStep(currentStep);
                    updateFormNavigation();
                    document.getElementById('lrn').scrollIntoView({ behavior: 'smooth', block: 'center' });
                    document.getElementById('lrn').focus();
                } else if (duplicateResult.email_exists) {
                    currentStep = 4; // Go to step 4 where email is
                    showStep(currentStep);
                    updateFormNavigation();
                    document.getElementById('email_address').scrollIntoView({ behavior: 'smooth', block: 'center' });
                    document.getElementById('email_address').focus();
                }
                return;
            }
        } catch (error) {
            console.error('Error checking duplicates:', error);
            showNotification('Error checking for duplicates. Please try again.', 'error');
            return;
        }

        // Show loading state
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

        try {
            // Collect form data
            const formData = collectFormData();

            // Send to backend
            const response = await fetch('/api/register-enrollment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                // Show success modal
                showSuccessModal();
                showNotification('Registration submitted successfully!', 'success');
            } else {
                // Handle specific error cases
                if (response.status === 409) {
                    throw new Error(result.detail || 'LRN or Email already registered');
                }
                throw new Error(result.detail || 'Failed to submit registration');
            }

        } catch (error) {
            console.error('Registration error:', error);
            showNotification(error.message || 'Failed to submit registration. Please try again.', 'error');
        } finally {
            // Reset button state
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fas fa-check"></i> Submit Registration';
        }
    }

    /**
     * Validate all steps
     */
    function validateAllSteps() {
        let allValid = true;

        for (let step = 1; step <= totalSteps; step++) {
            const tempStep = currentStep;
            currentStep = step;
            
            if (!validateCurrentStep()) {
                allValid = false;
                currentStep = tempStep;
                showStep(step);
                updateFormNavigation();
                break;
            }
            
            currentStep = tempStep;
        }

        return allValid;
    }

    /**
     * Collect all form data - UPDATED TO MATCH BACKEND MODEL
     */
    function collectFormData() {
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        
        // Handle name extension - use custom value if "others" is selected
        let nameExtension = document.getElementById('name_extension').value;
        if (nameExtension === 'others') {
            nameExtension = document.getElementById('name_extension_custom').value || null;
        } else if (nameExtension === '') {
            nameExtension = null;
        }
        
        const formData = {
            // Personal Information
            lrn: document.getElementById('lrn').value,
            enrollment_date: document.getElementById('enrollment_date').value,
            last_name: document.getElementById('last_name').value,
            first_name: document.getElementById('first_name').value,
            middle_name: document.getElementById('middle_name').value || null,
            name_extension: nameExtension,
            birthdate: document.getElementById('birthdate').value,
            place_of_birth: document.getElementById('place_of_birth').value,
            sex: document.getElementById('sex').value,
            civil_status: document.getElementById('civil_status').value,
            religion: document.getElementById('religion').value || null,
            mother_tongue: document.getElementById('mother_tongue').value || null,
            ip_ethnic_group: document.getElementById('ip_ethnic_group').value || null,
            contact_numbers: document.getElementById('contact_numbers').value,
            is_pwd: document.getElementById('is_pwd').checked,
            is_4ps: document.getElementById('is_4ps').checked,

            // Address Information
            house_no_street_sitio: document.getElementById('house_no_street_sitio').value,
            barangay: document.getElementById('barangay').value,
            municipality_city: document.getElementById('municipality_city').value,
            province: document.getElementById('province').value,

            // Educational Background
            last_grade_level_completed: document.getElementById('last_grade_level_completed').value,
            elementary_school: document.getElementById('elementary_school').value || null,
            junior_high_school: document.getElementById('junior_high_school').value || null,
            dropout_reason: document.getElementById('dropout_reason').value || null,
            dropout_reason_others: document.getElementById('dropout_reason_others').value || null,
            attended_als_before: document.getElementById('attended_als_before').checked,
            previous_program_name: document.getElementById('previous_program_name').value || null,
            previous_literacy_level: document.getElementById('previous_literacy_level').value || null,
            previous_year_attended: document.getElementById('previous_year_attended').value || null,
            previous_program_completed: document.getElementById('previous_program_completed').checked,
            previous_not_completed_reason: document.getElementById('previous_not_completed_reason').value || null,
            distance_to_learning_center_km: parseFloat(document.getElementById('distance_to_learning_center_km').value) || null,
            distance_to_learning_center_hours: parseInt(document.getElementById('distance_to_learning_center_hours').value) || null,
            distance_to_learning_center_mins: parseInt(document.getElementById('distance_to_learning_center_mins').value) || null,
            transportation_mode: document.getElementById('transportation_mode').value || null,
            transportation_mode_others: document.getElementById('transportation_mode_others').value || null,

            // Family Information
            father_guardian_last_name: document.getElementById('father_guardian_last_name').value || null,
            father_guardian_first_name: document.getElementById('father_guardian_first_name').value || null,
            father_guardian_middle_name: document.getElementById('father_guardian_middle_name').value || null,
            father_guardian_occupation: document.getElementById('father_guardian_occupation').value || null,
            mother_maiden_last_name: document.getElementById('mother_maiden_last_name').value || null,
            mother_maiden_first_name: document.getElementById('mother_maiden_first_name').value || null,
            mother_maiden_middle_name: document.getElementById('mother_maiden_middle_name').value || null,
            mother_maiden_occupation: document.getElementById('mother_maiden_occupation').value || null,

            // Schedule Availability - Formatted for backend
            schedule_availability: {},
            email_address: document.getElementById('email_address').value,
            als_teacher_facilitator: document.getElementById('als_teacher_facilitator').value || null,
            teacher_signature_date: document.getElementById('teacher_signature_date').value || null,
            learner_signature_date: document.getElementById('learner_signature_date').value || null
            
            
        };

        // Collect schedule data
        days.forEach(day => {
            const isAvailable = document.getElementById(`${day}_available`).checked;
            const startTime = document.getElementById(`${day}_start`).value;
            const endTime = document.getElementById(`${day}_end`).value;

            formData.schedule_availability[day] = {
                available: isAvailable,
                start_time: startTime || null,
                end_time: endTime || null,
                time_formatted: (startTime && endTime) ? `${startTime} - ${endTime}` : null
            };
        });


        return formData;
    }

    /**
     * Setup conditional field displays
     */
    function setupConditionalFields() {
        // Dropout reason - show "others" field
        const dropoutReason = document.getElementById('dropout_reason');
        const dropoutReasonOthersGroup = document.getElementById('dropout_reason_others_group');
        
        dropoutReason.addEventListener('change', function() {
            if (this.value === 'Others') {
                dropoutReasonOthersGroup.style.display = 'block';
            } else {
                dropoutReasonOthersGroup.style.display = 'none';
            }
        });

        // Transportation mode - show "others" field
        const transportationMode = document.getElementById('transportation_mode');
        const transportationModeOthersGroup = document.getElementById('transportation_mode_others_group');
        
        transportationMode.addEventListener('change', function() {
            if (this.value === 'Others') {
                transportationModeOthersGroup.style.display = 'block';
            } else {
                transportationModeOthersGroup.style.display = 'none';
            }
        });

        // Attended ALS before - show previous ALS section
        const attendedAlsBefore = document.getElementById('attended_als_before');
        const previousAlsSection = document.getElementById('previous_als_section');
        
        attendedAlsBefore.addEventListener('change', function() {
            if (this.checked) {
                previousAlsSection.style.display = 'block';
            } else {
                previousAlsSection.style.display = 'none';
            }
        });

        // Previous program completed - show reason field
        const programCompleted = document.getElementById('previous_program_completed');
        const notCompletedReasonGroup = document.getElementById('not_completed_reason_group');
        
        programCompleted.addEventListener('change', function() {
            if (!this.checked && attendedAlsBefore.checked) {
                notCompletedReasonGroup.style.display = 'block';
            } else {
                notCompletedReasonGroup.style.display = 'none';
            }
        });
    }

    /**
     * Setup schedule day toggles with improved dropdown functionality
     */
    function setupScheduleToggles() {
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        
        days.forEach(day => {
            const checkbox = document.getElementById(`${day}_available`);
            const startSelect = document.getElementById(`${day}_start`);
            const endSelect = document.getElementById(`${day}_end`);
            const scheduleItem = checkbox.closest('.schedule-item');
            
            // Handle checkbox change
            checkbox.addEventListener('change', function() {
                if (this.checked) {
                    startSelect.disabled = false;
                    endSelect.disabled = false;
                    scheduleItem.classList.add('active');
                } else {
                    startSelect.disabled = true;
                    endSelect.disabled = true;
                    startSelect.value = '';
                    endSelect.value = '';
                    scheduleItem.classList.remove('active');
                }
            });

            // Initialize state
            if (!checkbox.checked) {
                startSelect.disabled = true;
                endSelect.disabled = true;
            }
        });
    }

    /**
     * Show success modal
     */
    function showSuccessModal() {
        successModal.classList.add('show');
    }

    /**
     * Show notification
     */
    function showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.style.cssText = `
            position: fixed;
            top: 2rem;
            right: 2rem;
            background: ${type === 'error' ? 'var(--danger-color)' : 'var(--secondary-color)'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 0.5rem;
            box-shadow: var(--shadow-lg);
            z-index: 9999;
            animation: slideInRight 0.3s ease;
        `;
        
        notification.innerHTML = `
            <i class="fas fa-${type === 'error' ? 'exclamation-circle' : 'check-circle'}"></i>
            <span style="margin-left: 0.5rem;">${message}</span>
        `;
        
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }

    /**
     * Scroll to top
     */
    function scrollToTop() {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    }

    /**
     * Format phone number input
     */
    const phoneInput = document.getElementById('contact_numbers');
    phoneInput.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 11) {
            value = value.slice(0, 11);
        }
        e.target.value = value;
    });

    /**
     * Format LRN input
     */
    const lrnInput = document.getElementById('lrn');
    lrnInput.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 12) {
            value = value.slice(0, 12);
        }
        e.target.value = value;
    });

    /**
     * LRN Duplicate Check with debouncing
     */
    lrnInput.addEventListener('input', async function(e) {
        const lrnValue = e.target.value.trim();
        
        // Clear previous timeout
        clearTimeout(lrnCheckTimeout);
        
        // Remove any existing error messages
        const existingError = lrnInput.parentNode.querySelector('.duplicate-error');
        if (existingError) existingError.remove();
        lrnInput.style.borderColor = '';
        
        // Only check if LRN is 12 digits
        if (lrnValue.length === 12) {
            lrnCheckTimeout = setTimeout(async () => {
                try {
                    const response = await fetch(`/api/check-duplicate?lrn=${lrnValue}`);
                    const result = await response.json();
                    
                    if (result.lrn_exists) {
                        lrnInput.style.borderColor = 'var(--danger-color)';
                        
                        const errorMsg = document.createElement('small');
                        errorMsg.className = 'duplicate-error';
                        errorMsg.style.color = 'var(--danger-color)';
                        errorMsg.style.display = 'block';
                        errorMsg.style.marginTop = '0.25rem';
                        errorMsg.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${result.message}`;
                        
                        lrnInput.parentNode.appendChild(errorMsg);
                    }
                } catch (error) {
                    console.error('Error checking LRN:', error);
                }
            }, 500); // Wait 500ms after user stops typing
        }
    });

    /**
     * Email Duplicate Check
     */
    const emailInput = document.getElementById('email_address');
    emailInput.addEventListener('blur', async function(e) {
        const emailValue = e.target.value.trim();
        
        // Remove any existing error messages
        const existingError = emailInput.parentNode.querySelector('.duplicate-error');
        if (existingError) existingError.remove();
        emailInput.style.borderColor = '';
        
        // Only check if email has valid format
        if (emailValue && emailValue.includes('@')) {
            try {
                const response = await fetch(`/api/check-duplicate?email=${encodeURIComponent(emailValue)}`);
                const result = await response.json();
                
                if (result.email_exists) {
                    emailInput.style.borderColor = 'var(--danger-color)';
                    
                    const errorMsg = document.createElement('small');
                    errorMsg.className = 'duplicate-error';
                    errorMsg.style.color = 'var(--danger-color)';
                    errorMsg.style.display = 'block';
                    errorMsg.style.marginTop = '0.25rem';
                    errorMsg.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${result.message}`;
                    
                    emailInput.parentNode.appendChild(errorMsg);
                }
            } catch (error) {
                console.error('Error checking email:', error);
            }
        }
    });



    // Add CSS animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
});