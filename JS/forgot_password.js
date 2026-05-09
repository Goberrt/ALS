document.addEventListener('DOMContentLoaded', () => {
    // Get token from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const resetToken = urlParams.get('token');

    // If no token, redirect to login
    if (!resetToken) {
        console.error('No reset token found');
        window.location.href = 'login.html';
        return;
    }

    // Password visibility toggle
    document.querySelectorAll('.toggle-password').forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.getAttribute('data-target');
            const input = document.getElementById(targetId);
            const icon = button.querySelector('i');
            
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.replace('fa-eye', 'fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.replace('fa-eye-slash', 'fa-eye');
            }
        });
    });

    // Password strength meter
    const passwordInput = document.getElementById('newPassword');
    const strengthMeter = document.querySelectorAll('.meter-segment');
    const strengthText = document.querySelector('.strength-text');

    passwordInput.addEventListener('input', () => {
        const password = passwordInput.value;
        let strength = 0;
        
        if (password.length >= 8) strength++;
        if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++;
        if (password.match(/\d/)) strength++;
        if (password.match(/[^a-zA-Z\d]/)) strength++;

        // Update meter segments
        strengthMeter.forEach((segment, index) => {
            if (index < strength) {
                segment.style.background = 'linear-gradient(135deg, #667eea, #764ba2)';
            } else {
                segment.style.background = 'rgba(255, 255, 255, 0.1)';
            }
        });

        const strengthLabels = ['Weak', 'Fair', 'Good', 'Strong'];
        strengthText.textContent = `Password Strength: ${strengthLabels[strength-1] || 'Too Weak'}`;
        
        // Change text color based on strength
        if (strength === 0) {
            strengthText.style.color = '#f44336';
        } else if (strength === 1) {
            strengthText.style.color = '#ff9800';
        } else if (strength === 2) {
            strengthText.style.color = '#ffc107';
        } else if (strength === 3) {
            strengthText.style.color = '#8bc34a';
        } else if (strength === 4) {
            strengthText.style.color = '#4caf50';
        }
    });

    // Form submission
    const form = document.getElementById('resetPasswordForm');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const errorMessage = document.getElementById('resetError');
        const successMessage = document.getElementById('resetSuccess');

        // Hide previous messages
        errorMessage.style.display = 'none';
        successMessage.style.display = 'none';

        // Validate passwords match
        if (newPassword !== confirmPassword) {
            errorMessage.querySelector('span').textContent = 'Passwords do not match!';
            errorMessage.style.display = 'flex';
            return;
        }

        // Validate password strength
        if (newPassword.length < 8) {
            errorMessage.querySelector('span').textContent = 'Password must be at least 8 characters long!';
            errorMessage.style.display = 'flex';
            return;
        }

        // Add loading state
        const submitBtn = form.querySelector('.reset-btn');
        const btnText = submitBtn.querySelector('.btn-text');
        const btnIcon = submitBtn.querySelector('i');
        submitBtn.classList.add('loading');
        submitBtn.disabled = true;
        btnText.textContent = 'Resetting...';

        try {
            // Make API call to reset password
            const response = await fetch('/api/reset-password', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    token: resetToken,
                    new_password: newPassword,
                    confirm_password: confirmPassword
                })
            });

            const data = await response.json();

            if (response.ok) {
                // Success
                successMessage.querySelector('span').textContent = data.message || 'Password reset successfully!';
                successMessage.style.display = 'flex';
                
                // Clear form
                form.reset();
                
                // Redirect after 2 seconds
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
            } else {
                // Error from server
                errorMessage.querySelector('span').textContent = data.detail || data.message || 'Failed to reset password. Please try again.';
                errorMessage.style.display = 'flex';
            }
        } catch (error) {
            console.error('Error:', error);
            errorMessage.querySelector('span').textContent = 'Network error. Please check your connection and try again.';
            errorMessage.style.display = 'flex';
        } finally {
            // Remove loading state
            submitBtn.classList.remove('loading');
            submitBtn.disabled = false;
            btnText.textContent = 'Reset Password';
        }
    });
});