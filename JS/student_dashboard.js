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
    if (!currentUser) {
        window.location.href = '/';
        return;
    }
    if (currentUser.role !== 'student') {
        window.location.href = '/';
        return;
    }

    // Set date
    document.getElementById('currentDate').textContent = formatDate(new Date());

    // Load student name early
    try {
        const profileResponse = await fetch(`/api/student-profile/${currentUser.id}`);
        if (profileResponse.ok) {
            const profileData = await profileResponse.json();
            const firstName = profileData.first_name || 'Student';
            document.getElementById('studentName').textContent = firstName;
        }
    } catch (error) {
        console.error('Error loading student name:', error);
    }

    // Load all dashboard data
    await loadDashboardData();

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

function formatDate(date) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

function formatRelativeTime(date) {
    const now = new Date();
    const diff = date - now;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days < 7) return `In ${days} days`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

async function loadDashboardData() {
    try {
        // Get student's enrollments
        const { data: enrollments, error: enrollError } = await window.supabaseClient
            .from('subject_enrollments')
            .select(`
                *,
                subject:subject_id(
                    id,
                    subject_name,
                    subject_code,
                    instructor:instructor_id(username, first_name, last_name)
                )
            `)
            .eq('student_id', currentUser.id)
            .eq('status', 'active');

        if (enrollError) throw enrollError;

        // Get all assignments from enrolled subjects
        const subjectIds = enrollments ? enrollments.map(e => e.subject_id) : [];
        
        const { data: assignments, error: assignError } = await window.supabaseClient
            .from('subject_posts')
            .select('*')
            .eq('post_type', 'assignment')
            .eq('is_published', true)
            .in('subject_id', subjectIds);

        if (assignError) throw assignError;

        // Get student's submissions
        const { data: submissions, error: subError } = await window.supabaseClient
            .from('post_submissions')
            .select('*')
            .eq('student_id', currentUser.id);

        if (subError) throw subError;

        // Update statistics
        updateStatistics(enrollments, assignments, submissions);

        // Load upcoming deadlines
        loadUpcomingDeadlines(assignments, submissions);

        // Load recent activity
        loadRecentActivity(assignments, submissions);

        // Load active subjects
        loadActiveSubjects(enrollments, assignments, submissions);

    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

function updateStatistics(enrollments, assignments, submissions) {
    // Active subjects
    const subjectCount = enrollments ? enrollments.length : 0;
    document.getElementById('activeSubjects').textContent = subjectCount;

    // Assignments
    const totalAssignments = assignments ? assignments.length : 0;
    const submittedCount = submissions ? submissions.length : 0;
    document.getElementById('assignmentsDone').textContent = `${submittedCount}/${totalAssignments}`;

    // Completion rate
    const completionRate = totalAssignments > 0 
        ? Math.round((submittedCount / totalAssignments) * 100) 
        : 0;
    document.getElementById('completionRate').textContent = `${completionRate}%`;

    // Average grade
    const gradedSubmissions = submissions ? submissions.filter(s => s.grade !== null) : [];
    if (gradedSubmissions.length > 0) {
        const totalPoints = gradedSubmissions.reduce((sum, s) => {
            const assignment = assignments.find(a => a.id === s.post_id);
            return sum + (assignment ? assignment.points || 0 : 0);
        }, 0);
        
        const earnedPoints = gradedSubmissions.reduce((sum, s) => sum + (s.grade || 0), 0);
        const avgPercentage = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
        
        document.getElementById('averageGrade').textContent = `${avgPercentage}/100`;
    } else {
        document.getElementById('averageGrade').textContent = 'No grades yet';
    }
}

function loadUpcomingDeadlines(assignments, submissions) {
    const container = document.getElementById('deadlinesContainer');
    
    if (!assignments || assignments.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-calendar-check"></i>
                <p>No upcoming deadlines</p>
            </div>
        `;
        return;
    }

    // Filter assignments with due dates that haven't been submitted
    const submittedIds = submissions ? submissions.map(s => s.post_id) : [];
    const upcoming = assignments
        .filter(a => a.due_date && !submittedIds.includes(a.id))
        .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
        .slice(0, 5);

    if (upcoming.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-check-circle"></i>
                <p>All caught up! 🎉</p>
            </div>
        `;
        return;
    }

    container.innerHTML = upcoming.map(assignment => {
        const dueDate = new Date(assignment.due_date);
        const now = new Date();
        const diffDays = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
        
        let urgencyClass = '';
        if (diffDays <= 1) urgencyClass = 'urgent';
        else if (diffDays <= 3) urgencyClass = 'soon';

        return `
            <div class="deadline-item ${urgencyClass}" onclick="viewAssignment('${assignment.subject_id}')">
                <div class="deadline-title">${assignment.title}</div>
                <div class="deadline-meta">
                    <span class="deadline-subject">
                        <i class="fas fa-book"></i> ${assignment.subject_code || 'Subject'}
                    </span>
                    <span class="deadline-date">
                        <i class="fas fa-clock"></i> ${formatRelativeTime(dueDate)}
                    </span>
                    ${assignment.points ? `<span><i class="fas fa-star"></i> ${assignment.points} pts</span>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function loadRecentActivity(assignments, submissions) {
    const container = document.getElementById('activityContainer');
    
    // Combine and sort recent items
    const activities = [];
    
    // Recent submissions
    if (submissions) {
        submissions
            .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))
            .slice(0, 3)
            .forEach(sub => {
                const assignment = assignments.find(a => a.id === sub.post_id);
                if (assignment) {
                    if (sub.grade !== null) {
                        activities.push({
                            type: 'grade',
                            text: `Grade received: ${assignment.title}`,
                            time: sub.graded_at || sub.submitted_at,
                            icon: 'fa-star'
                        });
                    } else {
                        activities.push({
                            type: 'assignment',
                            text: `Submitted: ${assignment.title}`,
                            time: sub.submitted_at,
                            icon: 'fa-file-alt'
                        });
                    }
                }
            });
    }

    // Recent assignments posted
    if (assignments) {
        assignments
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 2)
            .forEach(assignment => {
                activities.push({
                    type: 'announcement',
                    text: `New assignment: ${assignment.title}`,
                    time: assignment.created_at,
                    icon: 'fa-plus-circle'
                });
            });
    }

    // Sort by time and limit to 5
    activities.sort((a, b) => new Date(b.time) - new Date(a.time));
    const recentActivities = activities.slice(0, 5);

    if (recentActivities.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>No recent activity</p>
            </div>
        `;
        return;
    }

    container.innerHTML = recentActivities.map(activity => {
        const timeAgo = getTimeAgo(new Date(activity.time));
        return `
            <div class="activity-item">
                <div class="activity-icon ${activity.type}">
                    <i class="fas ${activity.icon}"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-text">${activity.text}</div>
                    <div class="activity-time">${timeAgo}</div>
                </div>
            </div>
        `;
    }).join('');
}

function loadActiveSubjects(enrollments, assignments, submissions) {
    const container = document.getElementById('subjectsContainer');
    
    if (!enrollments || enrollments.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-book-open"></i>
                <p>No subjects yet</p>
            </div>
        `;
        return;
    }

    const subjectsHtml = enrollments.slice(0, 4).map(enrollment => {
        const subject = enrollment.subject;
        const instructor = subject.instructor;
        const instructorName = `${instructor.first_name || ''} ${instructor.last_name || ''}`.trim() || instructor.username;

        // Count pending assignments for this subject
        const submittedIds = submissions ? submissions.map(s => s.post_id) : [];
        const subjectAssignments = assignments ? assignments.filter(a => a.subject_id === subject.id) : [];
        const pendingCount = subjectAssignments.filter(a => !submittedIds.includes(a.id)).length;

        return `
            <div class="subject-card-mini" onclick="viewSubject('${subject.id}')">
                <h4>${subject.subject_name}</h4>
                <div class="instructor">
                    <i class="fas fa-user-tie"></i> ${instructorName}
                </div>
                ${pendingCount > 0 ? `<span class="pending-count">${pendingCount} pending</span>` : '<span style="color: #4caf50; font-size: 0.875rem;"><i class="fas fa-check-circle"></i> All caught up</span>'}
            </div>
        `;
    }).join('');

    container.innerHTML = subjectsHtml;
}

function getTimeAgo(date) {
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function viewSubject(subjectId) {
    window.location.href = `/student_subject_view?id=${subjectId}`;
}

function viewAssignment(subjectId) {
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
    console.log('🚀 initializeSidebar called');
    
    const currentTab = document.querySelector('[data-page="dashboard"]');
    console.log('Current tab found:', currentTab);
    
    if (currentTab) {
        currentTab.classList.add('active');
    }

    const navTabs = document.querySelectorAll('.nav-tab');
    console.log('Nav tabs found:', navTabs.length);
    
    navTabs.forEach((tab, index) => {
        console.log(`Attaching listener to tab ${index}:`, tab.dataset.page);
        
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const page = tab.dataset.page;
            console.log('Clicked page:', page);
            
            if (page === 'logout') {
                console.log('Logout clicked, calling confirmLogout');
                confirmLogout();
                return;
            }
            window.location.href = `/student_${page}`;
        });
    });
}