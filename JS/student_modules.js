if (!window.supabaseClient) {
    window.supabaseClient = window.supabase.createClient(
        'https://bbinymljjtjxkeclqamt.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiaW55bWxqanRqeGtlY2xxYW10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MzQ1OTQsImV4cCI6MjA3MjMxMDU5NH0.bOIwdxUiLd-63V6-_XZxER1PLqohtd1cnwipF6YZjn4'
    );
}

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    if (!currentUser || !currentUser.username) {
        window.location.href = '/';
        return;
    }

    loadStudentSubjects();

    const modal = document.getElementById('enrollModal');
    const enrollBtn = document.getElementById('enrollBtn');
    const closeBtn = document.querySelector('.close');
    const cancelBtn = document.getElementById('cancelEnrollBtn');
    const enrollForm = document.getElementById('enrollForm');

    enrollBtn.onclick = () => {
        modal.style.display = 'block';
        enrollForm.reset();
    };

    closeBtn.onclick = () => modal.style.display = 'none';
    cancelBtn.onclick = () => modal.style.display = 'none';

    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };

    enrollForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await enrollInSubject();
    });

    // Load sidebar
    fetch('../COMPONENTS/student_sidebar.html')
        .then(response => response.text())
        .then(html => {
            document.getElementById('sidebarContainer').innerHTML = html;
            initializeSidebar();
            initializeMobileMenu();
            loadSidebarProfile();
        })
        .catch(error => console.error('Error loading sidebar:', error));
});

function initializeMobileMenu() {
    const burgerMenu = document.getElementById('burgerMenu');
    const sidebar = document.querySelector('.sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    if (!burgerMenu || !sidebar || !sidebarOverlay) return;

    // Toggle sidebar
    burgerMenu.addEventListener('click', () => {
        sidebar.classList.toggle('active');
        sidebarOverlay.classList.toggle('active');
        document.body.style.overflow = sidebar.classList.contains('active') ? 'hidden' : '';
    });

    // Close sidebar when clicking overlay
    sidebarOverlay.addEventListener('click', () => {
        sidebar.classList.remove('active');
        sidebarOverlay.classList.remove('active');
        document.body.style.overflow = '';
    });

    // Close sidebar when clicking a nav item
    document.addEventListener('click', (e) => {
        if (e.target.closest('.nav-tab')) {
            sidebar.classList.remove('active');
            sidebarOverlay.classList.remove('active');
            document.body.style.overflow = '';
        }
    });
}

async function loadStudentSubjects() {
    try {
        const { data: enrollments, error } = await window.supabaseClient
            .from('subject_enrollments')
            .select(`
                *,
                subject:subject_id(
                    id,
                    subject_name,
                    subject_code,
                    description,
                    instructor:instructor_id(username, first_name, last_name)
                )
            `)
            .eq('student_id', currentUser.id)
            .eq('status', 'active');

        const container = document.getElementById('subjectsContainer');
        const emptyState = document.getElementById('emptyState');

        if (error || !enrollments || enrollments.length === 0) {
            container.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        container.style.display = 'grid';
        emptyState.style.display = 'none';

        container.innerHTML = enrollments.map(enrollment => {
            const subject = enrollment.subject;
            const instructor = subject.instructor;
            const instructorInitial = instructor.first_name ? instructor.first_name.charAt(0).toUpperCase() : 'I';
            const instructorName = `${instructor.first_name || ''} ${instructor.last_name || ''}`.trim() || instructor.username;

            return `
                <div class="subject-card" onclick="viewSubject('${subject.id}')">
                    <div class="subject-header">
                        <div class="subject-code">${subject.subject_code}</div>
                        <h3 class="subject-name">${subject.subject_name}</h3>
                    </div>
                    <div class="subject-body">
                        <div class="instructor-info">
                            <div class="instructor-avatar">${instructorInitial}</div>
                            <span class="instructor-name">${instructorName}</span>
                        </div>
                        ${subject.description ? `<p style="color: #666; font-size: 0.875rem;">${subject.description}</p>` : ''}
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Error loading subjects:', error);
        alert('Failed to load subjects');
    }
}

async function enrollInSubject() {
    const classCode = document.getElementById('class-code').value.trim().toUpperCase();
    
    if (!classCode || classCode.length !== 8) {
        alert('Please enter a valid 8-character class code');
        return;
    }

    try {
        // Call your backend API
        const response = await fetch('/api/enroll-subject', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                class_code: classCode,
                student_id: currentUser.id
            })
        });

        const result = await response.json();
        console.log('Enrollment response:', result); // Debug log

        if (!response.ok) {
            // Handle error - result.detail is the error message from FastAPI
            const errorMessage = result.detail || 'Enrollment failed';
            alert(errorMessage);
            return;
        }

        // Success
        document.getElementById('enrollModal').style.display = 'none';
        alert(result.message || 'Successfully enrolled!');
        await loadStudentSubjects();

    } catch (error) {
        console.error('Enrollment error:', error);
        alert('An error occurred during enrollment. Please try again.');
    }
}

function viewSubject(subjectId) {
    window.location.href = `/student_subject_view?id=${subjectId}`;
}

function confirmLogout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('user');
        window.location.href = '/';
    }
    return false;
}

function initializeSidebar() {
    const currentTab = document.querySelector('[data-page="modules"]');
    if (currentTab) {
        currentTab.classList.add('active');
    }

    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const page = tab.dataset.page;
            if (page === 'logout') {
                confirmLogout();
                return;
            }
            window.location.href = `/student_${page}`;
        });
    });
}