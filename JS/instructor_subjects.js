if (!window.supabaseClient) {
    window.supabaseClient = window.supabase.createClient(
        'https://bbinymljjtjxkeclqamt.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiaW55bWxqanRqeGtlY2xxYW10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MzQ1OTQsImV4cCI6MjA3MjMxMDU5NH0.bOIwdxUiLd-63V6-_XZxER1PLqohtd1cnwipF6YZjn4'
    );
}

// Modal functions
function openSubjectsModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeSubjectsModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Authentication check
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    if (!user || !user.username) {
        window.location.href = '/';
        return;
    }

    document.getElementById('instructorName').textContent = `Welcome, ${user.username}`;

    // Mobile menu toggle functionality
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.querySelector('.sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    
    if (menuToggle) {
        menuToggle.addEventListener('click', function() {
            sidebar.classList.toggle('active');
            sidebarOverlay.classList.toggle('active');
        });
    }
    
    // Close sidebar when clicking overlay
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', function() {
            sidebar.classList.remove('active');
            sidebarOverlay.classList.remove('active');
        });
    }
    
    // Close sidebar when clicking a nav item on mobile
    const navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('active');
                sidebarOverlay.classList.remove('active');
            }
        });
    });

    // Navigation
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

    // Modal overlay close handlers
    ['allSubjectsModal', 'activeSubjectsModal', 'completedSubjectsModal', 'draftSubjectsModal'].forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) {
            const overlay = modal.querySelector('.modal-overlay');
            if (overlay) {
                overlay.addEventListener('click', () => closeSubjectsModal(modalId));
            }
        }
    });

    // Modal functionality for Create Subject
    const createBtn = document.getElementById('createSubjectBtn');
    
    // Check if we need to create a modal for subject creation
    // For now, we'll create a simple form overlay
    if (createBtn) {
        createBtn.onclick = () => {
            const subjectName = prompt('Enter subject name:');
            if (!subjectName) return;
            
            const subjectCode = prompt('Enter subject code:');
            if (!subjectCode) return;
            
            const description = prompt('Enter description (optional):');
            
            createSubject({
                subject_name: subjectName,
                subject_code: subjectCode,
                description: description || ''
            });
        };
    }

    // Load subjects on page load
    loadSubjects();
});

async function createSubject(subjectData) {
    const user = JSON.parse(localStorage.getItem('user'));
    const { data, error } = await window.supabaseClient
        .from('subjects')
        .insert([{
            ...subjectData,
            instructor_id: user.id
        }]);

    if (error) {
        alert('Failed to create subject: ' + error.message);
        return;
    }

    alert('Subject created successfully!');
    loadSubjects();
}

async function loadSubjects() {
    const user = JSON.parse(localStorage.getItem('user'));
    const { data: subjects, error } = await window.supabaseClient
        .from('subjects')
        .select('*')
        .eq('instructor_id', user.id);

    if (error || !subjects) {
        console.error('Error loading subjects:', error);
        return;
    }

    // Fetch all assignments (not past due)
    const { data: allAssignments, error: assignmentsError } = await window.supabaseClient
        .from('subject_posts')
        .select('*')
        .eq('instructor_id', user.id)
        .eq('post_type', 'Assignment')
        .gt('due_date', new Date().toISOString())
        .order('due_date', { ascending: true });

    if (assignmentsError) {
        console.error('Error loading assignments:', assignmentsError);
    }

    // Update stats
    const totalSubjectsEl = document.getElementById('totalSubjects');
    if (totalSubjectsEl) totalSubjectsEl.textContent = subjects.length;
    
    const allSubjectsBadgeEl = document.getElementById('allSubjectsBadge');
    if (allSubjectsBadgeEl) allSubjectsBadgeEl.textContent = subjects.length;
    
    // Count active classes (subjects with no status or status='active')
    const activeCount = subjects.filter(s => !s.status || s.status === 'active').length;
    const completedCount = subjects.filter(s => s.status === 'completed').length;
    const draftCount = subjects.filter(s => s.status === 'draft').length;
    
    // Calculate total assignments (upcoming only)
    const totalAssignments = allAssignments ? allAssignments.length : 0;
    
    // Calculate average completion from subject progress
    let totalCompletion = 0;
    let countWithCompletion = 0;
    subjects.forEach(s => {
        if (s.completion_percentage) {
            totalCompletion += s.completion_percentage;
            countWithCompletion++;
        }
    });
    const avgCompletion = countWithCompletion > 0 ? Math.round(totalCompletion / countWithCompletion) : 0;
    
    const activeClassesEl = document.getElementById('activeClasses');
    if (activeClassesEl) activeClassesEl.textContent = activeCount;
    
    const totalAssignmentsEl = document.getElementById('totalAssignments');
    if (totalAssignmentsEl) totalAssignmentsEl.textContent = totalAssignments;
    
    const avgCompletionEl = document.getElementById('avgCompletion');
    if (avgCompletionEl) avgCompletionEl.textContent = avgCompletion + '%';
    
    const activeSubjectsBadgeEl = document.getElementById('activeSubjectsBadge');
    if (activeSubjectsBadgeEl) activeSubjectsBadgeEl.textContent = activeCount;
    
    const completedSubjectsBadgeEl = document.getElementById('completedSubjectsBadge');
    if (completedSubjectsBadgeEl) completedSubjectsBadgeEl.textContent = completedCount;
    
    const draftSubjectsBadgeEl = document.getElementById('draftSubjectsBadge');
    if (draftSubjectsBadgeEl) draftSubjectsBadgeEl.textContent = draftCount;

    // Create table HTML for modals
    const createSubjectTable = (subjectList) => {
        if (!subjectList || subjectList.length === 0) {
            return '<div style="padding: 20px; text-align: center; color: #999;">No subjects found</div>';
        }
        
        return `
            <table style="width: 100%; border-collapse: collapse;">
                <thead style="background: #f5f5f5;">
                    <tr>
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Name</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Code</th>
                        <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd;">Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${subjectList.map(subject => `
                        <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 12px;">${subject.subject_name || 'N/A'}</td>
                            <td style="padding: 12px;">${subject.subject_code || 'N/A'}</td>
                            <td style="padding: 12px; text-align: center;">
                                <span style="padding: 4px 12px; border-radius: 12px; font-size: 12px; background: #e8f5e9; color: #27ae60;">
                                    ${subject.status || 'active'}
                                </span>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    };

    // Populate modals
    const allSubjectsBodyEl = document.getElementById('allSubjectsBody');
    if (allSubjectsBodyEl) allSubjectsBodyEl.innerHTML = createSubjectTable(subjects);
    
    const activeSubjectsBodyEl = document.getElementById('activeSubjectsBody');
    if (activeSubjectsBodyEl) activeSubjectsBodyEl.innerHTML = createSubjectTable(
        subjects.filter(s => s.status === 'active' || !s.status)
    );
    
    const completedSubjectsBodyEl = document.getElementById('completedSubjectsBody');
    if (completedSubjectsBodyEl) completedSubjectsBodyEl.innerHTML = createSubjectTable(
        subjects.filter(s => s.status === 'completed')
    );
    
    const draftSubjectsBodyEl = document.getElementById('draftSubjectsBody');
    if (draftSubjectsBodyEl) draftSubjectsBodyEl.innerHTML = createSubjectTable(
        subjects.filter(s => s.status === 'draft')
    );

    // Create assignments table
    const createAssignmentsTable = (assignmentsList) => {
        if (!assignmentsList || assignmentsList.length === 0) {
            return '<div style="padding: 20px; text-align: center; color: #999;">No upcoming assignments</div>';
        }
        
        return `
            <table style="width: 100%; border-collapse: collapse;">
                <thead style="background: #f5f5f5;">
                    <tr>
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Title</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Subject</th>
                        <th style="padding: 12px; text-align: left; border-bottom: 2px solid #ddd;">Due Date</th>
                        <th style="padding: 12px; text-align: center; border-bottom: 2px solid #ddd;">Points</th>
                    </tr>
                </thead>
                <tbody>
                    ${assignmentsList.map(assignment => {
                        const dueDate = assignment.due_date ? new Date(assignment.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
                        const subjectName = subjects.find(s => s.id === assignment.subject_id)?.subject_name || 'Unknown';
                        return `
                            <tr style="border-bottom: 1px solid #eee;">
                                <td style="padding: 12px;">${assignment.title || 'N/A'}</td>
                                <td style="padding: 12px;">${subjectName}</td>
                                <td style="padding: 12px;">${dueDate}</td>
                                <td style="padding: 12px; text-align: center;">${assignment.points || '-'}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    };

    // Populate assignments modal
    const assignmentsBodyEl = document.getElementById('assignmentsBody');
    if (assignmentsBodyEl) assignmentsBodyEl.innerHTML = createAssignmentsTable(allAssignments);

    // Also show in main grid
    const container = document.getElementById('subjectsContainer');
    const emptyState = document.getElementById('emptyState');

    if (!subjects || subjects.length === 0) {
        if (container) container.style.display = 'none';
        if (emptyState) emptyState.style.display = 'block';
        return;
    }

    if (container) container.style.display = 'grid';
    if (emptyState) emptyState.style.display = 'none';

    if (container) {
        container.innerHTML = subjects.map(subject => `
            <div class="subject-card" onclick="window.location.href='/instructor_subject_view?id=${subject.id}'">
                <div class="subject-header">
                    <div class="subject-code">${subject.subject_code}</div>
                    <h3 class="subject-name">${subject.subject_name}</h3>
                    <div class="subject-menu">
                        <button class="menu-btn" onclick="event.stopPropagation(); showSubjectMenu('${subject.id}')">
                            <i class="fas fa-ellipsis-v"></i>
                        </button>
                    </div>
                </div>
                <div class="subject-body">
                    <p class="subject-description">${subject.description || 'No description provided'}</p>
                    <div class="subject-stats">
                        <div class="stat-item">
                            <i class="fas fa-users"></i>
                            <span>${subject.student_count || 0} students</span>
                        </div>
                        <div class="stat-item">
                            <i class="fas fa-file-alt"></i>
                            <span>${subject.post_count || 0} posts</span>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }
}

window.showSubjectMenu = (subjectId) => {
    // Implement menu functionality (edit, delete, etc.)
    console.log('Show menu for subject:', subjectId);
};