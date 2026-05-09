if (!window.supabaseClient) {
    window.supabaseClient = window.supabase.createClient(
        'https://bbinymljjtjxkeclqamt.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiaW55bWxqanRqeGtlY2xxYW10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MzQ1OTQsImV4cCI6MjA3MjMxMDU5NH0.bOIwdxUiLd-63V6-_XZxER1PLqohtd1cnwipF6YZjn4'
    );
}

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    currentUser = JSON.parse(localStorage.getItem('user'));
    if (!currentUser || currentUser.role !== 'student') {
        window.location.href = '/';
        return;
    }

    // Load grades data
    await loadAllGrades();

    // Load sidebar
    fetch('../COMPONENTS/student_sidebar.html')
        .then(response => response.text())
        .then(html => {
            document.getElementById('sidebarContainer').innerHTML = html;
            initializeSidebar();
            initializeMobileMenu();
            loadSidebarProfile();
        })
        .catch(error => console.error('Error:', error));
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

async function loadAllGrades() {
    try {
        // Get student's enrollments with subject details
        const { data: enrollments, error: enrollError } = await window.supabaseClient
            .from('subject_enrollments')
            .select(`
                *,
                subject:subject_id(
                    id,
                    subject_name,
                    subject_code
                )
            `)
            .eq('student_id', currentUser.id)
            .eq('status', 'active');

        if (enrollError) throw enrollError;

        if (!enrollments || enrollments.length === 0) {
            showEmptyState();
            return;
        }

        // Get all subject IDs
        const subjectIds = enrollments.map(e => e.subject_id);

        // Get all assignments from enrolled subjects
        const { data: assignments, error: assignError } = await window.supabaseClient
            .from('subject_posts')
            .select('*')
            .eq('post_type', 'assignment')
            .in('subject_id', subjectIds);

        if (assignError) throw assignError;

        // Get student's submissions
        const { data: submissions, error: subError } = await window.supabaseClient
            .from('post_submissions')
            .select('*')
            .eq('student_id', currentUser.id);

        if (subError) throw subError;

        // Process and display data
        updateOverallStats(assignments, submissions);
        displaySubjectGrades(enrollments, assignments, submissions);
        displayRecentGrades(assignments, submissions);

    } catch (error) {
        console.error('Error loading grades:', error);
        document.getElementById('subjectsGradesContainer').innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-circle"></i>
                <h3>Error loading grades</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}

function updateOverallStats(assignments, submissions) {
    let totalPossible = 0;
    let totalEarned = 0;
    let gradedCount = 0;

    const submissionMap = {};
    if (submissions) {
        submissions.forEach(sub => {
            submissionMap[sub.post_id] = sub;
        });
    }

    if (assignments) {
        assignments.forEach(assignment => {
            const submission = submissionMap[assignment.id];
            const points = assignment.points || 100;
            
            totalPossible += points;
            
            if (submission && submission.grade !== null) {
                totalEarned += submission.grade;
                gradedCount++;
            }
        });
    }

    const percentage = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0;

    document.getElementById('overallGrade').textContent = `${percentage}%`;
    document.getElementById('totalPoints').textContent = totalEarned;
    document.getElementById('possiblePoints').textContent = totalPossible;
    document.getElementById('gradedCount').textContent = gradedCount;

    // Animate progress bar
    setTimeout(() => {
        document.getElementById('progressBar').style.width = `${percentage}%`;
    }, 100);
}

function displaySubjectGrades(enrollments, assignments, submissions) {
    const container = document.getElementById('subjectsGradesContainer');

    const submissionMap = {};
    if (submissions) {
        submissions.forEach(sub => {
            submissionMap[sub.post_id] = sub;
        });
    }

    const subjectsHtml = enrollments.map(enrollment => {
        const subject = enrollment.subject;
        const subjectAssignments = assignments.filter(a => a.subject_id === subject.id);
        
        let totalPossible = 0;
        let totalEarned = 0;
        let gradedCount = 0;
        let totalAssignments = subjectAssignments.length;

        subjectAssignments.forEach(assignment => {
            const submission = submissionMap[assignment.id];
            const points = assignment.points || 100;
            
            totalPossible += points;
            
            if (submission && submission.grade !== null) {
                totalEarned += submission.grade;
                gradedCount++;
            }
        });

        const percentage = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0;
        const isPassing = percentage >= 75;
        const statusClass = isPassing ? 'pass' : 'fail';
        const statusText = isPassing ? '✓ PASS' : '✕ FAIL';

        return `
            <div class="subject-grade-card" onclick="viewSubjectGrades('${subject.id}')">
                <div class="subject-name">${subject.subject_name}</div>
                <div class="subject-code">${subject.subject_code}</div>
                <div class="subject-grade-display">
                    <div class="subject-percentage">${percentage}%</div>
                    <span class="subject-status ${statusClass}">${statusText}</span>
                </div>
                <div class="subject-meta">
                    <div class="subject-meta-item">
                        <i class="fas fa-tasks"></i>
                        <span>${totalAssignments} assignments</span>
                    </div>
                    <div class="subject-meta-item">
                        <i class="fas fa-check-circle"></i>
                        <span>${gradedCount} graded</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = subjectsHtml || `
        <div class="empty-state">
            <i class="fas fa-inbox"></i>
            <p>No subjects enrolled yet</p>
        </div>
    `;
}

function displayRecentGrades(assignments, submissions) {
    const container = document.getElementById('recentGradesContainer');

    if (!submissions || submissions.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>No graded work yet</p>
            </div>
        `;
        return;
    }

    // Filter graded submissions and sort by graded date
    const gradedSubmissions = submissions
        .filter(s => s.grade !== null)
        .sort((a, b) => new Date(b.graded_at || b.submitted_at) - new Date(a.graded_at || a.submitted_at))
        .slice(0, 15);

    const recentHtml = gradedSubmissions.map(submission => {
        const assignment = assignments.find(a => a.id === submission.post_id);
        if (!assignment) return '';

        const percentage = assignment.points > 0 ? Math.round((submission.grade / assignment.points) * 100) : 0;
        const gradedDate = new Date(submission.graded_at || submission.submitted_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });

        return `
            <div class="grade-item">
                <div class="grade-item-left">
                    <div class="grade-item-assignment">${assignment.title}</div>
                    <div class="grade-item-meta">
                        <span class="grade-item-date">
                            <i class="fas fa-calendar-alt"></i> ${gradedDate}
                        </span>
                    </div>
                </div>
                <div class="grade-item-right">
                    <div class="grade-item-score">${submission.grade}/${assignment.points}</div>
                    <div class="grade-item-percentage">${percentage}%</div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = recentHtml || `
        <div class="empty-state">
            <i class="fas fa-inbox"></i>
            <p>No recent grades</p>
        </div>
    `;
}

function viewSubjectGrades(subjectId) {
    window.location.href = `/student_subject_view?id=${subjectId}#grades`;
}

function showEmptyState() {
    document.getElementById('subjectsGradesContainer').innerHTML = `
        <div class="empty-state">
            <i class="fas fa-book-open"></i>
            <h3>No subjects enrolled</h3>
            <p>Enroll in subjects to see your grades here</p>
        </div>
    `;
    document.getElementById('recentGradesContainer').innerHTML = `
        <div class="empty-state">
            <i class="fas fa-inbox"></i>
            <p>No grades to display</p>
        </div>
    `;
}

function confirmLogout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('user');
        window.location.href = '/';
    }
    return false;
}

function initializeSidebar() {
    const currentTab = document.querySelector('[data-page="grades"]');
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