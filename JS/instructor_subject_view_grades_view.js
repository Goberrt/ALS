
let gradesData = {
    students: [],
    assignments: [],
    submissions: {},
    currentView: 'overview'
};

/**
 * Main function to load grades view
 */
async function loadGradesView() {
    const container = document.getElementById('postsContainer');
    container.style.display = 'block';
    
    // Show loading state
    container.innerHTML = `
        <div class="grades-loading">
            <i class="fas fa-spinner fa-spin"></i>
            <span style="margin-left: 1rem;">Loading grades...</span>
        </div>
    `;
    
    try {
        // Load all necessary data
        await loadGradesData();
        
        // Render the grades view
        renderGradesView();
        
    } catch (error) {
        console.error('Error loading grades:', error);
        container.innerHTML = `
            <div class="grades-empty-state">
                <i class="fas fa-exclamation-circle"></i>
                <h3>Error Loading Grades</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}

/**
 * Load all grades data from database
 */
async function loadGradesData() {
    try {
        // Load enrolled students
        const { data: enrollments, error: enrollError } = await window.supabaseClient
            .from('subject_enrollments')
            .select(`
                student_id,
                student:student_id(id, username, first_name, last_name, email)
            `)
            .eq('subject_id', currentSubject.id)
            .eq('status', 'active');
        
        if (enrollError) throw enrollError;
        
        gradesData.students = enrollments.map(e => e.student);
        
        // Load all assignments
        const { data: assignments, error: assignError } = await window.supabaseClient
            .from('subject_posts')
            .select('*')
            .eq('subject_id', currentSubject.id)
            .eq('post_type', 'assignment')
            .order('due_date', { ascending: true });
        
        if (assignError) throw assignError;
        
        gradesData.assignments = assignments || [];
        
        // Load all submissions
        const { data: submissions, error: subError } = await window.supabaseClient
            .from('post_submissions')
            .select('*')
            .in('post_id', gradesData.assignments.map(a => a.id));
        
        if (subError) throw subError;
        
        // Organize submissions by student and assignment
        gradesData.submissions = {};
        if (submissions) {
            submissions.forEach(sub => {
                const key = `${sub.student_id}_${sub.post_id}`;
                gradesData.submissions[key] = sub;
            });
        }
        
    } catch (error) {
        console.error('Error loading grades data:', error);
        throw error;
    }
}

/**
 * Render the main grades view
 */
function renderGradesView() {
    const container = document.getElementById('postsContainer');
    
    if (gradesData.students.length === 0 || gradesData.assignments.length === 0) {
        container.innerHTML = `
            <div class="grades-empty-state">
                <i class="fas fa-chart-bar"></i>
                <h3>No Grades Yet</h3>
                <p>${gradesData.students.length === 0 ? 'No students enrolled' : 'No assignments created'}</p>
            </div>
        `;
        return;
    }
    
    const stats = calculateGradesStatistics();
    
    container.innerHTML = `
        <div class="grades-container">
            <div class="grades-header">
                <div>
                    <h2><i class="fas fa-chart-bar"></i> Grades</h2>
                </div>
                
                <div class="grades-view-switcher">
                    <button class="view-switch-btn ${gradesData.currentView === 'overview' ? 'active' : ''}" 
                            onclick="switchGradesView('overview')">
                        <i class="fas fa-th"></i> Overview
                    </button>
                    <button class="view-switch-btn ${gradesData.currentView === 'students' ? 'active' : ''}" 
                            onclick="switchGradesView('students')">
                        <i class="fas fa-users"></i> By Student
                    </button>
                    <button class="view-switch-btn ${gradesData.currentView === 'assignments' ? 'active' : ''}" 
                            onclick="switchGradesView('assignments')">
                        <i class="fas fa-tasks"></i> By Assignment
                    </button>
                </div>
                
                <div class="grades-actions">
                    <div class="export-menu">
                        <button class="grade-action-btn secondary" onclick="toggleExportMenu(event)">
                            <i class="fas fa-download"></i> Export
                            <i class="fas fa-chevron-down" style="font-size: 0.75rem;"></i>
                        </button>
                        <div class="export-dropdown" id="exportDropdown">
                            <button onclick="exportGradesCSV()">
                                <i class="fas fa-file-csv"></i> Export as CSV
                            </button>
                            <button onclick="exportGradesExcel()">
                                <i class="fas fa-file-excel"></i> Export as Excel
                            </button>
                            <button onclick="printGrades()">
                                <i class="fas fa-print"></i> Print Grades
                            </button>
                        </div>
                    </div>
                    <button class="grade-action-btn primary" onclick="refreshGrades()">
                        <i class="fas fa-sync-alt"></i> Refresh
                    </button>
                </div>
            </div>
            
            <div class="grades-stats">
                <div class="grade-stat-card">
                    <div class="grade-stat-icon">
                        <i class="fas fa-users"></i>
                    </div>
                    <div class="grade-stat-info">
                        <div class="grade-stat-value">${stats.totalStudents}</div>
                        <div class="grade-stat-label">Students</div>
                    </div>
                </div>
                <div class="grade-stat-card">
                    <div class="grade-stat-icon">
                        <i class="fas fa-tasks"></i>
                    </div>
                    <div class="grade-stat-info">
                        <div class="grade-stat-value">${stats.totalAssignments}</div>
                        <div class="grade-stat-label">Assignments</div>
                    </div>
                </div>
                <div class="grade-stat-card">
                    <div class="grade-stat-icon">
                        <i class="fas fa-star"></i>
                    </div>
                    <div class="grade-stat-info">
                        <div class="grade-stat-value">${stats.classAverage.toFixed(1)}%</div>
                        <div class="grade-stat-label">Class Average</div>
                    </div>
                </div>
                <div class="grade-stat-card">
                    <div class="grade-stat-icon">
                        <i class="fas fa-check-circle"></i>
                    </div>
                    <div class="grade-stat-info">
                        <div class="grade-stat-value">${stats.completionRate.toFixed(0)}%</div>
                        <div class="grade-stat-label">Completion Rate</div>
                    </div>
                </div>
            </div>
            
            <div id="gradesContent"></div>
        </div>
    `;
    
    // Render the appropriate view
    renderGradesContent();
}

/**
 * Calculate statistics for grades
 */
function calculateGradesStatistics() {
    const totalStudents = gradesData.students.length;
    const totalAssignments = gradesData.assignments.length;
    
    let totalGrades = 0;
    let gradeCount = 0;
    let totalSubmissions = 0;
    let possibleSubmissions = totalStudents * totalAssignments;
    
    Object.values(gradesData.submissions).forEach(sub => {
        totalSubmissions++;
        if (sub.grade !== null) {
            const assignment = gradesData.assignments.find(a => a.id === sub.post_id);
            const maxPoints = assignment?.points || 100;
            const percentage = (sub.grade / maxPoints) * 100;
            totalGrades += percentage;
            gradeCount++;
        }
    });
    
    return {
        totalStudents,
        totalAssignments,
        classAverage: gradeCount > 0 ? totalGrades / gradeCount : 0,
        completionRate: possibleSubmissions > 0 ? (totalSubmissions / possibleSubmissions) * 100 : 0
    };
}

/**
 * Switch between different grade views
 */
function switchGradesView(view) {
    gradesData.currentView = view;
    
    // Update active button
    document.querySelectorAll('.view-switch-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.closest('.view-switch-btn').classList.add('active');
    
    renderGradesContent();
}

/**
 * Render the content based on current view
 */
function renderGradesContent() {
    const content = document.getElementById('gradesContent');
    
    switch (gradesData.currentView) {
        case 'overview':
            content.innerHTML = renderOverviewView();
            break;
        case 'students':
            content.innerHTML = renderStudentsView();
            break;
        case 'assignments':
            content.innerHTML = renderAssignmentsView();
            break;
    }
}

/**
 * Render the overview (gradebook table) view
 */
function renderOverviewView() {
    let html = `
        <div class="grades-filters">
            <div class="filter-group">
                <label>Search Student</label>
                <input type="text" placeholder="Search by name..." oninput="filterGradebook(this.value)">
            </div>
            <div class="filter-group">
                <label>Grade Range</label>
                <select onchange="filterByGrade(this.value)">
                    <option value="all">All Grades</option>
                    <option value="90-100">A (90-100)</option>
                    <option value="80-89">B (80-89)</option>
                    <option value="70-79">C (70-79)</option>
                    <option value="60-69">D (60-69)</option>
                    <option value="0-59">F (Below 60)</option>
                </select>
            </div>
            <div class="filter-group">
                <label>Show</label>
                <select onchange="filterByStatus(this.value)">
                    <option value="all">All Students</option>
                    <option value="complete">Complete</option>
                    <option value="incomplete">Incomplete</option>
                </select>
            </div>
        </div>
        
        <div class="gradebook-container">
            <table class="gradebook-table">
                <thead>
                    <tr>
                        <th class="student-col sortable" onclick="sortGradebook('student')">
                            Student <i class="fas fa-sort sort-icon"></i>
                        </th>
                        ${gradesData.assignments.map(assignment => `
                            <th class="sortable" onclick="sortGradebook('${assignment.id}')" 
                                title="${assignment.title} (${assignment.points} pts)">
                                ${truncate(assignment.title, 15)}
                                <br>
                                <small>${assignment.points}pts</small>
                                <i class="fas fa-sort sort-icon"></i>
                            </th>
                        `).join('')}
                        <th class="sortable" onclick="sortGradebook('average')">
                            Average <i class="fas fa-sort sort-icon"></i>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    ${gradesData.students.map(student => {
                        const studentGrades = calculateStudentGrades(student.id);
                        return `
                            <tr data-student-id="${student.id}">
                                <td class="student-col">
                                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                                        <div style="width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #667eea, #764ba2); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 0.875rem;">
                                            ${getInitials(student)}
                                        </div>
                                        <div>
                                            <div style="font-weight: 500;">${getStudentName(student)}</div>
                                            <div style="font-size: 0.75rem; color: #999;">${student.email || student.username}</div>
                                        </div>
                                    </div>
                                </td>
                                ${gradesData.assignments.map(assignment => {
                                    const key = `${student.id}_${assignment.id}`;
                                    const submission = gradesData.submissions[key];
                                    return `<td>${renderGradeCell(submission, assignment)}</td>`;
                                }).join('')}
                                <td>
                                    <div class="grade-cell ${getGradeClass(studentGrades.average)}" 
                                         style="font-size: 1rem; padding: 0.5rem;">
                                        ${studentGrades.average !== null ? studentGrades.average.toFixed(1) + '%' : '-'}
                                    </div>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    return html;
}

/**
 * Render individual grade cell
 */
function renderGradeCell(submission, assignment) {
    if (!submission) {
        return `<span class="grade-cell not-submitted" title="Not submitted">-</span>`;
    }
    
    if (submission.grade === null) {
        return `
            <span class="grade-cell missing" onclick="gradeSubmission('${submission.id}')" 
                  title="Click to grade" style="cursor: pointer;">
                Pending
            </span>
        `;
    }
    
    const maxPoints = assignment.points || 100;
    const percentage = (submission.grade / maxPoints) * 100;
    const gradeClass = getGradeClass(percentage);
    
    return `
        <span class="grade-cell ${gradeClass}" onclick="gradeSubmission('${submission.id}')" 
              title="${submission.grade}/${maxPoints} (${percentage.toFixed(1)}%)\nClick to edit">
            ${submission.grade}/${maxPoints}
            <br>
            <small>${percentage.toFixed(0)}%</small>
        </span>
    `;
}

/**
 * Get CSS class based on grade - pass/fail only
 * 75 and above = pass, below 75 = fail
 */
function getGradeClass(percentage) {
    if (percentage === null) return 'missing';
    if (percentage >= 75) return 'pass';
    return 'fail';
}

/**
 * Calculate student's grades
 */
function calculateStudentGrades(studentId) {
    let totalPoints = 0;
    let earnedPoints = 0;
    let gradedCount = 0;
    
    gradesData.assignments.forEach(assignment => {
        const key = `${studentId}_${assignment.id}`;
        const submission = gradesData.submissions[key];
        
        if (submission && submission.grade !== null) {
            totalPoints += (assignment.points || 100);
            earnedPoints += parseFloat(submission.grade);
            gradedCount++;
        }
    });
    
    return {
        average: gradedCount > 0 ? (earnedPoints / totalPoints) * 100 : null,
        gradedCount,
        totalAssignments: gradesData.assignments.length
    };
}

/**
 * Render students view
 */
function renderStudentsView() {
    return `
        <div class="student-grades-list">
            ${gradesData.students.map(student => {
                const studentGrades = calculateStudentGrades(student.id);
                const initial = getInitials(student);
                const name = getStudentName(student);
                
                return `
                    <div class="student-grade-card">
                        <div class="student-grade-header">
                            <div class="student-name-section">
                                <div class="student-grade-avatar">${initial}</div>
                                <div>
                                    <h3 style="margin: 0; font-size: 1.125rem;">${name}</h3>
                                    <p style="margin: 0; color: #999; font-size: 0.875rem;">${student.email || student.username}</p>
                                </div>
                            </div>
                            <div class="student-grade-stats">
                                <div style="text-align: center;">
                                    <div style="font-size: 1.5rem; font-weight: 700; color: #667eea;">
                                        ${studentGrades.average !== null ? studentGrades.average.toFixed(1) + '%' : 'N/A'}
                                    </div>
                                    <div style="font-size: 0.75rem; color: #666;">Average</div>
                                </div>
                                <div style="text-align: center;">
                                    <div style="font-size: 1.5rem; font-weight: 700; color: #4caf50;">
                                        ${studentGrades.gradedCount}
                                    </div>
                                    <div style="font-size: 0.75rem; color: #666;">Graded</div>
                                </div>
                                <div style="text-align: center;">
                                    <div style="font-size: 1.5rem; font-weight: 700; color: #999;">
                                        ${studentGrades.totalAssignments}
                                    </div>
                                    <div style="font-size: 0.75rem; color: #666;">Total</div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="grade-assignments-grid">
                            ${gradesData.assignments.map(assignment => {
                                const key = `${student.id}_${assignment.id}`;
                                const submission = gradesData.submissions[key];
                                const maxPoints = assignment.points || 100;
                                
                                let gradeDisplay = 'Not Submitted';
                                let gradeValue = '-';
                                let statusColor = '#999';
                                
                                if (submission) {
                                    if (submission.grade !== null) {
                                        const percentage = (submission.grade / maxPoints) * 100;
                                        gradeValue = `${submission.grade}/${maxPoints}`;
                                        gradeDisplay = `${percentage.toFixed(1)}%`;
                                        statusColor = '#667eea';
                                    } else {
                                        gradeDisplay = 'Pending Grade';
                                        gradeValue = 'Submitted';
                                        statusColor = '#ff9800';
                                    }
                                }
                                
                                return `
                                    <div class="assignment-grade-item">
                                        <h4>${assignment.title}</h4>
                                        <div class="assignment-grade-value" style="color: ${statusColor};">
                                            ${gradeValue}
                                        </div>
                                        <div class="assignment-grade-details">
                                            <span>${gradeDisplay}</span>
                                            <span>Max: ${maxPoints} pts</span>
                                            ${submission ? `
                                                <button onclick="gradeSubmission('${submission.id}')" 
                                                        style="margin-top: 0.5rem; padding: 0.25rem 0.5rem; background: #667eea; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.75rem;">
                                                    ${submission.grade !== null ? 'Edit Grade' : 'Grade Now'}
                                                </button>
                                            ` : ''}
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

/**
 * Render assignments view
 */
function renderAssignmentsView() {
    return `
        <div class="assignment-grades-list">
            ${gradesData.assignments.map(assignment => {
                const stats = calculateAssignmentStatistics(assignment.id);
                
                return `
                    <div class="assignment-grade-card">
                        <div class="assignment-grade-header">
                            <div class="assignment-info">
                                <h3>${assignment.title}</h3>
                                <div class="assignment-meta">
                                    <span><i class="fas fa-star"></i> ${assignment.points || 100} points</span>
                                    ${assignment.due_date ? `
                                        <span><i class="fas fa-calendar"></i> Due: ${new Date(assignment.due_date).toLocaleDateString()}</span>
                                    ` : ''}
                                </div>
                            </div>
                            <div class="assignment-stats-summary">
                                <div class="assignment-stat-box">
                                    <span class="value">${stats.submitted}</span>
                                    <span class="label">Submitted</span>
                                </div>
                                <div class="assignment-stat-box">
                                    <span class="value">${stats.graded}</span>
                                    <span class="label">Graded</span>
                                </div>
                                <div class="assignment-stat-box">
                                    <span class="value">${stats.average.toFixed(1)}%</span>
                                    <span class="label">Average</span>
                                </div>
                                <div class="assignment-stat-box">
                                    <span class="value">${stats.missing}</span>
                                    <span class="label">Missing</span>
                                </div>
                            </div>
                        </div>
                        
                        ${renderGradeDistribution(assignment.id)}
                        
                        <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                            <button class="grade-action-btn primary" onclick="viewAssignmentSubmissions('${assignment.id}')">
                                <i class="fas fa-eye"></i> View Submissions
                            </button>
                            <button class="grade-action-btn secondary" onclick="exportAssignmentGrades('${assignment.id}')">
                                <i class="fas fa-download"></i> Export
                            </button>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

/**
 * Calculate assignment statistics
 */
function calculateAssignmentStatistics(assignmentId) {
    const assignment = gradesData.assignments.find(a => a.id === assignmentId);
    const maxPoints = assignment?.points || 100;
    
    let submitted = 0;
    let graded = 0;
    let totalGrade = 0;
    
    gradesData.students.forEach(student => {
        const key = `${student.id}_${assignmentId}`;
        const submission = gradesData.submissions[key];
        
        if (submission) {
            submitted++;
            if (submission.grade !== null) {
                graded++;
                totalGrade += (submission.grade / maxPoints) * 100;
            }
        }
    });
    
    return {
        submitted,
        graded,
        missing: gradesData.students.length - submitted,
        average: graded > 0 ? totalGrade / graded : 0
    };
}

/**
 * Render grade distribution chart
 */
function renderGradeDistribution(assignmentId) {
    const assignment = gradesData.assignments.find(a => a.id === assignmentId);
    const maxPoints = assignment?.points || 100;
    
    const ranges = {
        'A (90-100)': 0,
        'B (80-89)': 0,
        'C (70-79)': 0,
        'D (60-69)': 0,
        'F (Below 60)': 0
    };
    
    let total = 0;
    
    gradesData.students.forEach(student => {
        const key = `${student.id}_${assignmentId}`;
        const submission = gradesData.submissions[key];
        
        if (submission && submission.grade !== null) {
            const percentage = (submission.grade / maxPoints) * 100;
            total++;
            
            if (percentage >= 90) ranges['A (90-100)']++;
            else if (percentage >= 80) ranges['B (80-89)']++;
            else if (percentage >= 70) ranges['C (70-79)']++;
            else if (percentage >= 60) ranges['D (60-69)']++;
            else ranges['F (Below 60)']++;
        }
    });
    
    return `
        <div class="grade-distribution-chart">
            <h4><i class="fas fa-chart-bar"></i> Grade Distribution</h4>
            ${Object.entries(ranges).map(([label, count]) => {
                const percentage = total > 0 ? (count / total) * 100 : 0;
                return `
                    <div class="distribution-bar">
                        <div class="distribution-label">${label}</div>
                        <div class="distribution-track">
                            <div class="distribution-fill" style="width: ${percentage}%">
                                ${count > 0 ? `${percentage.toFixed(0)}%` : ''}
                            </div>
                        </div>
                        <div class="distribution-count">${count}</div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// ==================== UTILITY FUNCTIONS ====================

function getStudentName(student) {
    return `${student.first_name || ''} ${student.last_name || ''}`.trim() || student.username;
}

function getInitials(student) {
    if (student.first_name && student.last_name) {
        return `${student.first_name.charAt(0)}${student.last_name.charAt(0)}`.toUpperCase();
    }
    return student.username.substring(0, 2).toUpperCase();
}

function truncate(text, length) {
    return text.length > length ? text.substring(0, length) + '...' : text;
}

// ==================== EXPORT FUNCTIONS ====================

function toggleExportMenu(event) {
    event.stopPropagation();
    const dropdown = document.getElementById('exportDropdown');
    dropdown.classList.toggle('show');
    
    // Close when clicking outside
    document.addEventListener('click', function closeMenu(e) {
        if (!e.target.closest('.export-menu')) {
            dropdown.classList.remove('show');
            document.removeEventListener('click', closeMenu);
        }
    });
}

async function exportGradesCSV() {
    let csv = 'Student Name,Email';
    
    // Add assignment headers
    gradesData.assignments.forEach(assignment => {
        csv += `,${assignment.title} (${assignment.points}pts)`;
    });
    csv += ',Average\n';
    
    // Add student data
    gradesData.students.forEach(student => {
        const name = getStudentName(student);
        const email = student.email || student.username;
        csv += `"${name}","${email}"`;
        
        let totalPoints = 0;
        let earnedPoints = 0;
        let gradedCount = 0;
        
        gradesData.assignments.forEach(assignment => {
            const key = `${student.id}_${assignment.id}`;
            const submission = gradesData.submissions[key];
            
            if (submission && submission.grade !== null) {
                csv += `,${submission.grade}`;
                totalPoints += (assignment.points || 100);
                earnedPoints += parseFloat(submission.grade);
                gradedCount++;
            } else if (submission) {
                csv += ',Pending';
            } else {
                csv += ',Not Submitted';
            }
        });
        
        const average = gradedCount > 0 ? ((earnedPoints / totalPoints) * 100).toFixed(1) : 'N/A';
        csv += `,${average}\n`;
    });
    
    // Download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentSubject.subject_name}_grades.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    // Close dropdown
    document.getElementById('exportDropdown').classList.remove('show');
}

function exportGradesExcel() {
    alert('Excel export feature coming soon!\nFor now, please use CSV export.');
    document.getElementById('exportDropdown').classList.remove('show');
}

function printGrades() {
    window.print();
    document.getElementById('exportDropdown').classList.remove('show');
}

async function refreshGrades() {
    const btn = event.target.closest('.grade-action-btn');
    const originalHTML = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
    btn.disabled = true;
    
    try {
        await loadGradesData();
        renderGradesContent();
    } catch (error) {
        alert('Failed to refresh grades: ' + error.message);
    } finally {
        btn.innerHTML = originalHTML;
        btn.disabled = false;
    }
}

// Make functions globally accessible
window.loadGradesView = loadGradesView;
window.switchGradesView = switchGradesView;
window.toggleExportMenu = toggleExportMenu;
window.exportGradesCSV = exportGradesCSV;
window.exportGradesExcel = exportGradesExcel;
window.printGrades = printGrades;
window.refreshGrades = refreshGrades;
window.filterGradebook = function(query) {
    // Implement search functionality
    console.log('Filtering gradebook:', query);
};
window.filterByGrade = function(range) {
    console.log('Filtering by grade range:', range);
    
    const rows = document.querySelectorAll('.gradebook-table tbody tr');
    
    rows.forEach(row => {
        if (range === 'all') {
            row.style.display = '';
            return;
        }
        
        const studentId = row.dataset.studentId;
        const studentGrades = calculateStudentGrades(studentId);
        const average = studentGrades.average;
        
        if (average === null) {
            row.style.display = 'none';
            return;
        }
        
        const [min, max] = range.split('-').map(Number);
        
        if (average >= min && average <= max) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
};

window.filterByStatus = function(status) {
    console.log('Filtering by status:', status);
    
    const rows = document.querySelectorAll('.gradebook-table tbody tr');
    
    rows.forEach(row => {
        if (status === 'all') {
            row.style.display = '';
            return;
        }
        
        const studentId = row.dataset.studentId;
        const studentGrades = calculateStudentGrades(studentId);
        
        if (status === 'complete') {
            // Show only students who have submitted all assignments
            if (studentGrades.gradedCount === studentGrades.totalAssignments) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        } else if (status === 'incomplete') {
            // Show only students with missing assignments
            if (studentGrades.gradedCount < studentGrades.totalAssignments) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        }
    });
};

window.sortGradebook = function(column) {
    console.log('Sorting by:', column);
    
    const tbody = document.querySelector('.gradebook-table tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));
    
    // Determine sort direction
    const th = event.target.closest('th');
    const currentSort = th.dataset.sort || 'none';
    const newSort = currentSort === 'asc' ? 'desc' : 'asc';
    
    // Clear all sort indicators
    document.querySelectorAll('.gradebook-table th').forEach(header => {
        header.dataset.sort = 'none';
        header.classList.remove('sorted');
    });
    
    // Set new sort
    th.dataset.sort = newSort;
    th.classList.add('sorted');
    
    // Sort rows
    rows.sort((a, b) => {
        let aValue, bValue;
        
        if (column === 'student') {
            aValue = a.querySelector('.student-col').textContent.trim();
            bValue = b.querySelector('.student-col').textContent.trim();
            return newSort === 'asc' 
                ? aValue.localeCompare(bValue) 
                : bValue.localeCompare(aValue);
        } else if (column === 'average') {
            const aGrades = calculateStudentGrades(a.dataset.studentId);
            const bGrades = calculateStudentGrades(b.dataset.studentId);
            aValue = aGrades.average || 0;
            bValue = bGrades.average || 0;
        } else {
            // Sorting by specific assignment
            const aKey = `${a.dataset.studentId}_${column}`;
            const bKey = `${b.dataset.studentId}_${column}`;
            const aSub = gradesData.submissions[aKey];
            const bSub = gradesData.submissions[bKey];
            
            aValue = aSub?.grade || 0;
            bValue = bSub?.grade || 0;
        }
        
        return newSort === 'asc' ? aValue - bValue : bValue - aValue;
    });
    
    // Reorder DOM
    rows.forEach(row => tbody.appendChild(row));
};

window.exportAssignmentGrades = async function(assignmentId) {
    const assignment = gradesData.assignments.find(a => a.id === assignmentId);
    
    let csv = 'Student Name,Email,Grade,Percentage,Status,Submitted At\n';
    
    gradesData.students.forEach(student => {
        const key = `${student.id}_${assignmentId}`;
        const submission = gradesData.submissions[key];
        const name = getStudentName(student);
        const email = student.email || student.username;
        
        let grade = 'Not Submitted';
        let percentage = '0';
        let status = 'Missing';
        let submittedAt = '';
        
        if (submission) {
            if (submission.grade !== null) {
                grade = submission.grade;
                const maxPoints = assignment.points || 100;
                percentage = ((submission.grade / maxPoints) * 100).toFixed(1);
                status = 'Graded';
            } else {
                grade = 'Pending';
                percentage = 'N/A';
                status = 'Submitted';
            }
            submittedAt = new Date(submission.submitted_at).toLocaleString();
        }
        
        csv += `"${name}","${email}","${grade}","${percentage}%","${status}","${submittedAt}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${assignment.title}_grades.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
};

