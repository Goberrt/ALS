
if (!window.supabaseClient) {
    window.supabaseClient = window.supabase.createClient(
        'https://bbinymljjtjxkeclqamt.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiaW55bWxqanRqeGtlY2xxYW10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MzQ1OTQsImV4cCI6MjA3MjMxMDU5NH0.bOIwdxUiLd-63V6-_XZxER1PLqohtd1cnwipF6YZjn4'
    );
}

let currentSubject = null;
        let currentUser = null;

        document.addEventListener('DOMContentLoaded', async () => {
            // Get subject ID from URL
            const urlParams = new URLSearchParams(window.location.search);
            const subjectId = urlParams.get('id');

            if (!subjectId) {
                window.location.href = '/student_modules';
                return;
            }

            // Auth check
            currentUser = JSON.parse(localStorage.getItem('user') || '{}');
            if (!currentUser || !currentUser.username) {
                window.location.href = '/';
                return;
            }

            // Load subject data
            await loadSubject(subjectId);
            await loadPosts(subjectId);
            await loadUpcoming(subjectId);

            // Tab switching
            document.querySelectorAll('.subject-nav-item').forEach(item => {
                item.addEventListener('click', async () => {
                    document.querySelectorAll('.subject-nav-item').forEach(i => i.classList.remove('active'));
                    item.classList.add('active');
                    
                    const tab = item.dataset.tab;
                    
                    if (tab === 'stream') {
                        await loadPosts(subjectId);
                    } else if (tab === 'classwork') {
                        await loadClasswork(subjectId);
                    } else if (tab === 'grades') {
                        await loadMyGrades(subjectId);  // ← NEW: Load grades view
                    }
                });
            });
            // Load sidebar
// Load sidebar
        fetch('../COMPONENTS/student_sidebar.html')
            .then(response => response.text())
            .then(html => {
                document.getElementById('sidebarContainer').innerHTML = html;
                initializeSidebar();
                initializeMobileMenu();
                loadSidebarProfile();
            });
        });

        async function loadSubject(subjectId) {
            const { data, error } = await window.supabaseClient
                .from('subjects')
                .select(`
                    *,
                    instructor:instructor_id(username, first_name, last_name)
                `)
                .eq('id', subjectId)
                .single();

            if (error || !data) {
                alert('Subject not found');
                window.location.href = '/student_modules';
                return;
            }

            currentSubject = data;
            document.getElementById('subjectName').textContent = data.subject_name;
            document.getElementById('subjectCode').textContent = data.subject_code;

            // Display instructor info
            const instructor = data.instructor;
            const initial = instructor.first_name ? instructor.first_name.charAt(0).toUpperCase() : 'I';
            const name = `${instructor.first_name || ''} ${instructor.last_name || ''}`.trim() || instructor.username;

            const instructorInfoEl = document.getElementById('instructorInfo');
            instructorInfoEl.innerHTML = `
                <div class="instructor-avatar">${initial}</div>
                <div>
                    <div style="font-weight: 500; color: #333;">${name}</div>
                    <div style="font-size: 0.875rem; color: #999;">Instructor</div>
                </div>
            `;
            
            // Store instructor ID for messaging
            instructorInfoEl.dataset.instructorId = data.instructor_id;
            instructorInfoEl.dataset.instructorName = name;
            
            // Also make it available globally for messaging
            if (window.currentInstructor === undefined || window.currentInstructor === null) {
                window.currentInstructor = {
                    id: data.instructor_id,
                    name: name
                };
            }
        }

        // REPLACE your existing loadPosts function with this updated version

        async function loadPosts(subjectId) {
            const { data: posts, error } = await window.supabaseClient
                .from('subject_posts')
                .select('*')
                .eq('subject_id', subjectId)
                .eq('is_published', true)
                .order('created_at', { ascending: false });

            const container = document.getElementById('postsContainer');
            const emptyState = document.getElementById('emptyState');

            if (error || !posts || posts.length === 0) {
                container.innerHTML = '';
                emptyState.style.display = 'block';
                return;
            }

            emptyState.style.display = 'none';

            // NEW: Get all student's submissions for these posts
            const postIds = posts.map(p => p.id);
            const { data: mySubmissions } = await window.supabaseClient
                .from('post_submissions')
                .select('*')
                .eq('student_id', currentUser.id)
                .in('post_id', postIds);

            const submissionMap = {};
            if (mySubmissions) {
                mySubmissions.forEach(sub => {
                    submissionMap[sub.post_id] = sub;
                });
            }

            container.innerHTML = posts.map(post => {
                const postIcon = post.post_type === 'assignment' ? 'fa-file-alt' : 
                            post.post_type === 'material' ? 'fa-book' : 'fa-bullhorn';
                
                const date = new Date(post.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                });

                // Get file icon
                let fileIcon = 'fa-file';
                if (post.file_url) {
                    const ext = post.file_url.split('.').pop().toLowerCase();
                    if (ext === 'pdf') fileIcon = 'fa-file-pdf';
                    else if (['docx', 'doc'].includes(ext)) fileIcon = 'fa-file-word';
                    else if (['xlsx', 'xls'].includes(ext)) fileIcon = 'fa-file-excel';
                    else if (['pptx', 'ppt'].includes(ext)) fileIcon = 'fa-file-powerpoint';
                }

                // Check if due date is near or overdue
                let dueDateBadge = '';
                if (post.due_date) {
                    const dueDate = new Date(post.due_date);
                    const now = new Date();
                    const diffDays = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
                    
                    let badgeClass = '';
                    let badgeText = '';
                    
                    if (diffDays < 0) {
                        badgeClass = 'overdue';
                        badgeText = `Overdue by ${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''}`;
                    } else if (diffDays === 0) {
                        badgeClass = 'overdue';
                        badgeText = 'Due today';
                    } else if (diffDays <= 3) {
                        badgeClass = 'upcoming';
                        badgeText = `Due in ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
                    } else {
                        badgeText = `Due: ${dueDate.toLocaleDateString()}`;
                    }
                    
                    dueDateBadge = `
                        <div class="due-date-badge ${badgeClass}">
                            <i class="fas fa-clock"></i>
                            ${badgeText}
                        </div>
                    `;
                }

                // NEW: Check if student has submitted
                const submission = submissionMap[post.id];
                let submissionButtons = '';

                if (post.post_type === 'assignment') {
                    if (submission) {
                        // Student has already submitted
                        const submittedDate = new Date(submission.submitted_at).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                        });

                        submissionButtons = `
                            <div class="submission-status-box">
                                <div class="submission-status-header">
                                    <i class="fas fa-check-circle"></i>
                                    <span>Turned in</span>
                                </div>
                                <div class="submission-status-date">
                                    Submitted on ${submittedDate}
                                </div>
                                ${submission.grade !== null ? `
                                    <div class="submission-grade-preview">
                                        <i class="fas fa-star"></i>
                                        Grade: ${submission.grade}/${post.points || 100}
                                    </div>
                                ` : ''}
                            </div>
                            <div class="submission-actions-group">
                                <button class="turn-in-btn submitted" onclick="viewMySubmission('${submission.id}')">
                                    <i class="fas fa-eye"></i> View Submission
                                </button>
                                ${submission.grade === null ? `
                                    <button class="edit-submission-btn" onclick="editSubmission('${post.id}', '${submission.id}')">
                                        <i class="fas fa-edit"></i> Edit
                                    </button>
                                    <button class="unsubmit-btn" onclick="unsubmitAssignment('${submission.id}', '${post.id}')">
                                        <i class="fas fa-undo"></i> Unsubmit
                                    </button>
                                ` : `
                                    <span class="graded-notice">
                                        <i class="fas fa-lock"></i> Graded - Cannot edit
                                    </span>
                                `}
                            </div>
                        `;
                    } else {
                        // Not yet submitted
                        submissionButtons = `
                            <button class="turn-in-btn" onclick="turnInAssignment('${post.id}')">
                                <i class="fas fa-upload"></i> Turn In
                            </button>
                        `;
                    }
                }

                return `
                    <div class="post-card ${post.post_type}">
                        <div class="post-header">
                            <div class="post-icon ${post.post_type}">
                                <i class="fas ${postIcon}"></i>
                            </div>
                            <div class="post-info">
                                <h3>${post.title}</h3>
                                <p>Posted on ${date}</p>
                            </div>
                        </div>
                        ${post.content ? `<div class="post-content">${post.content}</div>` : ''}
                        
                        ${post.file_url ? `
                            <a href="${post.file_url}" target="_blank" download class="file-attachment">
                                <i class="fas ${fileIcon} file-icon"></i>
                                <span>Download Attachment</span>
                                <i class="fas fa-download" style="margin-left: auto;"></i>
                            </a>
                        ` : ''}
                        
                        ${post.external_link ? `
                            <a href="${post.external_link}" target="_blank" class="file-attachment">
                                <i class="fas fa-external-link-alt file-icon"></i>
                                <span>View External Link</span>
                            </a>
                        ` : ''}
                        
                        <div style="margin-top: 1rem;">
                            ${dueDateBadge}
                            ${post.points ? `
                                <div class="points-badge">
                                    <i class="fas fa-star"></i>
                                    ${post.points} points
                                </div>
                            ` : ''}
                        </div>
                        
                        ${submissionButtons}
                    </div>
                `;
            }).join('');
        }

        // NEW: View student's own submission
        async function viewMySubmission(submissionId) {
            try {
                const { data: submission, error } = await window.supabaseClient
                    .from('post_submissions')
                    .select(`
                        *,
                        post:post_id(id, title, points, content, due_date)
                    `)
                    .eq('id', submissionId)
                    .single();

                if (error) throw error;

                const submittedDate = new Date(submission.submitted_at).toLocaleString();
                const fileName = submission.file_url ? submission.file_url.split('/').pop() : 'No file';

                let gradeInfo = 'Not yet graded';
                if (submission.grade !== null) {
                    const percentage = submission.post.points > 0 
                        ? Math.round((submission.grade / submission.post.points) * 100) 
                        : 0;
                    gradeInfo = `${submission.grade}/${submission.post.points} (${percentage}%)`;
                }

                alert(`Your Submission\n\n` +
                    `Assignment: ${submission.post.title}\n` +
                    `Submitted: ${submittedDate}\n` +
                    `File: ${fileName}\n` +
                    `Comment: ${submission.submission_text || 'None'}\n\n` +
                    `Grade: ${gradeInfo}\n` +
                    `Feedback: ${submission.feedback || 'No feedback yet'}`);

            } catch (error) {
                console.error('Error viewing submission:', error);
                alert('Failed to load submission details');
            }
        }

        // NEW: Edit existing submission
        let currentSubmissionId = null;

        async function editSubmission(postId, submissionId) {
            currentSubmissionId = submissionId;

            try {
                // Get the submission details
                const { data: submission, error: subError } = await window.supabaseClient
                    .from('post_submissions')
                    .select('*')
                    .eq('id', submissionId)
                    .single();

                if (subError) throw subError;

                // Get the assignment details
                const { data: assignment, error: assignError } = await window.supabaseClient
                    .from('subject_posts')
                    .select('*')
                    .eq('id', postId)
                    .single();

                if (assignError) throw assignError;

                currentAssignment = assignment;

                // Open modal with existing submission data
                document.getElementById('modalAssignmentTitle').textContent = assignment.title + ' (Edit Submission)';
                
                if (assignment.due_date) {
                    const dueDate = new Date(assignment.due_date);
                    document.getElementById('modalAssignmentDue').innerHTML = 
                        `<i class="fas fa-clock"></i> Due: ${dueDate.toLocaleString()}`;
                }
                
                if (assignment.points) {
                    document.getElementById('modalAssignmentPoints').innerHTML = 
                        `<i class="fas fa-star"></i> ${assignment.points} points`;
                }

                // Pre-fill comment
                document.getElementById('submissionComment').value = submission.submission_text || '';

                // Show existing file info
                if (submission.file_url) {
                    const fileName = submission.file_url.split('/').pop();
                    document.getElementById('uploadArea').innerHTML = `
                        <div class="existing-file-notice">
                            <i class="fas fa-file-check" style="font-size: 2rem; color: #4caf50;"></i>
                            <p style="font-weight: 500; color: #333; margin: 1rem 0 0.5rem 0;">Current file: ${fileName}</p>
                            <p style="color: #666; font-size: 0.875rem;">Upload a new file to replace it, or keep the existing file</p>
                        </div>
                    `;
                }

                // Reset file input
                selectedFile = null;
                document.getElementById('fileInput').value = '';
                document.getElementById('filePreview').style.display = 'none';
                
                // Enable submit button (can submit without new file)
                document.getElementById('submitBtn').disabled = false;
                document.getElementById('submitBtn').innerHTML = '<i class="fas fa-save"></i> Update Submission';

                // Show modal
                document.getElementById('submissionModal').style.display = 'block';

            } catch (error) {
                console.error('Error loading submission for edit:', error);
                alert('Failed to load submission for editing');
            }
        }

       async function unsubmitAssignment(submissionId, postId) {
            if (!confirm('Are you sure you want to unsubmit this assignment? You can resubmit it later.')) {
                return;
            }

            try {
                // Show loading state
                const button = event.target.closest('.unsubmit-btn');
                if (button) {
                    button.disabled = true;
                    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Unsubmitting...';
                }

                const { error } = await window.supabaseClient
                    .from('post_submissions')
                    .delete()
                    .eq('id', submissionId)
                    .eq('student_id', currentUser.id); // Extra safety check

                if (error) throw error;

                alert('Assignment unsubmitted successfully! You can now submit it again.');
                
                // Reload the current tab
                const activeTab = document.querySelector('.subject-nav-item.active');
                const tab = activeTab ? activeTab.dataset.tab : 'stream';
                
                if (tab === 'stream') {
                    await loadPosts(currentSubject.id);
                } else if (tab === 'classwork') {
                    await loadClasswork(currentSubject.id);
                } else if (tab === 'grades') {
                    await loadMyGrades(currentSubject.id);
                }

            } catch (error) {
                console.error('Error unsubmitting assignment:', error);
                alert('Failed to unsubmit assignment: ' + error.message);
                
                // Restore button state
                const button = event.target.closest('.unsubmit-btn');
                if (button) {
                    button.disabled = false;
                    button.innerHTML = '<i class="fas fa-undo"></i> Unsubmit';
                }
            }
        }

        // UPDATED: Submit/Update assignment function
        async function submitAssignment() {
            const submitBtn = document.getElementById('submitBtn');
            const progressDiv = document.getElementById('uploadProgress');
            const progressBar = document.getElementById('progressBar');
            const progressText = document.getElementById('progressText');
            
            // For edits, file is optional
            if (!selectedFile && !currentSubmissionId) {
                alert('Please select a file to submit');
                return;
            }
            
            try {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
                
                progressDiv.style.display = 'block';
                progressBar.style.width = '30%';
                progressText.textContent = selectedFile ? 'Uploading file...' : 'Updating submission...';
                
                let fileUrl = null;

                // Upload new file if selected
                if (selectedFile) {
                    const formData = new FormData();
                    formData.append('file', selectedFile);
                    formData.append('assignment_id', currentAssignment.id);
                    formData.append('student_id', currentUser.id);
                    
                    const uploadResponse = await fetch('/api/upload-submission', {
                        method: 'POST',
                        body: formData
                    });
                    
                    if (!uploadResponse.ok) {
                        const error = await uploadResponse.json();
                        throw new Error(error.detail || 'File upload failed');
                    }
                    
                    const uploadResult = await uploadResponse.json();
                    fileUrl = uploadResult.file_url;
                }
                
                progressBar.style.width = '70%';
                progressText.textContent = currentSubmissionId ? 'Updating submission...' : 'Creating submission...';
                
                const submissionData = {
                    post_id: currentAssignment.id,
                    student_id: currentUser.id,
                    submission_text: document.getElementById('submissionComment').value || null,
                    status: 'submitted',
                    submitted_at: new Date().toISOString()
                };

                // Add file URL if new file uploaded
                if (fileUrl) {
                    submissionData.file_url = fileUrl;
                }

                let submitResponse;

                if (currentSubmissionId) {
                    // UPDATE existing submission
                    submitResponse = await fetch(`/api/assignment-submissions/${currentSubmissionId}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(submissionData)
                    });
                } else {
                    // CREATE new submission
                    submissionData.file_url = fileUrl; // Required for new submissions
                    submitResponse = await fetch('/api/assignment-submissions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(submissionData)
                    });
                }
                
                if (!submitResponse.ok) {
                    const error = await submitResponse.json();
                    throw new Error(error.detail || 'Submission failed');
                }
                
                progressBar.style.width = '100%';
                progressText.textContent = currentSubmissionId ? 'Update complete!' : 'Submission complete!';
                progressText.style.color = '#4caf50';
                
                setTimeout(() => {
                    alert(currentSubmissionId ? 'Submission updated successfully!' : 'Assignment submitted successfully!');
                    closeSubmissionModal();
                    loadPosts(currentSubject.id);
                }, 1000);
                
            } catch (error) {
                console.error('Submission error:', error);
                alert('Failed to submit assignment: ' + error.message);
                progressDiv.style.display = 'none';
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Assignment';
            }
        }

        // UPDATED: Close modal (reset edit state)
        function closeSubmissionModal() {
            document.getElementById('submissionModal').style.display = 'none';
            currentAssignment = null;
            currentSubmissionId = null;
            selectedFile = null;
            
            // Reset upload area
            document.getElementById('uploadArea').innerHTML = `
                <div class="upload-icon">
                    <i class="fas fa-cloud-upload-alt"></i>
                </div>
                <p style="font-weight: 500; color: #333;">Click to upload or drag and drop</p>
                <p class="file-types">PDF, DOCX, DOC, PPTX, XLSX, TXT (Max 10MB)</p>
            `;
        }

        // Make new functions globally accessible
        window.viewMySubmission = viewMySubmission;
        window.editSubmission = editSubmission;
        window.unsubmitAssignment = unsubmitAssignment;

        async function loadClasswork(subjectId) {
            // Load only assignments and materials
            const { data: posts, error } = await window.supabaseClient
                .from('subject_posts')
                .select('*')
                .eq('subject_id', subjectId)
                .in('post_type', ['assignment', 'material'])
                .eq('is_published', true)
                .order('due_date', { ascending: true });

            const container = document.getElementById('postsContainer');

            if (error || !posts || posts.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-tasks"></i>
                        <h3>No classwork yet</h3>
                        <p>Your instructor hasn't assigned any work yet</p>
                    </div>
                `;
                return;
            }

            // Group by type
            const assignments = posts.filter(p => p.post_type === 'assignment');
            const materials = posts.filter(p => p.post_type === 'material');

            container.innerHTML = `
                ${assignments.length > 0 ? `
                    <h2 style="color: #333; margin-bottom: 1rem;">
                        <i class="fas fa-file-alt" style="color: #f44336;"></i> Assignments (${assignments.length})
                    </h2>
                    ${assignments.map(post => createPostCard(post)).join('')}
                ` : ''}
                
                ${materials.length > 0 ? `
                    <h2 style="color: #333; margin: 2rem 0 1rem 0;">
                        <i class="fas fa-book" style="color: #4caf50;"></i> Materials (${materials.length})
                    </h2>
                    ${materials.map(post => createPostCard(post)).join('')}
                ` : ''}
            `;
        }

        function createPostCard(post) {
            const postIcon = post.post_type === 'assignment' ? 'fa-file-alt' : 'fa-book';
            const date = new Date(post.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
            });

            let fileIcon = 'fa-file';
            if (post.file_url) {
                const ext = post.file_url.split('.').pop().toLowerCase();
                if (ext === 'pdf') fileIcon = 'fa-file-pdf';
                else if (['docx', 'doc'].includes(ext)) fileIcon = 'fa-file-word';
                else if (['xlsx', 'xls'].includes(ext)) fileIcon = 'fa-file-excel';
                else if (['pptx', 'ppt'].includes(ext)) fileIcon = 'fa-file-powerpoint';
            }

            return `
                <div class="post-card ${post.post_type}">
                    <div class="post-header">
                        <div class="post-icon ${post.post_type}">
                            <i class="fas ${postIcon}"></i>
                        </div>
                        <div class="post-info">
                            <h3>${post.title}</h3>
                            <p>Posted on ${date}</p>
                        </div>
                    </div>
                    ${post.content ? `<div class="post-content">${post.content}</div>` : ''}
                    
                    ${post.file_url ? `
                        <a href="${post.file_url}" target="_blank" download class="file-attachment">
                            <i class="fas ${fileIcon} file-icon"></i>
                            <span>Download Attachment</span>
                            <i class="fas fa-download" style="margin-left: auto;"></i>
                        </a>
                    ` : ''}
                    
                    ${post.post_type === 'assignment' ? `
                        <button class="turn-in-btn" onclick="turnInAssignment('${post.id}')">
                            <i class="fas fa-upload"></i>
                            Turn In
                        </button>
                    ` : ''}
                </div>
            `;
        }

        async function loadUpcoming(subjectId) {
            const { data: posts, error } = await window.supabaseClient
                .from('subject_posts')
                .select('*')
                .eq('subject_id', subjectId)
                .eq('post_type', 'assignment')
                .not('due_date', 'is', null)
                .gte('due_date', new Date().toISOString())
                .order('due_date', { ascending: true })
                .limit(5);

            const container = document.getElementById('upcomingContainer');

            if (error || !posts || posts.length === 0) {
                container.innerHTML = '<p style="color: #999; text-align: center; padding: 1rem; margin: 0;">No upcoming deadlines</p>';
                return;
            }

            container.innerHTML = posts.map(post => {
                const dueDate = new Date(post.due_date);
                const formattedDate = dueDate.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                });

                return `
                    <div class="upcoming-item assignment">
                        <h4>${post.title}</h4>
                        <p>Due: ${formattedDate}</p>
                    </div>
                `;
            }).join('');
        }

        function turnInAssignment(postId) {
            alert('Assignment submission feature coming soon!\nPost ID: ' + postId);
            // TODO: Implement assignment submission
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
        let currentAssignment = null;
        let selectedFile = null;
        function initializeMobileMenu() {
    const burgerMenu = document.getElementById('burgerMenu');
    const sidebar = document.querySelector('.sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');

    if (!burgerMenu || !sidebar || !sidebarOverlay) {
        console.error('Mobile menu elements not found');
        return;
    }

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

function turnInAssignment(postId) {
    // Find the assignment post
    fetch(`https://bbinymljjtjxkeclqamt.supabase.co/rest/v1/subject_posts?id=eq.${postId}`, {
        headers: {
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiaW55bWxqanRqeGtlY2xxYW10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MzQ1OTQsImV4cCI6MjA3MjMxMDU5NH0.bOIwdxUiLd-63V6-_XZxER1PLqohtd1cnwipF6YZjn4',
            'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiaW55bWxqanRqeGtlY2xxYW10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MzQ1OTQsImV4cCI6MjA3MjMxMDU5NH0.bOIwdxUiLd-63V6-_XZxER1PLqohtd1cnwipF6YZjn4'
        }
    })
    .then(res => res.json())
    .then(data => {
        if (data && data.length > 0) {
            currentAssignment = data[0];
            openSubmissionModal(currentAssignment);
        }
    })
    .catch(err => console.error('Error loading assignment:', err));
}

function openSubmissionModal(assignment) {
    currentAssignment = assignment;
    
    // Populate assignment details
    document.getElementById('modalAssignmentTitle').textContent = assignment.title;
    
    if (assignment.due_date) {
        const dueDate = new Date(assignment.due_date);
        const now = new Date();
        const isLate = dueDate < now;
        
        document.getElementById('modalAssignmentDue').innerHTML = `
            <i class="fas fa-clock"></i> Due: ${dueDate.toLocaleString()}
            ${isLate ? ' <span style="color: #f44336;">(Late submission)</span>' : ''}
        `;
    } else {
        document.getElementById('modalAssignmentDue').textContent = '';
    }
    
    if (assignment.points) {
        document.getElementById('modalAssignmentPoints').innerHTML = 
            `<i class="fas fa-star"></i> ${assignment.points} points`;
    } else {
        document.getElementById('modalAssignmentPoints').textContent = '';
    }
    
    // Reset form
    selectedFile = null;
    document.getElementById('fileInput').value = '';
    document.getElementById('filePreview').style.display = 'none';
    document.getElementById('uploadArea').style.display = 'block';
    document.getElementById('submissionComment').value = '';
    document.getElementById('submitBtn').disabled = true;
    
    // Show modal
    document.getElementById('submissionModal').style.display = 'block';
}

function closeSubmissionModal() {
    document.getElementById('submissionModal').style.display = 'none';
    currentAssignment = null;
    selectedFile = null;
}

// Drag and drop support
const uploadArea = document.getElementById('uploadArea');

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
});

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        handleFile(file);
    }
}

function handleFile(file) {
    // Validate file size (10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
        alert('File size exceeds 10MB limit');
        return;
    }
    
    // Validate file type
    const allowedTypes = ['.pdf', '.docx', '.doc', '.pptx', '.xlsx', '.txt'];
    const fileExt = '.' + file.name.split('.').pop().toLowerCase();
    
    if (!allowedTypes.includes(fileExt)) {
        alert('File type not allowed. Please upload: PDF, DOCX, DOC, PPTX, XLSX, or TXT');
        return;
    }
    
    selectedFile = file;
    
    // Show preview
    document.getElementById('uploadArea').style.display = 'none';
    document.getElementById('filePreview').style.display = 'block';
    document.getElementById('previewFileName').textContent = file.name;
    document.getElementById('previewFileSize').textContent = formatFileSize(file.size);
    
    // Update icon based on file type
    const iconMap = {
        'pdf': 'fa-file-pdf',
        'doc': 'fa-file-word',
        'docx': 'fa-file-word',
        'xls': 'fa-file-excel',
        'xlsx': 'fa-file-excel',
        'ppt': 'fa-file-powerpoint',
        'pptx': 'fa-file-powerpoint',
        'txt': 'fa-file-alt'
    };
    
    const ext = file.name.split('.').pop().toLowerCase();
    const iconClass = iconMap[ext] || 'fa-file';
    document.getElementById('previewIcon').innerHTML = `<i class="fas ${iconClass}"></i>`;
    
    // Enable submit button
    document.getElementById('submitBtn').disabled = false;
}

function removeFile() {
    selectedFile = null;
    document.getElementById('fileInput').value = '';
    document.getElementById('filePreview').style.display = 'none';
    document.getElementById('uploadArea').style.display = 'block';
    document.getElementById('submitBtn').disabled = true;
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// REPLACE the submitAssignment function in your existing JavaScript with this:

async function submitAssignment() {
    if (!selectedFile || !currentAssignment) {
        alert('Please select a file to submit');
        return;
    }
    
    const submitBtn = document.getElementById('submitBtn');
    const progressDiv = document.getElementById('uploadProgress');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    
    try {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
        
        // Show progress
        progressDiv.style.display = 'block';
        progressBar.style.width = '30%';
        progressText.textContent = 'Uploading file...';
        
        // Upload file first
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('assignment_id', currentAssignment.id);
        formData.append('student_id', currentUser.id);
        
        const uploadResponse = await fetch('/api/upload-submission', {
            method: 'POST',
            body: formData
        });
        
        if (!uploadResponse.ok) {
            const error = await uploadResponse.json();
            throw new Error(error.detail || 'File upload failed');
        }
        
        const uploadResult = await uploadResponse.json();
        
        progressBar.style.width = '70%';
        progressText.textContent = 'Creating submission...';
        
        // Create submission record - CHANGED: using post_id instead of assignment_id
        const submissionData = {
            post_id: currentAssignment.id,  // CHANGED
            student_id: currentUser.id,
            file_url: uploadResult.file_url,
            submission_text: document.getElementById('submissionComment').value || null,
            status: 'submitted'
        };
        
        const submitResponse = await fetch('/api/assignment-submissions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(submissionData)
        });
        
        if (!submitResponse.ok) {
            const error = await submitResponse.json();
            throw new Error(error.detail || 'Submission failed');
        }
        
        progressBar.style.width = '100%';
        progressText.textContent = 'Submission complete!';
        progressText.style.color = '#4caf50';
        
        setTimeout(() => {
            alert('Assignment submitted successfully!');
            closeSubmissionModal();
            // Reload posts to update button state
            loadPosts(currentSubject.id);
        }, 1000);
        
    } catch (error) {
        console.error('Submission error:', error);
        alert('Failed to submit assignment: ' + error.message);
        progressDiv.style.display = 'none';
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Assignment';
    }
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('submissionModal');
    if (event.target === modal) {
        closeSubmissionModal();
    }
}

// Add this to your student_subject_view.html <script> section

// ===========================================
// STUDENT GRADES VIEW FUNCTIONS
// ===========================================

/**
 * Load the My Grades tab
 */
async function loadMyGrades(subjectId) {
    const container = document.getElementById('postsContainer');
    container.innerHTML = '<div class="grade-loading"><i class="fas fa-spinner fa-spin"></i> Loading grades...</div>';
    
    try {
        // Get all assignments for this subject
        const { data: assignments, error: assignError } = await window.supabaseClient
            .from('subject_posts')
            .select('*')
            .eq('subject_id', subjectId)
            .eq('post_type', 'assignment')
            .order('due_date', { ascending: false });

        if (assignError) throw assignError;

        // Get student's submissions
        const { data: submissions, error: subError } = await window.supabaseClient
            .from('post_submissions')
            .select('*')
            .eq('student_id', currentUser.id)
            .in('post_id', assignments.map(a => a.id));

        if (subError) throw subError;

        // Create submission map
        const submissionMap = {};
        if (submissions) {
            submissions.forEach(sub => {
                submissionMap[sub.post_id] = sub;
            });
        }

        // Calculate statistics
        const totalAssignments = assignments.length;
        const submittedCount = submissions ? submissions.length : 0;
        const gradedCount = submissions ? submissions.filter(s => s.grade !== null).length : 0;
        
        let totalPoints = 0;
        let earnedPoints = 0;
        let gradedAssignments = 0;

        assignments.forEach(assignment => {
            const submission = submissionMap[assignment.id];
            if (submission && submission.grade !== null) {
                totalPoints += assignment.points || 0;
                earnedPoints += submission.grade || 0;
                gradedAssignments++;
            }
        });

        const overallPercentage = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;

        // Render grades view
        container.innerHTML = `
            <div class="grades-container">
                <!-- Overall Grade Summary -->
                <div class="overall-grade-card">
                    <div class="overall-grade-header">
                        <h2><i class="fas fa-chart-line"></i> Overall Grade</h2>
                        <div class="overall-grade-value">${overallPercentage}%</div>
                    </div>
                    <div class="overall-grade-stats">
                        <div class="grade-stat">
                            <div class="grade-stat-value">${earnedPoints}</div>
                            <div class="grade-stat-label">Points Earned</div>
                        </div>
                        <div class="grade-stat">
                            <div class="grade-stat-value">${totalPoints}</div>
                            <div class="grade-stat-label">Total Points</div>
                        </div>
                        <div class="grade-stat">
                            <div class="grade-stat-value">${gradedCount}/${totalAssignments}</div>
                            <div class="grade-stat-label">Graded</div>
                        </div>
                    </div>
                    <div class="progress-bar-container">
                        <div class="progress-bar-fill" style="width: ${overallPercentage}%"></div>
                    </div>
                </div>

                <!-- Assignments List -->
                <div class="assignments-grades-list">
                    <h3><i class="fas fa-list"></i> Assignment Grades</h3>
                    ${assignments.length > 0 ? assignments.map(assignment => {
                        const submission = submissionMap[assignment.id];
                        return renderGradeCard(assignment, submission);
                    }).join('') : '<p class="no-grades">No assignments yet</p>'}
                </div>
            </div>
        `;

        // Animate progress bar
        setTimeout(() => {
            const bar = document.querySelector('.progress-bar-fill');
            if (bar) {
                const width = bar.style.width;
                bar.style.width = '0%';
                setTimeout(() => bar.style.width = width, 100);
            }
        }, 100);

    } catch (error) {
        console.error('Error loading grades:', error);
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-circle"></i>
                <h3>Error loading grades</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}

/**
 * Render individual grade card
 */
function renderGradeCard(assignment, submission) {
    const dueDate = assignment.due_date ? new Date(assignment.due_date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    }) : 'No due date';

    const maxPoints = assignment.points || 0;
    
    // Determine status
    let statusBadge = '';
    let statusClass = '';
    let gradeDisplay = '';
    let feedbackSection = '';

    if (!submission) {
        statusBadge = '<span class="grade-status-badge missing">Not Submitted</span>';
        statusClass = 'missing';
        gradeDisplay = '<div class="grade-score-display not-graded">-</div>';
    } else if (submission.grade === null) {
        statusBadge = '<span class="grade-status-badge pending">Pending Grade</span>';
        statusClass = 'pending';
        gradeDisplay = '<div class="grade-score-display not-graded">Pending</div>';
    } else {
        const percentage = maxPoints > 0 ? Math.round((submission.grade / maxPoints) * 100) : 0;
        const letterGrade = getLetterGrade(percentage);
        
        statusBadge = `<span class="grade-status-badge graded">Graded</span>`;
        statusClass = 'graded';
        gradeDisplay = `
            <div class="grade-score-display">
                <div class="grade-points">${submission.grade}/${maxPoints}</div>
                <div class="grade-percentage">${percentage}%</div>
                <div class="grade-letter">${letterGrade}</div>
            </div>
        `;

        if (submission.feedback) {
            feedbackSection = `
                <div class="grade-feedback-section">
                    <div class="feedback-header">
                        <i class="fas fa-comment-dots"></i>
                        <strong>Instructor Feedback:</strong>
                    </div>
                    <div class="feedback-text">${submission.feedback}</div>
                </div>
            `;
        }

        if (submission.graded_at) {
            const gradedDate = new Date(submission.graded_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit'
            });
            feedbackSection += `
                <div class="graded-date">
                    <i class="fas fa-clock"></i> Graded on ${gradedDate}
                </div>
            `;
        }
    }

    return `
        <div class="grade-card ${statusClass}">
            <div class="grade-card-header">
                <div class="grade-card-title">
                    <h4><i class="fas fa-file-alt"></i> ${assignment.title}</h4>
                    <p class="grade-card-meta">
                        <i class="fas fa-calendar"></i> Due: ${dueDate}
                        ${submission && submission.submitted_at ? 
                            `<span class="separator">|</span>
                             <i class="fas fa-check"></i> Submitted: ${new Date(submission.submitted_at).toLocaleDateString()}` 
                            : ''}
                    </p>
                </div>
                ${statusBadge}
            </div>

            <div class="grade-card-body">
                ${gradeDisplay}
                ${feedbackSection}
            </div>

            ${!submission ? `
                <div class="grade-card-actions">
                    <button class="turn-in-btn" onclick="turnInAssignment('${assignment.id}')">
                        <i class="fas fa-upload"></i> Turn In Assignment
                    </button>
                </div>
            ` : ''}
        </div>
    `;
}


function getLetterGrade(percentage) {
    if (percentage >= 97) return 'A+';
    if (percentage >= 93) return 'A';
    if (percentage >= 90) return 'A-';
    if (percentage >= 87) return 'B+';
    if (percentage >= 83) return 'B';
    if (percentage >= 80) return 'B-';
    if (percentage >= 77) return 'C+';
    if (percentage >= 73) return 'C';
    if (percentage >= 70) return 'C-';
    if (percentage >= 67) return 'D+';
    if (percentage >= 63) return 'D';
    if (percentage >= 60) return 'D-';
    return 'F';
}

/**
 * View detailed submission (optional feature)
 */
async function viewSubmissionDetails(submissionId) {
    try {
        const { data: submission, error } = await window.supabaseClient
            .from('post_submissions')
            .select(`
                *,
                post:post_id(id, title, points, content, due_date)
            `)
            .eq('id', submissionId)
            .single();

        if (error) throw error;

        alert(`Submission Details:\n\nAssignment: ${submission.post.title}\nGrade: ${submission.grade}/${submission.post.points}\nFeedback: ${submission.feedback || 'No feedback yet'}`);
        
    } catch (error) {
        console.error('Error viewing submission:', error);
        alert('Failed to load submission details');
    }
}

// Make functions globally accessible
window.loadMyGrades = loadMyGrades;
window.viewSubmissionDetails = viewSubmissionDetails;
