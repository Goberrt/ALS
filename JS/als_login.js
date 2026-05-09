// DOM Elements
const loginForm = document.getElementById('loginForm');
const forgotPasswordForm = document.getElementById('forgotPasswordForm');
const leftPanelText = document.getElementById('leftPanelText');
const forgotPasswordLink = document.getElementById('forgotPasswordLink');
const backToLoginLink = document.getElementById('backToLoginLink');
const loginFormElement = document.getElementById('loginFormElement');
const forgotPasswordFormElement = document.getElementById('forgotPasswordFormElement');

// Form switching
forgotPasswordLink.addEventListener('click', (e) => {
    e.preventDefault();
    showForgotPasswordForm();
});

backToLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    showLoginForm();
});

function showForgotPasswordForm() {
    loginForm.classList.add('hidden');
    forgotPasswordForm.classList.remove('hidden');
    leftPanelText.innerHTML = `
        <h1>RESET YOUR ALS ACCOUNT</h1>
        <p>Don't worry! Enter your username and we'll send you reset instructions to your registered email address.</p>
    `;
}

function showLoginForm() {
    forgotPasswordForm.classList.add('hidden');
    loginForm.classList.remove('hidden');
    leftPanelText.innerHTML = `
        <h1>SIGN-IN TO YOUR ALS ACCOUNT</h1>
        <p>Access the Alternative Learning System Tracking Portal to manage and monitor ALS learner information across Santa Cruz, Laguna.</p>
    `;
}

// Login form submission
loginFormElement.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const loginBtn = document.querySelector('.login-btn');
    const loginError = document.getElementById('loginError');
    const loginSuccess = document.getElementById('loginSuccess');
    
    try {
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
        
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();
        console.log('Login response:', data); // Debug log

        if (response.ok && data.success && data.user && data.user.role) {
            // Store user info in localStorage
            localStorage.setItem('user', JSON.stringify(data.user));
            
            const role = data.user.role.toLowerCase();
            console.log('User role:', role); // Debug log

            switch(role) {
                case 'student':
                    showMessage(loginSuccess, 'Login successful! Redirecting to student dashboard...');
                    setTimeout(() => {
                        window.location.href = '/student_dashboard';
                    }, 1000);
                    break;
                    
                case 'instructor':
                    showMessage(loginSuccess, 'Login successful! Redirecting to instructor dashboard...');
                    setTimeout(() => {
                        window.location.href = '/instructor_dashboard';
                    }, 1000);
                    break;
                    
                default:
                    console.log('Invalid role:', role); // Debug log
                    showMessage(loginError, 'Invalid user role');
                    break;
                case 'admin':
                showMessage(loginSuccess, 'Login successful! Redirecting to admin dashboard...');
                setTimeout(() => {
                    window.location.href = '/admin_dashboard';
                }, 1000);
                break;
            }
        } else {
            showMessage(loginError, data.detail || 'Invalid username or password');
        }
    } catch (error) {
        console.error('Login error:', error); // Debug log
        showMessage(loginError, 'Server error. Please try again.');
    } finally {
        loginBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
    }
});

// Forgot password form submission
forgotPasswordFormElement.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('resetUsername').value;
    const resetBtn = document.querySelector('.reset-btn');
    const resetError = document.getElementById('resetError');
    const resetSuccess = document.getElementById('resetSuccess');

    // Show loading state
    resetBtn.classList.add('loading');
    resetBtn.innerHTML = '<i class="fas fa-spinner"></i> Sending...';
    hideMessages();

    try {
        // Call your FastAPI endpoint
        const response = await fetch("http://localhost:8000/api/forgot-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username })
        });
        const result = await response.json();

        if (response.ok && result.success) {
            showMessage(resetSuccess, 'Password reset instructions sent to your registered email.');
            document.getElementById('resetUsername').value = '';
        } else {
            showMessage(resetError, result.detail || "Username not found. Please check and try again.");
        }
    } catch (error) {
        showMessage(resetError, 'Failed to send reset email. Please try again.');
    } finally {
        resetBtn.classList.remove('loading');
        resetBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Reset Link';
    }
});

// Utility functions
function showMessage(element, message) {
    element.textContent = message;
    element.style.display = 'block';
}

function hideMessages() {
    document.querySelectorAll('.success-message, .error-message').forEach(el => {
        el.style.display = 'none';
    });
}

// Simulated Password Reset (replace with real backend call later)

// Add some interactive effects
document.addEventListener('mousemove', (e) => {
    const loginContainer = document.querySelector('.login-container');
    const rect = loginContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const xPercent = (x / rect.width - 0.5) * 10;
    const yPercent = (y / rect.height - 0.5) * 10;
    
    loginContainer.style.transform = `perspective(1000px) rotateY(${xPercent}deg) rotateX(${-yPercent}deg)`;
});

document.addEventListener('mouseleave', () => {
    const loginContainer = document.querySelector('.login-container');
    loginContainer.style.transform = 'perspective(1000px) rotateY(0deg) rotateX(0deg)';
});
