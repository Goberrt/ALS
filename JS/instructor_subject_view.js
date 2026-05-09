
if (!window.supabaseClient) {
    window.supabaseClient = window.supabase.createClient(
        'https://bbinymljjtjxkeclqamt.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiaW55bWxqanRqeGtlY2xxYW10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MzQ1OTQsImV4cCI6MjA3MjMxMDU5NH0.bOIwdxUiLd-63V6-_XZxER1PLqohtd1cnwipF6YZjn4'
    );
}

let currentSubject = null;
        let currentUser = null;
        let uploadedFileUrl = null;
        let currentAssignmentId = null;

        document.addEventListener('DOMContentLoaded', async () => {
            const urlParams = new URLSearchParams(window.location.search);
            const subjectId = urlParams.get('id');

            if (!subjectId) {
                window.location.href = '/instructor_subjects';
                return;
            }

            currentUser = JSON.parse(localStorage.getItem('user') || '{}');
            if (!currentUser || !currentUser.username) {
                window.location.href = '/';
                return;
            }

            document.getElementById('instructorName').textContent = `Welcome, ${currentUser.username}`;

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
                    if (page === 'subjects') {
                        window.location.href = '/instructor_subjects';
                        return;
                    }
                    window.location.href = `/instructor_${page}`;
                });
            });

            await loadSubject(subjectId);
            await loadPosts(subjectId);

            // Modal functionality
            const modal = document.getElementById('postModal');
            const newPostBtn = document.getElementById('newPostBtn');
            const closeBtn = document.querySelector('.close');
            const cancelBtn = document.getElementById('cancelPostBtn');
            const postForm = document.getElementById('postForm');
            const postType = document.getElementById('post-type');

            newPostBtn.onclick = () => {
                modal.style.display = 'block';
                postForm.reset();
            };

            closeBtn.onclick = () => modal.style.display = 'none';
            cancelBtn.onclick = () => modal.style.display = 'none';

            window.onclick = (event) => {
                if (event.target === modal) {
                    modal.style.display = 'none';
                }
            };

            // Event delegation for expand buttons
            document.addEventListener('click', function(e) {
                if (e.target.closest('.expand-btn')) {
                    const btn = e.target.closest('.expand-btn');
                    const postId = btn.getAttribute('data-post-id');
                    expandPost(e, postId);
                }
            });

            postType.addEventListener('change', (e) => {
                const dueDateGroup = document.getElementById('dueDateGroup');
                const pointsGroup = document.getElementById('pointsGroup');
                
                if (e.target.value === 'assignment') {
                    dueDateGroup.style.display = 'block';
                    pointsGroup.style.display = 'block';
                } else {
                    dueDateGroup.style.display = 'none';
                    pointsGroup.style.display = 'none';
                }
            });

            postForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await createPost(subjectId);
            });

            // File input listener
            document.getElementById('post-file').addEventListener('change', (e) => {
                const file = e.target.files[0];
                const fileInfo = document.getElementById('fileInfo');
                
                if (file) {
                    const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
                    fileInfo.innerHTML = `<i class="fas fa-paperclip"></i> ${file.name} (${sizeMB} MB)`;
                    fileInfo.style.color = '#667eea';
                } else {
                    fileInfo.innerHTML = '';
                }
            });

            // UPDATED: Tab switching with submissions support
            // UPDATED: Tab switching with classwork and submissions support
let classworkTopics = [];
let classworkPosts = [];

document.querySelectorAll('.subject-nav-item').forEach(item => {
    item.addEventListener('click', async () => {
        document.querySelectorAll('.subject-nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        
        const tab = item.dataset.tab;
        
        // Hide all containers
        document.getElementById('postsContainer').style.display = 'none';
        document.getElementById('submissionListContainer').style.display = 'none';
        document.getElementById('submissionsOverviewContainer').style.display = 'none';
        document.getElementById('emptyState').style.display = 'none';
        document.getElementById('newPostBtn').style.display = 'none';
        
        if (tab === 'classwork') {
            await loadClasswork();
        } else if (tab === 'people') {
            await loadEnrolledStudents();
        } else if (tab === 'stream') {
            document.getElementById('newPostBtn').style.display = 'flex';
            document.getElementById('postsContainer').style.display = 'block';
            await loadPosts(currentSubject.id);
        } else if (tab === 'submissions') {
            document.getElementById('submissionsOverviewContainer').style.display = 'block';
            await loadSubmissionsOverview();
        } else if (tab === 'grades') {
            document.getElementById('postsContainer').style.display = 'block';
            await loadGradesView(); // ← Call the grades view function!
        }
    });
});

// CLASSWORK FUNCTIONS - Add these right after the tab switching code above
async function loadClasswork() {
    const container = document.getElementById('postsContainer');
    container.style.display = 'block';
    
    try {
        await loadClassworkData();
        
        container.innerHTML = `
            <div class="classwork-container">
                <div class="classwork-header">
                    <div class="classwork-actions">
                        <button class="classwork-btn classwork-btn-primary" onclick="openCreateTopicModal()">
                            <i class="fas fa-folder-plus"></i> Create Topic
                        </button>
                        <button class="classwork-btn classwork-btn-primary" onclick="openCreateClassworkModal()">
                            <i class="fas fa-plus"></i> Create Assignment
                        </button>
                    </div>
                    <div class="classwork-filters">
                        <select class="filter-select" onchange="filterClasswork(this.value)">
                            <option value="all">All Types</option>
                            <option value="assignment">Assignments</option>
                            <option value="material">Materials</option>
                            <option value="announcement">Announcements</option>
                        </select>
                        <input type="text" class="search-input" placeholder="Search classwork..." 
                               oninput="searchClasswork(this.value)">
                    </div>
                </div>

                <div class="classwork-stats">
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-tasks"></i></div>
                        <div class="stat-info">
                            <div class="stat-value" id="totalCount">0</div>
                            <div class="stat-label">Total Items</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-file-alt"></i></div>
                        <div class="stat-info">
                            <div class="stat-value" id="assignmentCount">0</div>
                            <div class="stat-label">Assignments</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-book"></i></div>
                        <div class="stat-info">
                            <div class="stat-value" id="materialCount">0</div>
                            <div class="stat-label">Materials</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon"><i class="fas fa-clock"></i></div>
                        <div class="stat-info">
                            <div class="stat-value" id="upcomingCount">0</div>
                            <div class="stat-label">Due Soon</div>
                        </div>
                    </div>
                </div>

                <div class="classwork-topics" id="classworkTopicsContainer"></div>
                <div class="classwork-topic-section" id="noTopicSection"></div>
            </div>
        `;

        renderClassworkTopics();
        updateClassworkStats();
        
    } catch (error) {
        console.error('Error loading classwork:', error);
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-circle"></i>
                <h3>Error loading classwork</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}

async function loadClassworkData() {
    try {
        const topicsResponse = await window.supabaseClient
            .from('classwork_topics')
            .select('*')
            .eq('subject_id', currentSubject.id)
            .order('position', { ascending: true });
        
        classworkTopics = topicsResponse.data || [];

        const postsResponse = await window.supabaseClient
            .from('subject_posts')
            .select('*')
            .eq('subject_id', currentSubject.id)
            .order('created_at', { ascending: false });
        
        classworkPosts = postsResponse.data || [];
        
    } catch (error) {
        console.error('Error loading classwork data:', error);
        classworkTopics = [];
        classworkPosts = [];
    }
}

function renderClassworkTopics() {
    const container = document.getElementById('classworkTopicsContainer');
    const noTopicSection = document.getElementById('noTopicSection');
    
    if (classworkTopics.length === 0 && classworkPosts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-folder-open"></i>
                <h3>No classwork yet</h3>
                <p>Create topics and assignments to organize your class</p>
            </div>
        `;
        noTopicSection.innerHTML = '';
        return;
    }

    container.innerHTML = classworkTopics.map(topic => {
        const topicPosts = classworkPosts.filter(post => post.topic_id === topic.id);
        
        return `
            <div class="classwork-topic-card" data-topic-id="${topic.id}">
                <div class="topic-header">
                    <div class="topic-title">
                        <i class="fas fa-folder"></i>
                        <h3>${topic.name}</h3>
                        <span class="topic-count">${topicPosts.length} items</span>
                    </div>
                    <div class="topic-actions">
                        <button class="icon-btn" onclick="editTopic('${topic.id}')" title="Edit topic">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="icon-btn" onclick="deleteTopic('${topic.id}')" title="Delete topic">
                            <i class="fas fa-trash"></i>
                        </button>
                        <button class="icon-btn" onclick="toggleTopic('${topic.id}')" title="Collapse/Expand">
                            <i class="fas fa-chevron-down"></i>
                        </button>
                    </div>
                </div>
                <div class="topic-content" id="topic-content-${topic.id}">
                    ${topicPosts.length > 0 ? topicPosts.map(post => renderClassworkPost(post)).join('') : 
                        '<p class="empty-topic">No items in this topic yet</p>'}
                </div>
            </div>
        `;
    }).join('');

    const postsWithoutTopic = classworkPosts.filter(post => !post.topic_id);
    
    if (postsWithoutTopic.length > 0) {
        noTopicSection.innerHTML = `
            <div class="classwork-topic-card">
                <div class="topic-header">
                    <div class="topic-title">
                        <i class="fas fa-inbox"></i>
                        <h3>No Topic</h3>
                        <span class="topic-count">${postsWithoutTopic.length} items</span>
                    </div>
                </div>
                <div class="topic-content">
                    ${postsWithoutTopic.map(post => renderClassworkPost(post)).join('')}
                </div>
            </div>
        `;
    } else {
        noTopicSection.innerHTML = '';
    }
}

function renderClassworkPost(post) {
    const postIcon = post.post_type === 'assignment' ? 'fa-file-alt' : 
                    post.post_type === 'material' ? 'fa-book' : 'fa-bullhorn';
    
    const postColor = post.post_type === 'assignment' ? '#667eea' : 
                     post.post_type === 'material' ? '#4caf50' : '#ff9800';
    
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
        <div class="classwork-post-item collapsed" data-post-id="${post.id}" data-post-type="${post.post_type}">
            <div class="classwork-post-icon" style="background: ${postColor};">
                <i class="fas ${postIcon}"></i>
            </div>
            <div class="classwork-post-content">
                <div class="classwork-post-header">
                    <h4>${post.title}</h4>
                    <span class="post-type-badge" style="background: ${postColor}20; color: ${postColor};">
                        ${post.post_type}
                    </span>
                </div>
                ${post.content ? `<p class="post-description">${post.content.substring(0, 100)}${post.content.length > 100 ? '...' : ''}</p>` : ''}
                <div class="classwork-post-meta">
                    <span><i class="fas fa-calendar"></i> ${date}</span>
                    ${post.due_date ? `<span class="due-date"><i class="fas fa-clock"></i> Due: ${new Date(post.due_date).toLocaleDateString()}</span>` : ''}
                    ${post.points ? `<span><i class="fas fa-star"></i> ${post.points} pts</span>` : ''}
                    ${post.file_url ? `<span><i class="fas ${fileIcon}"></i> Attachment</span>` : ''}
                </div>
            </div>
            <div class="classwork-post-actions">
                <button class="icon-btn expand-btn" data-post-id="${post.id}" title="Expand">
                    <i class="fas fa-chevron-down"></i>
                </button>
                <button class="icon-btn" onclick="viewClassworkPost('${post.id}')" title="View">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="icon-btn" onclick="editPost('${post.id}')" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="icon-btn" onclick="moveToTopic('${post.id}')" title="Move to topic">
                    <i class="fas fa-folder-open"></i>
                </button>
                <button class="icon-btn" onclick="duplicatePost('${post.id}')" title="Duplicate">
                    <i class="fas fa-copy"></i>
                </button>
                <button class="icon-btn" onclick="deletePost('${post.id}')" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;
}

function updateClassworkStats() {
    const totalCount = classworkPosts.length;
    const assignmentCount = classworkPosts.filter(p => p.post_type === 'assignment').length;
    const materialCount = classworkPosts.filter(p => p.post_type === 'material').length;
    
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcomingCount = classworkPosts.filter(p => {
        if (!p.due_date) return false;
        const dueDate = new Date(p.due_date);
        return dueDate >= now && dueDate <= weekFromNow;
    }).length;

    document.getElementById('totalCount').textContent = totalCount;
    document.getElementById('assignmentCount').textContent = assignmentCount;
    document.getElementById('materialCount').textContent = materialCount;
    document.getElementById('upcomingCount').textContent = upcomingCount;
}

// Make these functions global for onclick handlers
window.filterClasswork = function(type) {
    const posts = document.querySelectorAll('.classwork-post-item');
    posts.forEach(post => {
        if (type === 'all' || post.dataset.postType === type) {
            post.style.display = 'flex';
        } else {
            post.style.display = 'none';
        }
    });
};

window.searchClasswork = function(query) {
    const posts = document.querySelectorAll('.classwork-post-item');
    const lowerQuery = query.toLowerCase();
    
    posts.forEach(post => {
        const title = post.querySelector('h4').textContent.toLowerCase();
        const description = post.querySelector('.post-description')?.textContent.toLowerCase() || '';
        
        if (title.includes(lowerQuery) || description.includes(lowerQuery)) {
            post.style.display = 'flex';
        } else {
            post.style.display = 'none';
        }
    });
};

window.toggleTopic = function(topicId) {
    const content = document.getElementById(`topic-content-${topicId}`);
    const button = event.target.closest('.icon-btn');
    const icon = button.querySelector('i');
    
    if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.classList.remove('fa-chevron-right');
        icon.classList.add('fa-chevron-down');
    } else {
        content.style.display = 'none';
        icon.classList.remove('fa-chevron-down');
        icon.classList.add('fa-chevron-right');
    }
};

window.openCreateTopicModal = function() {
    let modal = document.getElementById('topicModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'topicModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3>Create Topic</h3>
                    <button class="close" onclick="closeTopicModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="topicForm" onsubmit="saveTopic(event); return false;">
                        <div class="form-group">
                            <label>Topic Name *</label>
                            <input type="text" id="topicName" required placeholder="e.g., Module 1: Basic Literacy">
                        </div>
                        <div class="form-actions">
                            <button type="button" class="btn-secondary" onclick="closeTopicModal()">Cancel</button>
                            <button type="submit" class="btn-primary">Create Topic</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    modal.style.display = 'block';
    document.getElementById('topicForm').reset();
};

window.closeTopicModal = function() {
    document.getElementById('topicModal').style.display = 'none';
};

window.saveTopic = async function(event) {
    event.preventDefault();
    
    const topicName = document.getElementById('topicName').value;
    
    try {
        const { data, error } = await window.supabaseClient
            .from('classwork_topics')
            .insert({
                subject_id: currentSubject.id,
                name: topicName,
                position: classworkTopics.length
            })
            .select()
            .single();
        
        if (error) throw error;
        
        classworkTopics.push(data);
        closeTopicModal();
        renderClassworkTopics();
        alert('Topic created successfully!');
        
    } catch (error) {
        console.error('Error creating topic:', error);
        alert('Failed to create topic: ' + error.message);
    }
};

window.openCreateClassworkModal = function() {
    const modal = document.getElementById('postModal');
    modal.style.display = 'block';
    document.getElementById('postForm').reset();
    
    let topicGroup = document.getElementById('post-topic-group');
    if (!topicGroup) {
        const form = document.getElementById('postForm');
        const postTypeGroup = form.querySelector('.form-group');
        
        topicGroup = document.createElement('div');
        topicGroup.id = 'post-topic-group';
        topicGroup.className = 'form-group';
        topicGroup.innerHTML = `
            <label for="post-topic">Topic (Optional)</label>
            <select id="post-topic">
                <option value="">No Topic</option>
                ${classworkTopics.map(topic => `<option value="${topic.id}">${topic.name}</option>`).join('')}
            </select>
        `;
        
        postTypeGroup.after(topicGroup);
    } else {
        const select = document.getElementById('post-topic');
        select.innerHTML = `
            <option value="">No Topic</option>
            ${classworkTopics.map(topic => `<option value="${topic.id}">${topic.name}</option>`).join('')}
        `;
    }
};

window.editTopic = async function(topicId) {
    const topic = classworkTopics.find(t => t.id === topicId);
    if (!topic) return;
    
    const newName = prompt('Edit topic name:', topic.name);
    if (!newName || newName === topic.name) return;
    
    try {
        await window.supabaseClient
            .from('classwork_topics')
            .update({ name: newName })
            .eq('id', topicId);
        
        topic.name = newName;
        renderClassworkTopics();
    } catch (error) {
        console.error('Error updating topic:', error);
        alert('Failed to update topic');
    }
};

window.deleteTopic = async function(topicId) {
    if (!confirm('Delete this topic? Posts in this topic will be moved to "No Topic".')) return;
    
    try {
        await window.supabaseClient
            .from('subject_posts')
            .update({ topic_id: null })
            .eq('topic_id', topicId);
        
        await window.supabaseClient
            .from('classwork_topics')
            .delete()
            .eq('id', topicId);
        
        classworkTopics = classworkTopics.filter(t => t.id !== topicId);
        await loadClassworkData();
        renderClassworkTopics();
        
    } catch (error) {
        console.error('Error deleting topic:', error);
        alert('Failed to delete topic');
    }
};

window.moveToTopic = async function(postId) {
    const post = classworkPosts.find(p => p.id === postId);
    if (!post) return;
    
    const topicSelect = prompt(
        'Enter topic number to move to:\n' + 
        classworkTopics.map((t, i) => `${i + 1}. ${t.name}`).join('\n') +
        '\n0. No Topic'
    );
    
    if (topicSelect === null) return;
    
    const topicIndex = parseInt(topicSelect);
    const newTopicId = topicIndex === 0 ? null : classworkTopics[topicIndex - 1]?.id;
    
    try {
        await window.supabaseClient
            .from('subject_posts')
            .update({ topic_id: newTopicId })
            .eq('id', postId);
        
        post.topic_id = newTopicId;
        renderClassworkTopics();
    } catch (error) {
        console.error('Error moving post:', error);
        alert('Failed to move post');
    }
};

window.duplicatePost = async function(postId) {
    const post = classworkPosts.find(p => p.id === postId);
    if (!post) return;
    
    if (!confirm(`Duplicate "${post.title}"?`)) return;
    
    try {
        const newPost = {
            ...post,
            id: undefined,
            title: `${post.title} (Copy)`,
            created_at: new Date().toISOString()
        };
        
        delete newPost.id;
        
        const { data, error } = await window.supabaseClient
            .from('subject_posts')
            .insert(newPost)
            .select()
            .single();
        
        if (error) throw error;
        
        classworkPosts.unshift(data);
        renderClassworkTopics();
        updateClassworkStats();
        alert('Post duplicated successfully!');
        
    } catch (error) {
        console.error('Error duplicating post:', error);
        alert('Failed to duplicate post');
    }
};

window.viewClassworkPost = function(postId) {
    const post = classworkPosts.find(p => p.id === postId);
    if (post && post.post_type === 'assignment') {
        viewAssignmentSubmissions(postId);
    } else {
        alert('Post details view - coming soon!');
    }
};
            
        });
        
        



        async function loadSubject(subjectId) {
            const { data, error } = await window.supabaseClient
                .from('subjects')
                .select('*')
                .eq('id', subjectId)
                .single();

            if (error || !data) {
                alert('Subject not found');
                window.location.href = '/instructor_subjects';
                return;
            }

            currentSubject = data;
            document.getElementById('subjectName').textContent = data.subject_name;
            document.getElementById('subjectCode').textContent = data.subject_code;

            await displayClassCode();
        }

        // UPDATED: Load posts with submission stats
        async function loadPosts(subjectId) {
            const { data: posts, error } = await window.supabaseClient
                .from('subject_posts')
                .select(`
                    *,
                    instructor:instructor_id(username, first_name, last_name)
                `)
                .eq('subject_id', subjectId)
                .order('created_at', { ascending: false });

            const container = document.getElementById('postsContainer');
            const emptyState = document.getElementById('emptyState');

            if (error || !posts || posts.length === 0) {
                container.innerHTML = '';
                emptyState.style.display = 'block';
                document.getElementById('postCount').textContent = '0';
                return;
            }

            emptyState.style.display = 'none';
            document.getElementById('postCount').textContent = posts.length;

            // NEW: Load submission stats for assignments
            const postsWithStats = await Promise.all(posts.map(async post => {
                if (post.post_type === 'assignment') {
                    const stats = await getSubmissionStats(post.id);
                    return { ...post, submissionStats: stats };
                }
                return post;
            }));

            container.innerHTML = postsWithStats.map(post => {
                const postIcon = post.post_type === 'assignment' ? 'fa-file-alt' : 
                               post.post_type === 'material' ? 'fa-book' : 'fa-bullhorn';
                
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

                // NEW: Build submission stats section for assignments
                let submissionStatsHTML = '';
                if (post.post_type === 'assignment' && post.submissionStats) {
                    const stats = post.submissionStats;
                    const percentage = stats.total > 0 ? Math.round((stats.submitted / stats.total) * 100) : 0;
                    
                    submissionStatsHTML = `
                        <div class="submission-stats">
                            <div class="submission-stats-header">
                                <h4><i class="fas fa-chart-bar"></i> Submission Status</h4>
                                <span class="submission-percentage">${stats.submitted}/${stats.total} (${percentage}%)</span>
                            </div>
                            
                            <div class="progress-bar-container">
                                <div class="progress-bar-fill" style="width: ${percentage}%"></div>
                            </div>
                            
                            <div class="submission-breakdown">
                                <div class="stat-item">
                                    <span class="stat-badge on-time">✅ On-time: ${stats.onTime}</span>
                                </div>
                                <div class="stat-item">
                                    <span class="stat-badge late">⚠️ Late: ${stats.late}</span>
                                </div>
                                <div class="stat-item">
                                    <span class="stat-badge missing">❌ Missing: ${stats.missing}</span>
                                </div>
                                <div class="stat-item">
                                    <span class="stat-badge graded">📊 Graded: ${stats.graded}/${stats.submitted}</span>
                                </div>
                            </div>

                            <button class="view-submissions-btn" onclick="viewAssignmentSubmissions('${post.id}')">
                                <i class="fas fa-eye"></i> View All Submissions
                            </button>
                        </div>
                    `;
                }

                return `
                    <div class="post-card">
                        <div class="post-header">
                            <div class="post-icon">
                                <i class="fas ${postIcon}"></i>
                            </div>
                            <div class="post-info">
                                <h3>${post.title}</h3>
                                <p>Posted on ${date}</p>
                            </div>
                        </div>
                        ${post.content ? `<div class="post-content">${post.content}</div>` : ''}
                        ${post.file_url ? `
                            <a href="${post.file_url}" target="_blank" download 
                               style="display: inline-flex; align-items: center; gap: 0.5rem; 
                                      padding: 0.75rem 1rem; background: #f0f0f0; 
                                      border-radius: 8px; text-decoration: none; 
                                      color: #333; font-size: 0.875rem; margin: 0.5rem 0;">
                                <i class="fas ${fileIcon}" style="color: #667eea;"></i>
                                <span>Download Attachment</span>
                                <i class="fas fa-download" style="margin-left: auto;"></i>
                            </a>
                        ` : ''}
                        ${post.due_date ? `
                            <div style="color: #f44336; font-size: 0.875rem; margin: 0.5rem 0;">
                                <i class="fas fa-clock"></i> Due: ${new Date(post.due_date).toLocaleString()}
                            </div>
                        ` : ''}
                        ${post.points ? `
                            <div style="color: #667eea; font-size: 0.875rem; margin: 0.5rem 0;">
                                <i class="fas fa-star"></i> ${post.points} points
                            </div>
                        ` : ''}
                        ${post.external_link ? `
                            <a href="${post.external_link}" target="_blank" 
                               style="color: #667eea; text-decoration: none; font-size: 0.875rem;">
                                <i class="fas fa-external-link-alt"></i> View Link
                            </a>
                        ` : ''}
                        
                        ${submissionStatsHTML}
                        
                        <div class="post-footer">
                            <div class="post-stats">
                                <span><i class="fas fa-comment"></i> 0 comments</span>
                            </div>
                            <div class="post-actions">
                                <button class="post-action-btn" onclick="editPost('${post.id}')">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="post-action-btn" onclick="deletePost('${post.id}')">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

            // Animate progress bars
            setTimeout(() => {
                document.querySelectorAll('.progress-bar-fill').forEach(bar => {
                    const width = bar.style.width;
                    bar.style.width = '0%';
                    setTimeout(() => bar.style.width = width, 100);
                });
            }, 100);
        }

        // NEW: Get submission statistics for an assignment
        async function getSubmissionStats(assignmentId) {
            try {
                const { data: enrollments } = await window.supabaseClient
                    .from('subject_enrollments')
                    .select('student_id')
                    .eq('subject_id', currentSubject.id)
                    .eq('status', 'active');

                const totalStudents = enrollments ? enrollments.length : 0;

                const { data: submissions } = await window.supabaseClient
                    .from('post_submissions')
                    .select('*')
                    .eq('post_id', assignmentId);

                const submittedCount = submissions ? submissions.length : 0;
                
                const { data: assignment } = await window.supabaseClient
                    .from('subject_posts')
                    .select('due_date')
                    .eq('id', assignmentId)
                    .single();

                const dueDate = assignment?.due_date ? new Date(assignment.due_date) : null;

                let onTimeCount = 0;
                let lateCount = 0;
                let gradedCount = 0;

                if (submissions && dueDate) {
                    submissions.forEach(sub => {
                        const submittedAt = new Date(sub.submitted_at);
                        if (submittedAt <= dueDate) {
                            onTimeCount++;
                        } else {
                            lateCount++;
                        }
                        if (sub.grade !== null) {
                            gradedCount++;
                        }
                    });
                } else if (submissions) {
                    onTimeCount = submittedCount;
                    submissions.forEach(sub => {
                        if (sub.grade !== null) gradedCount++;
                    });
                }

                return {
                    total: totalStudents,
                    submitted: submittedCount,
                    missing: totalStudents - submittedCount,
                    onTime: onTimeCount,
                    late: lateCount,
                    graded: gradedCount
                };
            } catch (error) {
                console.error('Error getting submission stats:', error);
                return {
                    total: 0,
                    submitted: 0,
                    missing: 0,
                    onTime: 0,
                    late: 0,
                    graded: 0
                };
            }
        }

        // NEW: View assignment submissions (detailed list)
        async function viewAssignmentSubmissions(assignmentId) {
            currentAssignmentId = assignmentId;
            await loadSubmissionsList(assignmentId);
            
            document.getElementById('postsContainer').style.display = 'none';
            document.getElementById('submissionsOverviewContainer').style.display = 'none';
            document.getElementById('submissionListContainer').style.display = 'block';
            document.getElementById('newPostBtn').style.display = 'none';
        }

        // NEW: Load detailed submission list
        async function loadSubmissionsList(assignmentId) {
            try {
                const { data: assignment } = await window.supabaseClient
                    .from('subject_posts')
                    .select('*')
                    .eq('id', assignmentId)
                    .single();

                const { data: enrollments } = await window.supabaseClient
                    .from('subject_enrollments')
                    .select(`
                        student_id,
                        student:student_id(id, username, first_name, last_name, email)
                    `)
                    .eq('subject_id', currentSubject.id)
                    .eq('status', 'active');

                const { data: submissions } = await window.supabaseClient
                    .from('post_submissions')
                    .select('*')
                    .eq('post_id', assignmentId);

                const submissionMap = {};
                if (submissions) {
                    submissions.forEach(sub => {
                        submissionMap[sub.student_id] = sub;
                    });
                }

                const studentList = enrollments.map(e => {
                    const student = e.student;
                    const submission = submissionMap[student.id];
                    
                    return {
                        student,
                        submission,
                        hasSubmitted: !!submission,
                        isLate: submission && assignment.due_date && 
                               new Date(submission.submitted_at) > new Date(assignment.due_date),
                        isGraded: submission && submission.grade !== null
                    };
                });

                renderSubmissionList(assignment, studentList);
                
            } catch (error) {
                console.error('Error loading submissions:', error);
                alert('Failed to load submissions');
            }
        }

        // NEW: Render submission list view
        function renderSubmissionList(assignment, studentList) {
            const container = document.getElementById('submissionListContent');
            
            const stats = {
                total: studentList.length,
                submitted: studentList.filter(s => s.hasSubmitted).length,
                pending: studentList.filter(s => !s.hasSubmitted).length,
                late: studentList.filter(s => s.isLate).length,
                graded: studentList.filter(s => s.isGraded).length,
                needReview: studentList.filter(s => s.hasSubmitted && !s.isGraded).length
            };

            container.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <div>
                        <h2 style="font-size: 1.5rem; color: #333; margin-bottom: 0.5rem;">
                            ${assignment.title} - Submissions
                        </h2>
                        <p style="color: #999; font-size: 0.875rem;">
                            Due: ${new Date(assignment.due_date).toLocaleString()} | ${assignment.points} points
                        </p>
                    </div>
                    <button onclick="backToStream()" style="padding: 0.5rem 1rem; border: none; background: #f0f0f0; border-radius: 6px; cursor: pointer;">
                        <i class="fas fa-arrow-left"></i> Back
                    </button>
                </div>

                <div class="submission-filters">
                    <button class="filter-btn active" onclick="filterSubmissions('all', this)">
                        All <span class="filter-count">${stats.total}</span>
                    </button>
                    <button class="filter-btn" onclick="filterSubmissions('submitted', this)">
                        Submitted <span class="filter-count">${stats.submitted}</span>
                    </button>
                    <button class="filter-btn" onclick="filterSubmissions('pending', this)">
                        Pending <span class="filter-count">${stats.pending}</span>
                    </button>
                    <button class="filter-btn" onclick="filterSubmissions('late', this)">
                        Late <span class="filter-count">${stats.late}</span>
                    </button>
                    <button class="filter-btn" onclick="filterSubmissions('graded', this)">
                        Graded <span class="filter-count">${stats.graded}</span>
                    </button>
                    <button class="filter-btn" onclick="filterSubmissions('need-review', this)">
                        Need Review <span class="filter-count">${stats.needReview}</span>
                    </button>
                </div>

                <div class="bulk-actions">
                    <button class="bulk-action-btn" onclick="downloadAllSubmissions()">
                        <i class="fas fa-download"></i> Download All
                    </button>
                    <button class="bulk-action-btn" onclick="emailNonSubmitters()">
                        <i class="fas fa-envelope"></i> Email Non-Submitters
                    </button>
                    <button class="bulk-action-btn" onclick="exportGrades()">
                        <i class="fas fa-file-excel"></i> Export Grades
                    </button>
                </div>

                <div id="studentSubmissionsList">
                    ${studentList.map(s => renderStudentSubmissionCard(s)).join('')}
                </div>
            `;
        }

        // NEW: Render individual student submission card
        function renderStudentSubmissionCard({ student, submission, hasSubmitted, isLate, isGraded }) {
            const initial = student.first_name ? student.first_name.charAt(0).toUpperCase() : 'S';
            const name = `${student.first_name || ''} ${student.last_name || ''}`.trim() || student.username;
            
            let statusBadge = '';
            let statusClass = 'missing';
            
            if (isGraded) {
                statusBadge = '✅ GRADED';
                statusClass = 'graded';
            } else if (isLate) {
                statusBadge = '⚠️ LATE';
                statusClass = 'late';
            } else if (hasSubmitted) {
                statusBadge = '✅ SUBMITTED';
                statusClass = 'submitted';
            } else {
                statusBadge = '❌ MISSING';
                statusClass = 'missing';
            }

            let detailsHTML = '';
            if (hasSubmitted && submission) {
                const fileName = submission.file_url ? submission.file_url.split('/').pop() : 'No file';
                const submittedDate = new Date(submission.submitted_at).toLocaleString();
                
                detailsHTML = `
                    <div class="submission-details">
                        <div class="submission-detail-item">
                            <i class="fas fa-file"></i>
                            <span>${fileName}</span>
                        </div>
                        <div class="submission-detail-item">
                            <i class="fas fa-clock"></i>
                            <span>${submittedDate}</span>
                        </div>
                        ${submission.grade !== null ? `
                            <div class="submission-detail-item">
                                <i class="fas fa-star" style="color: #ffc107;"></i>
                                <span>Grade: ${submission.grade}/100</span>
                            </div>
                        ` : ''}
                    </div>
                    ${submission.submission_text ? `
                        <div style="background: #f9f9f9; padding: 0.75rem; border-radius: 8px; font-size: 0.875rem; color: #666; margin: 1rem 0;">
                            <i class="fas fa-comment"></i> "${submission.submission_text}"
                        </div>
                    ` : ''}
                `;
            } else {
                detailsHTML = `
                    <div class="submission-details">
                        <div class="submission-detail-item">
                            <i class="fas fa-times-circle" style="color: #c62828;"></i>
                            <span>Not submitted</span>
                        </div>
                    </div>
                `;
            }

            let actionsHTML = '';
            if (hasSubmitted) {
                actionsHTML = `
                    <div class="submission-actions">
                        <button class="action-btn action-btn-secondary" onclick="downloadSubmission('${submission.file_url}')">
                            <i class="fas fa-download"></i> Download
                        </button>
                        <button class="action-btn action-btn-primary" onclick="gradeSubmission('${submission.id}')">
                            <i class="fas fa-pencil-alt"></i> ${isGraded ? 'Re-grade' : 'Grade Now'}
                        </button>
                    </div>
                `;
            } else {
                actionsHTML = `
                    <div class="submission-actions">
                        <button class="action-btn action-btn-primary" onclick="sendReminder('${student.id}')">
                            <i class="fas fa-envelope"></i> Send Reminder
                        </button>
                    </div>
                `;
            }

            return `
                <div class="student-submission-card" data-status="${statusClass}">
                    <div class="student-header">
                        <div class="student-info">
                            <div class="student-avatar">${initial}</div>
                            <div class="student-details">
                                <h4>${name}</h4>
                                <p>${student.email || student.username}</p>
                            </div>
                        </div>
                        <span class="submission-status-badge ${statusClass}">
                            ${statusBadge}
                        </span>
                    </div>
                    ${detailsHTML}
                    ${actionsHTML}
                </div>
            `;
        }

        // NEW: Load submissions overview (all assignments)
        async function loadSubmissionsOverview() {
            try {
                const { data: assignments } = await window.supabaseClient
                    .from('subject_posts')
                    .select('*')
                    .eq('subject_id', currentSubject.id)
                    .eq('post_type', 'assignment')
                    .order('due_date', { ascending: false });

                if (!assignments || assignments.length === 0) {
                    document.getElementById('assignmentOverviewList').innerHTML = `
                        <div class="empty-state">
                            <i class="fas fa-inbox"></i>
                            <h3>No assignments yet</h3>
                            <p>Create an assignment to start tracking submissions</p>
                        </div>
                    `;
                    return;
                }

                const assignmentsWithStats = await Promise.all(
                    assignments.map(async assignment => {
                        const stats = await getSubmissionStats(assignment.id);
                        return { ...assignment, stats };
                    })
                );

                document.getElementById('assignmentOverviewList').innerHTML = assignmentsWithStats.map(assignment => {
                    const percentage = assignment.stats.total > 0 
                        ? Math.round((assignment.stats.submitted / assignment.stats.total) * 100) 
                        : 0;
                    
                    const dueDate = assignment.due_date 
                        ? new Date(assignment.due_date).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                        })
                        : 'No due date';

                    return `
                        <div class="assignment-overview-card">
                            <div class="assignment-overview-header">
                                <div class="assignment-overview-title">
                                    <h3>📝 ${assignment.title}</h3>
                                    <p>Due: ${dueDate} | ${assignment.points || 0} points</p>
                                </div>
                            </div>
                            
                            <div class="assignment-overview-stats" style="background: white; border-radius: 8px; padding: 1rem; margin: 1rem 0;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 0.75rem;">
                                    <span style="font-weight: 600; color: #333;">Submission Progress</span>
                                    <span style="font-weight: 700; color: #667eea;">${assignment.stats.submitted}/${assignment.stats.total} (${percentage}%)</span>
                                </div>
                                
                                <div class="progress-bar-container">
                                    <div class="progress-bar-fill" style="width: ${percentage}%"></div>
                                </div>
                                
                                <div style="display: flex; gap: 1.5rem; margin-top: 1rem; font-size: 0.875rem; flex-wrap: wrap;">
                                    <span><span class="stat-badge on-time">✅ ${assignment.stats.onTime}</span> On-time</span>
                                    <span><span class="stat-badge late">⚠️ ${assignment.stats.late}</span> Late</span>
                                    <span><span class="stat-badge missing">❌ ${assignment.stats.missing}</span> Missing</span>
                                    <span><span class="stat-badge graded">📊 ${assignment.stats.graded}</span> Graded</span>
                                </div>
                            </div>
                            
                            <button class="view-submissions-btn" onclick="viewAssignmentSubmissions('${assignment.id}')">
                                <i class="fas fa-eye"></i> View Submissions
                            </button>
                        </div>
                    `;
                }).join('');

                setTimeout(() => {
                    document.querySelectorAll('.progress-bar-fill').forEach(bar => {
                        const width = bar.style.width;
                        bar.style.width = '0%';
                        setTimeout(() => bar.style.width = width, 100);
                    });
                }, 100);

            } catch (error) {
                console.error('Error loading submissions overview:', error);
            }
        }

        // NEW: Helper functions
        function backToStream() {
            document.getElementById('postsContainer').style.display = 'block';
            document.getElementById('submissionListContainer').style.display = 'none';
            document.getElementById('submissionsOverviewContainer').style.display = 'none';
            document.getElementById('newPostBtn').style.display = 'flex';
        }

        function filterSubmissions(filter, btn) {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const cards = document.querySelectorAll('.student-submission-card');
            cards.forEach(card => {
                const status = card.dataset.status;
                
                if (filter === 'all') {
                    card.style.display = 'block';
                } else if (filter === 'submitted') {
                    card.style.display = status !== 'missing' ? 'block' : 'none';
                } else if (filter === 'pending') {
                    card.style.display = status === 'missing' ? 'block' : 'none';
                } else if (filter === 'late') {
                    card.style.display = status === 'late' ? 'block' : 'none';
                } else if (filter === 'graded') {
                    card.style.display = status === 'graded' ? 'block' : 'none';
                } else if (filter === 'need-review') {
                    card.style.display = (status === 'submitted' || status === 'late') ? 'block' : 'none';
                }
            });
        }

        function filterAssignments(filter) {
            console.log('Filtering assignments by:', filter);
            // TODO: Implement assignment filtering in overview
        }

        function downloadSubmission(fileUrl) {
            if (fileUrl) {
                window.open(fileUrl, '_blank');
            }
        }

        function gradeSubmission(submissionId) {
            alert('Opening grading modal...\n\nThis will be Phase 3!');
            // TODO: Phase 3 - Open grading modal
        }

        function sendReminder(studentId) {
            alert(`Sending reminder email to student...\n\nStudent ID: ${studentId}`);
            // TODO: Implement email reminder
        }

        function downloadAllSubmissions() {
            alert('Downloading all submissions as ZIP...\n\nThis feature will create a ZIP file with all submitted files.');
            // TODO: Implement bulk download
        }

        function emailNonSubmitters() {
            alert('Sending reminder emails to all non-submitters...');
            // TODO: Implement bulk email
        }

        function exportGrades() {
            alert('Exporting grades to Excel...');
            // TODO: Implement Excel export
        }

        // EXISTING FUNCTIONS (keep these as they are)
        async function createPost(subjectId) {
            const submitBtn = document.getElementById('submitPostBtn');
            const originalBtnText = submitBtn.innerHTML;
            
            try {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
                
                const fileInput = document.getElementById('post-file');
                let fileUrl = null;
                
                if (fileInput.files.length > 0) {
                    console.log('Uploading file:', fileInput.files[0].name);
                    fileUrl = await uploadFile(fileInput.files[0], subjectId);
                    console.log('File uploaded successfully:', fileUrl);
                }
                
                const formData = new FormData();
                formData.append('subject_id', subjectId);
                formData.append('instructor_id', currentUser.id);
                formData.append('post_type', document.getElementById('post-type').value);
                formData.append('title', document.getElementById('post-title').value);
                
                const content = document.getElementById('post-content').value;
                if (content && content.trim()) {
                    formData.append('content', content);
                }
                
                const externalLink = document.getElementById('post-link').value;
                if (externalLink && externalLink.trim()) {
                    formData.append('external_link', externalLink);
                }
                
                const dueDate = document.getElementById('post-due-date').value;
                if (dueDate) {
                    formData.append('due_date', dueDate);
                }
                
                const points = document.getElementById('post-points').value;
                if (points) {
                    formData.append('points', parseInt(points));
                }
                
                if (fileUrl) {
                    formData.append('file_url', fileUrl);
                }
                
                console.log('Creating post...');
                
                const response = await fetch('/api/subject-posts', {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                console.log('Server response:', result);
                
                if (!response.ok) {
                    const errorMessage = result.detail || result.message || JSON.stringify(result);
                    console.error('Server error:', errorMessage);
                    throw new Error(errorMessage);
                }
                
                alert('Post created successfully!');
                document.getElementById('postModal').style.display = 'none';
                document.getElementById('postForm').reset();
                document.getElementById('fileInfo').innerHTML = '';
                uploadedFileUrl = null;
                
                await loadPosts(subjectId);
                
            } catch (error) {
                console.error('Error creating post:', error);
                alert('Failed to create post: ' + error.message);
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
            }
        }

        async function uploadFile(file, subjectId) {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('subject_id', subjectId);
            formData.append('instructor_id', currentUser.id);
            
            const uploadProgress = document.getElementById('uploadProgress');
            const progressBar = document.getElementById('progressBar');
            const progressText = document.getElementById('progressText');
            
            uploadProgress.style.display = 'block';
            progressText.textContent = 'Uploading file...';
            progressBar.style.width = '0%';
            
            try {
                console.log('Uploading file to /api/upload-file');
                console.log('File details:', {
                    name: file.name,
                    size: file.size,
                    type: file.type
                });
                
                const response = await fetch('/api/upload-file', {
                    method: 'POST',
                    body: formData
                });
                
                console.log('Upload response status:', response.status);
                
                const result = await response.json();
                console.log('Upload result:', result);
                
                if (!response.ok) {
                    const errorMessage = result.detail || result.message || JSON.stringify(result);
                    throw new Error(errorMessage);
                }
                
                progressBar.style.width = '100%';
                progressText.textContent = 'Upload complete!';
                progressText.style.color = '#4caf50';
                
                setTimeout(() => {
                    uploadProgress.style.display = 'none';
                    progressBar.style.width = '0%';
                    progressText.textContent = '';
                    progressText.style.color = '#666';
                }, 2000);
                
                return result.file_url;
                
            } catch (error) {
                console.error('File upload error:', error);
                uploadProgress.style.display = 'none';
                progressText.textContent = 'Upload failed!';
                progressText.style.color = '#f44336';
                throw new Error('File upload failed: ' + error.message);
            }
        }

        async function editPost(postId) {
            console.log('Edit post:', postId);
        }

        async function deletePost(postId) {
            if (!confirm('Are you sure you want to delete this post?')) return;

            try {
                const response = await fetch(`/api/subject-posts/${postId}`, {
                    method: 'DELETE'
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.detail || 'Failed to delete post');
                }

                await loadPosts(currentSubject.id);
                
            } catch (error) {
                console.error('Error deleting post:', error);
                alert('Failed to delete post: ' + error.message);
            }
        }

        async function displayClassCode() {
            if (!currentSubject) return;

            if (!currentSubject.class_code) {
                await generateClassCode();
                return;
            }

            const sidebar = document.querySelector('.sidebar-area');
            const classCodeWidget = document.createElement('div');
            classCodeWidget.className = 'sidebar-widget class-code-widget';
            classCodeWidget.innerHTML = `
                <div class="class-code-header">
                    <h3><i class="fas fa-key"></i> Class Code</h3>
                </div>
                <div class="class-code-display">
                    <div class="class-code-label">Share this code with students</div>
                    <div class="class-code-value" id="codeDisplay">${currentSubject.class_code}</div>
                </div>
                <div class="code-actions">
                    <button class="code-btn code-btn-copy" onclick="copyClassCode()">
                        <i class="fas fa-copy"></i> Copy
                    </button>
                    <button class="code-btn code-btn-regenerate" onclick="regenerateCode()">
                        <i class="fas fa-sync-alt"></i> Regenerate
                    </button>
                    <button class="code-btn code-btn-toggle ${currentSubject.allow_enrollment ? '' : 'disabled'}" 
                            onclick="toggleEnrollment()" id="toggleBtn">
                        <i class="fas fa-${currentSubject.allow_enrollment ? 'lock-open' : 'lock'}"></i>
                        ${currentSubject.allow_enrollment ? 'Open' : 'Closed'}
                    </button>
                </div>
                <div class="enrollment-stats">
                    <span><i class="fas fa-users"></i> <span id="enrolledCount">0</span> enrolled</span>
                </div>
            `;

            sidebar.insertBefore(classCodeWidget, sidebar.firstChild);
            await loadEnrolledCount();
        }

        async function generateClassCode() {
            const code = generateRandomCode(8);
            
            const { data, error } = await window.supabaseClient
                .from('subjects')
                .update({ 
                    class_code: code,
                    allow_enrollment: true 
                })
                .eq('id', currentSubject.id);

            if (!error) {
                currentSubject.class_code = code;
                currentSubject.allow_enrollment = true;
                await displayClassCode();
            }
        }

        function generateRandomCode(length) {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let code = '';
            for (let i = 0; i < length; i++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return code;
        }

        async function copyClassCode() {
            const code = currentSubject.class_code;
            try {
                await navigator.clipboard.writeText(code);
                
                const btn = event.target.closest('.code-btn-copy');
                const originalHTML = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                btn.style.background = '#4caf50';
                btn.style.color = 'white';
                
                setTimeout(() => {
                    btn.innerHTML = originalHTML;
                    btn.style.background = '';
                    btn.style.color = '';
                }, 2000);
            } catch (err) {
                alert('Failed to copy code');
            }
        }

        async function regenerateCode() {
            if (!confirm('Are you sure? Students will need the new code to enroll.')) {
                return;
            }

            const newCode = generateRandomCode(8);
            
            const { data, error } = await window.supabaseClient
                .from('subjects')
                .update({ class_code: newCode })
                .eq('id', currentSubject.id);

            if (error) {
                alert('Failed to regenerate code');
                return;
            }

            currentSubject.class_code = newCode;
            document.getElementById('codeDisplay').textContent = newCode;
            
            const btn = event.target.closest('.code-btn-regenerate');
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i> Updated!';
            
            setTimeout(() => {
                btn.innerHTML = originalHTML;
            }, 2000);
        }

        async function toggleEnrollment() {
            const newStatus = !currentSubject.allow_enrollment;
            
            const { data, error } = await window.supabaseClient
                .from('subjects')
                .update({ allow_enrollment: newStatus })
                .eq('id', currentSubject.id);

            if (error) {
                alert('Failed to update enrollment status');
                return;
            }

            currentSubject.allow_enrollment = newStatus;
            const btn = document.getElementById('toggleBtn');
            
            if (newStatus) {
                btn.classList.remove('disabled');
                btn.innerHTML = '<i class="fas fa-lock-open"></i> Open';
            } else {
                btn.classList.add('disabled');
                btn.innerHTML = '<i class="fas fa-lock"></i> Closed';
            }
        }

        async function loadEnrolledCount() {
            const { data, error } = await window.supabaseClient
                .from('subject_enrollments')
                .select('id')
                .eq('subject_id', currentSubject.id)
                .eq('status', 'active');

            if (!error && data) {
                document.getElementById('enrolledCount').textContent = data.length;
                document.getElementById('studentCount').textContent = data.length;
            }
        }

        async function loadEnrolledStudents() {
            const { data: enrollments, error } = await window.supabaseClient
                .from('subject_enrollments')
                .select(`
                    id,
                    enrolled_at,
                    student:student_id(
                        id,
                        username,
                        first_name,
                        last_name,
                        email
                    )
                `)
                .eq('subject_id', currentSubject.id)
                .eq('status', 'active')
                .order('enrolled_at', { ascending: false });

            if (error || !enrollments) return;

            const container = document.getElementById('postsContainer');
            container.style.display = 'block';
            container.innerHTML = `
                <div style="background: white; border-radius: 12px; padding: 1.5rem;">
                    <h3 style="margin-bottom: 1rem;">Enrolled Students (${enrollments.length})</h3>
                    ${enrollments.map(e => {
                        const student = e.student;
                        const initial = student.first_name ? student.first_name.charAt(0).toUpperCase() : 'S';
                        const name = `${student.first_name || ''} ${student.last_name || ''}`.trim() || student.username;
                        
                        return `
                            <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; border-bottom: 1px solid #eee;">
                                <div style="display: flex; align-items: center; gap: 1rem;">
                                    <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #667eea, #764ba2); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600;">
                                        ${initial}
                                    </div>
                                    <div>
                                        <div style="font-weight: 500;">${name}</div>
                                        <div style="font-size: 0.875rem; color: #999;">${student.email || student.username}</div>
                                    </div>
                                </div>
                                <button onclick="unenrollStudent('${e.id}')" style="background: #f44336; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer;">
                                    <i class="fas fa-user-minus"></i> Remove
                                </button>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        async function unenrollStudent(enrollmentId) {
            if (!confirm('Are you sure you want to remove this student?')) return;

            const { error } = await window.supabaseClient
                .from('subject_enrollments')
                .delete()
                .eq('id', enrollmentId);

            if (error) {
                alert('Failed to remove student');
                return;
            }

            loadEnrolledStudents();
            loadEnrolledCount();
        }
        async function unenrollStudent(enrollmentId) {
            if (!confirm('Are you sure you want to remove this student?')) return;

            const { error } = await window.supabaseClient
                .from('subject_enrollments')
                .delete()
                .eq('id', enrollmentId);

            if (error) {
                alert('Failed to remove student');
                return;
            }

            loadEnrolledStudents();
            loadEnrolledCount();
        }
        
        // ==================== GRADING SYSTEM FUNCTIONS (NEW) ====================
        
        // Global variable to track current submission being graded
        let currentSubmissionData = null;

        /**
         * Open the grading modal for a specific submission
         */
        async function gradeSubmission(submissionId) {
            try {
                // Fetch submission details with student and assignment info
                const { data: submission, error: subError } = await window.supabaseClient
                    .from('post_submissions')
                    .select(`
                        *,
                        student:student_id(id, username, first_name, last_name, email),
                        post:post_id(id, title, points, content, file_url, due_date)
                    `)
                    .eq('id', submissionId)
                    .single();

                if (subError) throw subError;

                currentSubmissionData = submission;

                // Build the modal content
                const student = submission.student;
                const assignment = submission.post;
                const studentName = `${student.first_name || ''} ${student.last_name || ''}`.trim() || student.username;
                const initial = student.first_name ? student.first_name.charAt(0).toUpperCase() : 'S';
                
                const submittedDate = new Date(submission.submitted_at).toLocaleString();
                const isLate = assignment.due_date && new Date(submission.submitted_at) > new Date(assignment.due_date);
                
                const maxPoints = assignment.points || 100;

                // Get file name
                let submittedFileName = 'No file attached';
                if (submission.file_url) {
                    submittedFileName = submission.file_url.split('/').pop();
                }

                const modalContent = document.getElementById('gradeModalContent');
                modalContent.innerHTML = `
                    <div class="grade-modal-student-header">
                        <div class="student-info-large">
                            <div class="student-avatar-large">${initial}</div>
                            <div>
                                <h3>${studentName}</h3>
                                <p>${student.email || student.username}</p>
                            </div>
                        </div>
                        <div class="submission-meta-large">
                            <div class="meta-item">
                                <i class="fas fa-clock"></i>
                                <span>Submitted: ${submittedDate}</span>
                            </div>
                            ${isLate ? `
                                <div class="meta-item late-indicator">
                                    <i class="fas fa-exclamation-triangle"></i>
                                    <span>LATE SUBMISSION</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>

                    <div class="grade-section-divider"></div>

                    <div class="assignment-info-section">
                        <h4><i class="fas fa-file-alt"></i> ${assignment.title}</h4>
                        <p style="color: #666; margin: 0.5rem 0;">${assignment.content || 'No description'}</p>
                        <div style="color: #667eea; font-weight: 600; margin-top: 0.5rem;">
                            Maximum Points: ${maxPoints}
                        </div>
                    </div>

                    <div class="grade-section-divider"></div>

                    <div class="submission-content-section">
                        <h4><i class="fas fa-paper-plane"></i> Student Submission</h4>
                        
                        ${submission.submission_text ? `
                            <div class="submission-text-display">
                                <strong>Text Response:</strong>
                                <p>${submission.submission_text}</p>
                            </div>
                        ` : ''}
                        
                        ${submission.file_url ? `
                            <div class="submission-file-display">
                                <i class="fas fa-file"></i>
                                <span>${submittedFileName}</span>
                                <button class="file-action-btn" onclick="window.open('${submission.file_url}', '_blank')">
                                    <i class="fas fa-eye"></i> View
                                </button>
                                <button class="file-action-btn" onclick="window.open('${submission.file_url}', '_blank')">
                                    <i class="fas fa-download"></i> Download
                                </button>
                            </div>
                        ` : '<p style="color: #999;">No file attached</p>'}
                    </div>

                    <div class="grade-section-divider"></div>

                    <form id="gradeForm" onsubmit="submitGrade(event); return false;">
                        <div class="grading-inputs-section">
                            <div class="form-group">
                                <label for="grade-score">
                                    <i class="fas fa-star"></i> Grade (0 - ${maxPoints}) *
                                </label>
                                <input 
                                    type="number" 
                                    id="grade-score" 
                                    min="0" 
                                    max="${maxPoints}" 
                                    step="0.5"
                                    value="${submission.grade !== null ? submission.grade : ''}"
                                    placeholder="Enter grade"
                                    required
                                >
                                <div class="grade-quick-actions">
                                    <button type="button" class="quick-grade-btn" onclick="setQuickGrade(${maxPoints})">
                                        Full Credit (${maxPoints})
                                    </button>
                                    <button type="button" class="quick-grade-btn" onclick="setQuickGrade(${maxPoints * 0.75})">
                                        75% (${maxPoints * 0.75})
                                    </button>
                                    <button type="button" class="quick-grade-btn" onclick="setQuickGrade(${maxPoints * 0.5})">
                                        50% (${maxPoints * 0.5})
                                    </button>
                                    <button type="button" class="quick-grade-btn" onclick="setQuickGrade(0)">
                                        Zero (0)
                                    </button>
                                </div>
                            </div>

                            <div class="form-group">
                                <label for="grade-feedback">
                                    <i class="fas fa-comment"></i> Feedback (Optional)
                                </label>
                                <textarea 
                                    id="grade-feedback" 
                                    rows="6" 
                                    placeholder="Provide feedback to the student..."
                                >${submission.feedback || ''}</textarea>
                            </div>

                            <div class="form-group">
                                <label>
                                    <input 
                                        type="checkbox" 
                                        id="notify-student"
                                        ${submission.grade !== null ? '' : 'checked'}
                                    >
                                    Notify student via email
                                </label>
                            </div>
                        </div>

                        <div class="form-actions">
                            <button type="button" class="btn-secondary" onclick="closeGradeModal()">
                                Cancel
                            </button>
                            <button type="button" class="btn-secondary" onclick="saveGradeDraft()">
                                <i class="fas fa-save"></i> Save Draft
                            </button>
                            <button type="submit" class="btn-primary" id="submitGradeBtn">
                                <i class="fas fa-check"></i> Submit Grade
                            </button>
                        </div>
                    </form>

                    ${submission.grade !== null && submission.graded_at ? `
                        <div class="grade-history">
                            <i class="fas fa-history"></i>
                            Previously graded on ${new Date(submission.graded_at).toLocaleString()}
                        </div>
                    ` : ''}
                `;

                // Show the modal
                document.getElementById('gradeModal').style.display = 'block';

            } catch (error) {
                console.error('Error loading submission for grading:', error);
                alert('Failed to load submission: ' + error.message);
            }
        }

        /**
         * Close the grading modal
         */
        function closeGradeModal() {
            document.getElementById('gradeModal').style.display = 'none';
            currentSubmissionData = null;
        }

        /**
         * Set quick grade value
         */
        function setQuickGrade(value) {
            document.getElementById('grade-score').value = value;
        }

        /**
         * Save grade as draft (without notifying student)
         */
        async function saveGradeDraft() {
            const grade = parseFloat(document.getElementById('grade-score').value);
            const feedback = document.getElementById('grade-feedback').value;

            if (isNaN(grade)) {
                alert('Please enter a valid grade');
                return;
            }

            try {
                const { error } = await window.supabaseClient
                    .from('post_submissions')
                    .update({
                        grade: grade,
                        feedback: feedback,
                        graded_at: new Date().toISOString(),
                        graded_by: currentUser.id
                    })
                    .eq('id', currentSubmissionData.id);

                if (error) throw error;

                alert('Grade saved as draft!');
                
            } catch (error) {
                console.error('Error saving draft:', error);
                alert('Failed to save draft: ' + error.message);
            }
        }

        /**
         * Submit final grade
         */
        async function submitGrade(event) {
            event.preventDefault();

            const submitBtn = document.getElementById('submitGradeBtn');
            const originalBtnText = submitBtn.innerHTML;

            try {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';

                const grade = parseFloat(document.getElementById('grade-score').value);
                const feedback = document.getElementById('grade-feedback').value;
                const notifyStudent = document.getElementById('notify-student').checked;

                if (isNaN(grade)) {
                    throw new Error('Please enter a valid grade');
                }

                const maxPoints = currentSubmissionData.post.points || 100;
                if (grade < 0 || grade > maxPoints) {
                    throw new Error(`Grade must be between 0 and ${maxPoints}`);
                }

                // Update the submission with grade
                const { error: updateError } = await window.supabaseClient
                    .from('post_submissions')
                    .update({
                        grade: grade,
                        feedback: feedback,
                        graded_at: new Date().toISOString(),
                        graded_by: currentUser.id
                    })
                    .eq('id', currentSubmissionData.id);

                if (updateError) throw updateError;

                // If notify student is checked, send notification/email
                if (notifyStudent) {
                    await sendGradeNotification(currentSubmissionData, grade, feedback);
                }

                alert('Grade submitted successfully!');
                closeGradeModal();

                // Refresh the submission list
                if (currentAssignmentId) {
                    await loadSubmissionsList(currentAssignmentId);
                }

            } catch (error) {
                console.error('Error submitting grade:', error);
                alert('Failed to submit grade: ' + error.message);
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
            }
        }

        /**
         * Send grade notification to student
         */
        async function sendGradeNotification(submission, grade, feedback) {
            try {
                console.log('Sending grade notification:', {
                    student: submission.student.email,
                    assignment: submission.post.title,
                    grade: grade,
                    feedback: feedback
                });

                // TODO: Implement actual email sending via your backend
                
            } catch (error) {
                console.error('Error sending notification:', error);
            }
        }

        /**
         * Export grades to CSV
         */
        async function exportGradesToCSV(assignmentId) {
            try {
                const { data: assignment } = await window.supabaseClient
                    .from('subject_posts')
                    .select('title')
                    .eq('id', assignmentId)
                    .single();

                const { data: enrollments } = await window.supabaseClient
                    .from('subject_enrollments')
                    .select(`
                        student:student_id(id, username, first_name, last_name, email)
                    `)
                    .eq('subject_id', currentSubject.id)
                    .eq('status', 'active');

                const { data: submissions } = await window.supabaseClient
                    .from('post_submissions')
                    .select('*')
                    .eq('post_id', assignmentId);

                const submissionMap = {};
                if (submissions) {
                    submissions.forEach(sub => {
                        submissionMap[sub.student_id] = sub;
                    });
                }

                let csv = 'Student Name,Email,Grade,Feedback,Submitted At,Graded At\n';
                
                enrollments.forEach(e => {
                    const student = e.student;
                    const submission = submissionMap[student.id];
                    const name = `${student.first_name || ''} ${student.last_name || ''}`.trim() || student.username;
                    
                    csv += `"${name}",`;
                    csv += `"${student.email || student.username}",`;
                    csv += `"${submission?.grade ?? 'Not Graded'}",`;
                    csv += `"${submission?.feedback || ''}",`;
                    csv += `"${submission ? new Date(submission.submitted_at).toLocaleString() : 'Not Submitted'}",`;
                    csv += `"${submission?.graded_at ? new Date(submission.graded_at).toLocaleString() : ''}"\n`;
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

            } catch (error) {
                console.error('Error exporting grades:', error);
                alert('Failed to export grades: ' + error.message);
            }
        }

        // Update the existing exportGrades function
        window.exportGrades = async function() {
            if (currentAssignmentId) {
                await exportGradesToCSV(currentAssignmentId);
            } else {
                alert('Please select an assignment first');
            }
        };

        // Make functions globally accessible
        window.gradeSubmission = gradeSubmission;
        window.closeGradeModal = closeGradeModal;
        window.setQuickGrade = setQuickGrade;
        window.saveGradeDraft = saveGradeDraft;
        window.submitGrade = submitGrade;
        
        // ==================== END OF GRADING SYSTEM ====================

// ==========================================
// MOBILE MENU HANDLER FOR SUBJECT VIEW
// Add this to the DOMContentLoaded section
// ==========================================

// Add hamburger menu and overlay to the page
function initializeMobileMenu() {
    const body = document.body;
    
    // Check if menu toggle already exists
    if (!document.getElementById('menuToggle')) {
        // Create hamburger menu button
        const menuToggle = document.createElement('button');
        menuToggle.className = 'menu-toggle';
        menuToggle.id = 'menuToggle';
        menuToggle.innerHTML = '<i class="fas fa-bars"></i>';
        body.insertBefore(menuToggle, body.firstChild);
        
        // Create overlay
        const overlay = document.createElement('div');
        overlay.className = 'sidebar-overlay';
        overlay.id = 'sidebarOverlay';
        body.insertBefore(overlay, body.firstChild);
    }
    
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.querySelector('.sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    
    // Toggle sidebar when clicking hamburger button
    menuToggle.addEventListener('click', function(e) {
        e.stopPropagation();
        sidebar.classList.toggle('active');
        sidebarOverlay.classList.toggle('active');
        
        // Change icon
        const icon = menuToggle.querySelector('i');
        if (sidebar.classList.contains('active')) {
            icon.classList.remove('fa-bars');
            icon.classList.add('fa-times');
        } else {
            icon.classList.remove('fa-times');
            icon.classList.add('fa-bars');
        }
    });
    
    // Close sidebar when clicking overlay
    sidebarOverlay.addEventListener('click', function() {
        sidebar.classList.remove('active');
        sidebarOverlay.classList.remove('active');
        
        // Reset icon
        const icon = menuToggle.querySelector('i');
        icon.classList.remove('fa-times');
        icon.classList.add('fa-bars');
    });
    
    // Close sidebar when clicking a nav item on mobile
    const navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('active');
                sidebarOverlay.classList.remove('active');
                
                // Reset icon
                const icon = menuToggle.querySelector('i');
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        });
    });
    
    // Handle window resize
    let resizeTimer;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
            if (window.innerWidth > 768) {
                // Desktop view - ensure sidebar is visible
                sidebar.classList.remove('active');
                sidebarOverlay.classList.remove('active');
                
                // Reset icon
                const icon = menuToggle.querySelector('i');
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        }, 250);
    });
    
    // Prevent body scroll when sidebar is open on mobile
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.attributeName === 'class') {
                if (sidebar.classList.contains('active') && window.innerWidth <= 768) {
                    document.body.style.overflow = 'hidden';
                } else {
                    document.body.style.overflow = '';
                }
            }
        });
    });
    
    observer.observe(sidebar, {
        attributes: true,
        attributeFilter: ['class']
    });
}

// Initialize mobile menu when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeMobileMenu);
} else {
    initializeMobileMenu();
}

// Touch swipe functionality for mobile
function initializeTouchSwipe() {
    const sidebar = document.querySelector('.sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    let touchStartX = 0;
    let touchEndX = 0;
    let touchStartY = 0;
    let touchEndY = 0;
    
    document.addEventListener('touchstart', function(e) {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });
    
    document.addEventListener('touchend', function(e) {
        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;
        handleSwipe();
    }, { passive: true });
    
    function handleSwipe() {
        const swipeThreshold = 50;
        const horizontalSwipe = Math.abs(touchEndX - touchStartX);
        const verticalSwipe = Math.abs(touchEndY - touchStartY);
        
        // Only handle horizontal swipes (ignore vertical scrolling)
        if (horizontalSwipe > verticalSwipe && horizontalSwipe > swipeThreshold) {
            const menuToggle = document.getElementById('menuToggle');
            const icon = menuToggle.querySelector('i');
            
            if (touchEndX > touchStartX && touchStartX < 50) {
                // Swipe right from left edge - open sidebar
                sidebar.classList.add('active');
                sidebarOverlay.classList.add('active');
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-times');
            } else if (touchEndX < touchStartX && sidebar.classList.contains('active')) {
                // Swipe left - close sidebar
                sidebar.classList.remove('active');
                sidebarOverlay.classList.remove('active');
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        }
    }
}

// Initialize touch swipe
if ('ontouchstart' in window) {
    initializeTouchSwipe();
}

// Enhanced scroll behavior for mobile
function initializeMobileScrollBehavior() {
    if (window.innerWidth <= 768) {
        // Smooth scroll for subject navigation
        const subjectNav = document.querySelector('.subject-nav');
        if (subjectNav) {
            const navItems = subjectNav.querySelectorAll('.subject-nav-item');
            navItems.forEach(item => {
                item.addEventListener('click', function() {
                    // Scroll active item into view
                    setTimeout(() => {
                        const activeItem = subjectNav.querySelector('.subject-nav-item.active');
                        if (activeItem) {
                            activeItem.scrollIntoView({
                                behavior: 'smooth',
                                inline: 'center',
                                block: 'nearest'
                            });
                        }
                    }, 100);
                });
            });
        }
        
        // Smooth scroll for submission filters
        const submissionFilters = document.querySelector('.submission-filters');
        if (submissionFilters) {
            const filterBtns = submissionFilters.querySelectorAll('.filter-btn');
            filterBtns.forEach(btn => {
                btn.addEventListener('click', function() {
                    setTimeout(() => {
                        const activeBtn = submissionFilters.querySelector('.filter-btn.active');
                        if (activeBtn) {
                            activeBtn.scrollIntoView({
                                behavior: 'smooth',
                                inline: 'center',
                                block: 'nearest'
                            });
                        }
                    }, 100);
                });
            });
        }
    }
}

// Call on page load and when content changes
initializeMobileScrollBehavior();

// Re-initialize when tab changes (for dynamic content)
document.addEventListener('tabChange', initializeMobileScrollBehavior);

// Optimize modal behavior for mobile
function optimizeModalsForMobile() {
    const modals = document.querySelectorAll('.modal');
    
    modals.forEach(modal => {
        modal.addEventListener('show', function() {
            if (window.innerWidth <= 768) {
                // Prevent body scroll when modal is open
                document.body.style.overflow = 'hidden';
                
                // Scroll modal to top
                const modalContent = modal.querySelector('.modal-content');
                if (modalContent) {
                    modalContent.scrollTop = 0;
                }
            }
        });
        
        modal.addEventListener('hide', function() {
            if (window.innerWidth <= 768) {
                // Restore body scroll
                document.body.style.overflow = '';
            }
        });
    });
}

optimizeModalsForMobile();

// Add pull-to-refresh functionality (optional enhancement)
function initializePullToRefresh() {
    if (window.innerWidth <= 768) {
        let startY = 0;
        let currentY = 0;
        let isPulling = false;
        const pullThreshold = 100;
        
        const mainContent = document.querySelector('.main-content');
        
        mainContent.addEventListener('touchstart', function(e) {
            if (mainContent.scrollTop === 0) {
                startY = e.touches[0].pageY;
                isPulling = true;
            }
        }, { passive: true });
        
        mainContent.addEventListener('touchmove', function(e) {
            if (isPulling) {
                currentY = e.touches[0].pageY;
                const pullDistance = currentY - startY;
                
                if (pullDistance > 0 && mainContent.scrollTop === 0) {
                    e.preventDefault();
                    // Visual feedback could be added here
                }
            }
        }, { passive: false });
        
        mainContent.addEventListener('touchend', function(e) {
            if (isPulling) {
                const pullDistance = currentY - startY;
                
                if (pullDistance > pullThreshold) {
                    // Trigger refresh
                    if (typeof refreshGrades === 'function') {
                        refreshGrades();
                    } else if (typeof loadPosts === 'function' && currentSubject) {
                        loadPosts(currentSubject.id);
                    }
                }
                
                isPulling = false;
                startY = 0;
                currentY = 0;
            }
        });
    }
}

// Initialize pull-to-refresh (optional)
// initializePullToRefresh();

// Post Expand/Collapse Function
function expandPost(event, postId) {
    event.preventDefault();
    event.stopPropagation();
    
    const postElement = document.querySelector(`[data-post-id="${postId}"]`);
    if (!postElement) return;
    
    const isCollapsed = postElement.classList.contains('collapsed');
    const button = postElement.querySelector('button[title="Expand"]');
    
    if (isCollapsed) {
        // Expand
        postElement.classList.remove('collapsed');
        if (button) {
            button.querySelector('i').classList.remove('fa-chevron-down');
            button.querySelector('i').classList.add('fa-chevron-up');
            button.title = 'Collapse';
        }
    } else {
        // Collapse
        postElement.classList.add('collapsed');
        if (button) {
            button.querySelector('i').classList.remove('fa-chevron-up');
            button.querySelector('i').classList.add('fa-chevron-down');
            button.title = 'Expand';
        }
    }
}

// Mobile Modal Functions for Class Info and Upcoming
function openUpcomingModal() {
    const modal = document.getElementById('upcomingModal');
    if (modal) {
        // Copy content from desktop sidebar to mobile modal
        const desktopContent = document.getElementById('upcomingContainer');
        const mobileContent = document.getElementById('upcomingContainerMobile');
        if (desktopContent && mobileContent) {
            mobileContent.innerHTML = desktopContent.innerHTML;
        }
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeUpcomingModal() {
    const modal = document.getElementById('upcomingModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
}

function openClassInfoModal() {
    const modal = document.getElementById('classInfoModal');
    if (modal) {
        // Copy data to mobile modal
        const studentCount = document.getElementById('studentCount');
        const postCount = document.getElementById('postCount');
        const studentCountMobile = document.getElementById('studentCountMobile');
        const postCountMobile = document.getElementById('postCountMobile');
        
        if (studentCount && studentCountMobile) {
            studentCountMobile.textContent = studentCount.textContent;
        }
        if (postCount && postCountMobile) {
            postCountMobile.textContent = postCount.textContent;
        }
        
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeClassInfoModal() {
    const modal = document.getElementById('classInfoModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
}

// Close modals when clicking overlay
document.addEventListener('DOMContentLoaded', function() {
    const upcomingOverlay = document.querySelector('#upcomingModal .mobile-modal-overlay');
    const classInfoOverlay = document.querySelector('#classInfoModal .mobile-modal-overlay');
    
    if (upcomingOverlay) {
        upcomingOverlay.addEventListener('click', closeUpcomingModal);
    }
    if (classInfoOverlay) {
        classInfoOverlay.addEventListener('click', closeClassInfoModal);
    }
});

// Show mobile quick actions on mobile devices
function setupMobileUI() {
    if (window.innerWidth <= 768) {
        const mobileQA = document.getElementById('mobileQuickActions');
        if (mobileQA) {
            mobileQA.style.display = 'grid';
        }
    }
}

// Call setup on load and resize
window.addEventListener('load', setupMobileUI);
window.addEventListener('resize', setupMobileUI);

// Export functions for use in main script
window.initializeMobileMenu = initializeMobileMenu;
window.initializeMobileScrollBehavior = initializeMobileScrollBehavior;
window.optimizeModalsForMobile = optimizeModalsForMobile;
window.openUpcomingModal = openUpcomingModal;
window.closeUpcomingModal = closeUpcomingModal;
window.openClassInfoModal = openClassInfoModal;
window.closeClassInfoModal = closeClassInfoModal;
window.expandPost = expandPost;
