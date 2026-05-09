
function confirmLogout() {
    if (confirm('Are you sure you want to logout?')) {
        localStorage.removeItem('user');
        window.location.href = '/';
    }
    return false;
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    
    const intervals = {
        year: 31536000,
        month: 2592000,
        week: 604800,
        day: 86400,
        hour: 3600,
        minute: 60
    };
    
    for (const [unit, secondsInUnit] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / secondsInUnit);
        if (interval >= 1) {
            return `${interval} ${unit}${interval === 1 ? '' : 's'} ago`;
        }
    }
    
    return 'Just now';
}

async function loadDashboardData() {
    try {
        console.log('Loading dashboard data...');
        
        const statsRes = await fetch('/api/dashboard/stats');
        const stats = await statsRes.json();
        console.log('Dashboard stats:', stats);
        
        updateUserAnalytics(stats);
        
        const growthRes = await fetch('/api/dashboard/user-growth');
        const growthData = await growthRes.json();
        renderUserGrowthChart(growthData);
        
        updateEnrollmentMetrics(stats);
        updatePlatformStats(stats);
        
        // Fetch real enrollment growth data
        const enrollmentGrowthRes = await fetch('/api/dashboard/enrollment-growth');
        const enrollmentGrowthData = await enrollmentGrowthRes.json();
        renderEnrollmentTrendChart(enrollmentGrowthData);
        
        await renderTopInstructors();
        await renderTopStudents();
        await updateSystemAlerts();
        await updateRecentActivities();

    } catch (error) {
        console.error('Error loading dashboard data:', error);
        alert('Failed to load dashboard data. Please refresh the page.');
    }
}

function updateUserAnalytics(stats) {
    const { user_analytics } = stats;
    
    document.getElementById('totalUsers').textContent = user_analytics.total_users;
    document.getElementById('totalStudents').textContent = user_analytics.total_students;
    document.getElementById('totalInstructors').textContent = user_analytics.total_instructors;
    
    document.getElementById('userBreakdown').textContent = 
        `${user_analytics.total_students} students, ${user_analytics.total_instructors} instructors, ${user_analytics.total_admins} admin${user_analytics.total_admins !== 1 ? 's' : ''}`;
    document.getElementById('studentPercentage').textContent = 
        `${user_analytics.student_percentage.toFixed(1)}% of total users`;
    document.getElementById('adminCount').textContent = 
        `${user_analytics.total_admins} administrator`;

    document.getElementById('newThisMonth').textContent = user_analytics.new_this_month;
    document.getElementById('newBreakdown').textContent = 
        `${user_analytics.new_this_week} this week, ${user_analytics.new_today} today`;
    
    const growthPercent = user_analytics.growth_percent.toFixed(0);
    const isPositive = growthPercent >= 0;
    document.getElementById('growthTrend').innerHTML = `
        <i class="fas fa-arrow-${isPositive ? 'up' : 'down'}"></i>
        <span>${Math.abs(growthPercent)}% from last month</span>
    `;
    document.getElementById('growthTrend').style.color = isPositive ? '#27ae60' : '#e74c3c';
}

function renderUserGrowthChart(growthData) {
    if (!growthData || growthData.length === 0) {
        document.getElementById('userGrowthChart').innerHTML = '<div class="loading">No data available</div>';
        return;
    }
    
    const maxCount = Math.max(...growthData.map(d => d.count), 1);
    
    const chartHTML = growthData.map(data => {
        // Calculate percentage height (max value = 100%)
        let heightPercent = (data.count / maxCount) * 100;
        // Ensure even 0 values show a tiny bar (2% minimum for visibility)
        if (heightPercent === 0) heightPercent = 2;
        
        return `
        <div class="chart-bar">
            <div class="bar-fill" 
                 style="height: ${heightPercent}%"
                 title="${data.count} users">
            </div>
            <div class="bar-label">${data.month}</div>
            <div class="bar-value">${data.count}</div>
        </div>
    `;
    }).join('');

    document.getElementById('userGrowthChart').innerHTML = chartHTML;
}

function updateEnrollmentMetrics(stats) {
    const { enrollment_metrics } = stats;
    
    document.getElementById('totalEnrolled').textContent = enrollment_metrics.total_enrolled;
    document.getElementById('enrollmentRate').textContent = 
        `${enrollment_metrics.enrollment_rate.toFixed(1)}%`;
    document.getElementById('studentsPerInstructor').textContent = 
        enrollment_metrics.students_per_instructor.toFixed(1);
}

function renderEnrollmentTrendChart(enrollmentData) {
    if (!enrollmentData || enrollmentData.length === 0) {
        document.getElementById('enrollmentTrendChart').innerHTML = '<div class="loading">No data available</div>';
        return;
    }

    const maxCount = Math.max(...enrollmentData.map(d => d.count), 1);
    
    const chartHTML = enrollmentData.map(data => {
        // Calculate percentage height (max value = 100%)
        let heightPercent = (data.count / maxCount) * 100;
        // Ensure even 0 values show a tiny bar (2% minimum for visibility)
        if (heightPercent === 0) heightPercent = 2;
        
        return `
        <div class="chart-bar">
            <div class="bar-fill" 
                 style="height: ${heightPercent}%;"
                 title="${data.count} enrollments">
            </div>
            <div class="bar-label">${data.month}</div>
            <div class="bar-value">${data.count}</div>
        </div>
    `;
    }).join('');

    document.getElementById('enrollmentTrendChart').innerHTML = chartHTML;
}

function updatePlatformStats(stats) {
    const { platform_stats } = stats;
    
    document.getElementById('totalSubjects').textContent = platform_stats.total_subjects;
    document.getElementById('totalAssignments').textContent = platform_stats.total_assignments;
    document.getElementById('totalSubmissions').textContent = platform_stats.total_submissions;
    document.getElementById('avgCompletionRate').textContent = 
        `${platform_stats.avg_completion_rate.toFixed(1)}%`;
}

async function renderTopInstructors() {
    try {
        const response = await fetch('/api/dashboard/top-instructors?limit=3');
        const instructors = await response.json();
        
        if (!instructors || instructors.length === 0) {
            document.getElementById('activeInstructorsList').innerHTML = 
                '<div class="loading">No instructors found</div>';
            return;
        }
        
        const ranks = ['gold', 'silver', 'bronze'];
        const html = instructors.map((instructor, index) => `
            <div class="leaderboard-item">
                <div class="leaderboard-info">
                    <h4>${instructor.name || 'Unknown'}</h4>
                    <p>${instructor.subjects} subjects • ${instructor.students} students</p>
                </div>
                <div class="leaderboard-rank ${ranks[index] || ''}">${index + 1}</div>
            </div>
        `).join('');

        document.getElementById('activeInstructorsList').innerHTML = html;

    } catch (error) {
        console.error('Error rendering instructors:', error);
        document.getElementById('activeInstructorsList').innerHTML = 
            '<div class="loading">Error loading data</div>';
    }
}

async function renderTopStudents() {
    try {
        const response = await fetch('/api/dashboard/top-students?limit=3');
        const students = await response.json();
        
        if (!students || students.length === 0) {
            document.getElementById('engagedStudentsList').innerHTML = 
                '<div class="loading">No students found</div>';
            return;
        }
        
        const ranks = ['gold', 'silver', 'bronze'];
        const html = students.map((student, index) => `
            <div class="leaderboard-item">
                <div class="leaderboard-info">
                    <h4>${student.name || 'Unknown'}</h4>
                    <p>${student.completion}% completion • Grade: ${student.grade}</p>
                </div>
                <div class="leaderboard-rank ${ranks[index] || ''}">${index + 1}</div>
            </div>
        `).join('');

        document.getElementById('engagedStudentsList').innerHTML = html;

    } catch (error) {
        console.error('Error rendering students:', error);
        document.getElementById('engagedStudentsList').innerHTML = 
            '<div class="loading">Error loading data</div>';
    }
}

async function updateSystemAlerts() {
    try {
        const response = await fetch('/api/dashboard/system-alerts');
        const alerts = await response.json();
        
        const totalAlerts = alerts.reduce((sum, alert) => sum + alert.count, 0);
        document.getElementById('alertsBadge').textContent = `${totalAlerts} Active`;

        const html = alerts.map((alert, idx) => {
            const affectedUsersText = alert.affected_users && alert.affected_users.length > 0 
                ? alert.affected_users.map(u => u.name).join(', ')
                : 'None';
            
            const affectedUsersDisplay = alert.affected_users && alert.affected_users.length > 0
                ? alert.affected_users.map((u, i) => `${i + 1}. ${u.name}`).join('\n')
                : 'No affected users';
            
            return `
                <div class="alert-item ${alert.type}" style="cursor: pointer;" 
                     onclick="showAlertDetails(event, '${alert.id}', '${alert.message.replace(/'/g, "\\'")}', '${affectedUsersDisplay.replace(/'/g, "\\'").replace(/\n/g, '|')}')"
                     title="Click to view details">
                    <div class="alert-content">
                        <i class="fas ${alert.icon} alert-icon"></i>
                        <div class="alert-text">
                            <div class="alert-message">${alert.message}</div>
                            <div style="font-size: 11px; color: #7f8c8d; margin-top: 4px;">
                                ${affectedUsersText}
                            </div>
                            <div class="alert-priority">Priority: ${alert.priority}</div>
                        </div>
                    </div>
                    <div class="alert-count">${alert.count}</div>
                </div>
            `;
        }).join('');

        document.getElementById('systemAlertsList').innerHTML = html;

    } catch (error) {
        console.error('Error updating alerts:', error);
        document.getElementById('systemAlertsList').innerHTML = 
            '<div class="loading">Error loading alerts</div>';
    }
}

function showAlertDetails(event, alertId, message, usersList) {
    event.stopPropagation();
    const users = usersList.split('|').filter(u => u.trim());
    const userListText = users.length > 0 ? users.join('\n') : 'No affected users';
    
    // Create modal HTML
    const modalHTML = `
        <div id="alertModal" class="alert-modal-overlay" onclick="closeAlertModal(event)">
            <div class="alert-modal-content" onclick="event.stopPropagation()">
                <div class="alert-modal-header">
                    <h2>${message}</h2>
                    <button class="alert-modal-close" onclick="closeAlertModal()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="alert-modal-body">
                    <div class="alert-modal-section">
                        <h3>Affected Users</h3>
                        <div class="alert-modal-users">
                            ${users.length > 0 
                                ? users.map((user, idx) => `
                                    <div class="alert-modal-user-item">
                                        <span class="alert-modal-user-number">${idx + 1}</span>
                                        <span class="alert-modal-user-name">${user}</span>
                                    </div>
                                `).join('')
                                : '<div style="padding: 15px; text-align: center; color: #7f8c8d;">No affected users</div>'
                            }
                        </div>
                    </div>
                </div>
                <div class="alert-modal-footer">
                    <button class="alert-modal-btn-close" onclick="closeAlertModal()">Close</button>
                </div>
            </div>
        </div>
    `;
    
    // Remove existing modal if present
    const existingModal = document.getElementById('alertModal');
    if (existingModal) existingModal.remove();
    
    // Insert and show modal
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    setTimeout(() => {
        document.getElementById('alertModal').classList.add('show');
    }, 10);
}

function closeAlertModal(event) {
    if (event && event.target.id !== 'alertModal') return;
    const modal = document.getElementById('alertModal');
    if (modal) {
        modal.classList.remove('show');
        setTimeout(() => modal.remove(), 300);
    }
}

async function updateRecentActivities() {
    try {
        const response = await fetch('/api/dashboard/recent-activities?limit=10');
        const activities = await response.json();
        
        if (!activities || activities.length === 0) {
            document.getElementById('recentActivitiesList').innerHTML = 
                '<div class="loading">No recent activities</div>';
            return;
        }

        const html = activities.map(activity => `
            <div class="activity-item">
                <div class="activity-icon ${activity.color}">
                    <i class="fas ${activity.icon}"></i>
                </div>
                <div class="activity-details">
                    <div class="activity-message">${activity.message}</div>
                    <div style="font-size: 11px; color: #7f8c8d; margin-top: 2px;">
                        ${activity.responsible}
                    </div>
                    <div class="activity-time">${activity.time_ago || getTimeAgo(activity.created_at)}</div>
                </div>
            </div>
        `).join('');

        document.getElementById('recentActivitiesList').innerHTML = html;

    } catch (error) {
        console.error('Error updating activities:', error);
        document.getElementById('recentActivitiesList').innerHTML = 
            '<div class="loading">Error loading activities</div>';
    }
}

async function loadEnrolledLearnerRiskScores() {
    try {
        const response = await fetch('/api/enrolled-learners/risk-scores');
        if (!response.ok) {
            throw new Error('Failed to fetch risk scores');
        }
        
        const data = await response.json();
        
        // Update stat cards
        document.getElementById('totalEnrolledLearners').textContent = data.total_enrolled;
        
        // Update stats for learners with active subjects
        const statsCard = document.querySelector('[style*="Enrolled Learners"]') || document.querySelector('[id*="EnrolledLearners"]')?.parentElement;
        
        // Get counts from learners data
        const at_risk_count = data.learners.length;
        const high_risk = data.learners.filter(l => l.risk_level === 'high').length;
        const medium_risk = data.learners.filter(l => l.risk_level === 'medium').length;
        
        // Update stat cards if they exist
        const lowRiskElement = document.getElementById('lowRiskCount');
        const mediumRiskElement = document.getElementById('mediumRiskCount');
        const highRiskElement = document.getElementById('highRiskCount');
        
        if (lowRiskElement) lowRiskElement.textContent = Math.max(0, data.total_enrolled - at_risk_count);
        if (mediumRiskElement) mediumRiskElement.textContent = medium_risk;
        if (highRiskElement) highRiskElement.textContent = high_risk;
        
        // Create pie chart for risk distribution
        createRiskDistributionChart({ low_risk: Math.max(0, data.total_enrolled - at_risk_count), medium_risk, high_risk });
        
        // Display learners with pending assignments
        displayHighRiskLearners(data.learners);
        
    } catch (error) {
        console.error('Error loading risk scores:', error);
        document.getElementById('highRiskLearnersList').innerHTML = 
            '<div class="loading" style="color: #e74c3c;">Error loading risk data</div>';
    }
}

function createRiskDistributionChart(data) {
    const ctx = document.getElementById('riskDistributionChart');
    if (!ctx) return;
    
    // Check if Chart.js is available
    if (typeof Chart === 'undefined') {
        // Load Chart.js if not available
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js';
        script.onload = () => {
            createRiskDistributionChart(data);
        };
        document.head.appendChild(script);
        return;
    }
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Low', 'Medium', 'High'],
            datasets: [{
                data: [data.low_risk, data.medium_risk, data.high_risk],
                backgroundColor: ['#27ae60', '#f39c12', '#e74c3c'],
                borderColor: ['#229954', '#d68910', '#c0392b'],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 8,
                        font: { size: 11, weight: '500' },
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    padding: 8,
                    titleFont: { size: 11 },
                    bodyFont: { size: 10 }
                }
            }
        }
    });
}

function displayHighRiskLearners(allLearners) {
    const highRiskLearners = allLearners.filter(l => l.risk_level === 'high').slice(0, 5);
    
    if (highRiskLearners.length === 0) {
        document.getElementById('highRiskLearnersList').innerHTML = 
            '<div style="padding: 20px; text-align: center; color: #27ae60;"><i class="fas fa-check-circle" style="font-size: 24px;"></i><p style="margin-top: 10px;">No learners with pending assignments!</p></div>';
        return;
    }
    
    const html = highRiskLearners.map(learner => `
        <div style="padding: 15px; border-bottom: 1px solid #ecf0f1;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                <div>
                    <div style="font-weight: 600; color: #2c3e50; font-size: 14px;">${learner.name}</div>
                    <div style="font-size: 11px; color: #7f8c8d;">
                        LRN: ${learner.lrn || 'N/A'} | Barangay: ${learner.barangay || 'N/A'}
                    </div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 18px; font-weight: bold; color: #e74c3c;">${learner.risk_score}</div>
                    <div style="font-size: 10px; background: #fadbd8; color: #c0392b; padding: 3px 6px; border-radius: 3px; font-weight: 600;">HIGH RISK</div>
                </div>
            </div>
            
            <!-- Enrolled Subjects Section -->
            ${learner.enrolled_subjects && learner.enrolled_subjects.length > 0 ? `
                <div style="margin-top: 10px; padding: 8px; background: #f8f9fa; border-radius: 4px; border-left: 3px solid #3498db;">
                    <div style="font-size: 12px; font-weight: 600; color: #2c3e50; margin-bottom: 6px;">📚 Enrolled Subjects:</div>
                    ${learner.enrolled_subjects.map(subject => `
                        <div style="font-size: 11px; color: #34495e; margin-bottom: 4px; padding: 4px 0;">
                            <span style="font-weight: 500;">${subject.subject_name}</span>
                            <span style="background: #fff3cd; color: #856404; padding: 2px 6px; border-radius: 3px; font-size: 10px; margin-left: 8px; font-weight: 600;">
                                ⚠️ ${subject.pending_assignments} pending / ${subject.total_assignments} total
                            </span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            
            <!-- Risk Factors -->
            ${learner.risk_factors.length > 0 ? `
                <div style="margin-top: 8px;">
                    ${learner.risk_factors.map(f => `
                        <span style="background: #fadbd8; color: #c0392b; padding: 3px 6px; border-radius: 3px; margin-right: 4px; display: inline-block; font-size: 10px;">
                            ${f}
                        </span>
                    `).join('')}
                </div>
            ` : ''}
            
            <!-- Stats -->
            <div style="margin-top: 8px; font-size: 11px; color: #7f8c8d;">
                <span>📝 Submissions: ${learner.submission_count}</span> | 
                <span>⏱️ Days Enrolled: ${learner.days_enrolled || 'N/A'}</span>
            </div>
        </div>
    `).join('');
    
    document.getElementById('highRiskLearnersList').innerHTML = html;
}

document.addEventListener('DOMContentLoaded', async () => {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (!user.id || user.role !== 'admin') {
        alert('Unauthorized access. Redirecting to login.');
        window.location.href = '/';
        return;
    }

    if (user.username) {
        document.getElementById('adminName').textContent = `Welcome, ${user.username}`;
    }

    await loadDashboardData();
    await loadEnrolledLearnerRiskScores();
});