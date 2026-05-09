if (!window.supabaseClient) {
    window.supabaseClient = window.supabase.createClient(
        'https://bbinymljjtjxkeclqamt.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJiaW55bWxqanRqeGtlY2xxYW10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3MzQ1OTQsImV4cCI6MjA3MjMxMDU5NH0.bOIwdxUiLd-63V6-_XZxER1PLqohtd1cnwipF6YZjn4'
    );
}

let currentUser = null;
let allAnnouncements = [];
let currentFilter = 'all';

document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    currentUser = JSON.parse(localStorage.getItem('user'));
    if (!currentUser || currentUser.role !== 'student') {
        window.location.href = '/';
        return;
    }

    // Load announcements
    await loadAnnouncements();

    // Setup event listeners
    setupEventListeners();

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

function setupEventListeners() {
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderAnnouncements();
        });
    });

    // Search input
    document.getElementById('searchInput').addEventListener('input', (e) => {
        renderAnnouncements(e.target.value);
    });

    // Mark all as read button
    document.getElementById('markAllReadBtn').addEventListener('click', markAllAsRead);
}

async function loadAnnouncements() {
    try {
        const response = await fetch(`/api/announcements/student/${currentUser.id}?filter_type=${currentFilter}`);
        
        if (!response.ok) {
            throw new Error('Failed to load announcements');
        }

        allAnnouncements = await response.json();
        renderAnnouncements();
        updateUnreadBadge();

    } catch (error) {
        console.error('Error loading announcements:', error);
        showError();
    }
}

function renderAnnouncements(searchQuery = '') {
    const container = document.getElementById('announcementsContainer');
    
    // Filter announcements based on current filter
    let filtered = allAnnouncements;
    
    if (currentFilter === 'unread') {
        filtered = allAnnouncements.filter(a => !a.is_read);
    } else if (currentFilter === 'read') {
        filtered = allAnnouncements.filter(a => a.is_read);
    }

    // Apply search filter
    if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        filtered = filtered.filter(a => 
            a.title.toLowerCase().includes(query) ||
            a.content.toLowerCase().includes(query) ||
            a.source_name.toLowerCase().includes(query)
        );
    }

    // Update mark all as read button
    const unreadCount = allAnnouncements.filter(a => !a.is_read).length;
    document.getElementById('markAllReadBtn').disabled = unreadCount === 0;

    // Show empty state if no announcements
    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <h3>No announcements</h3>
                <p>${searchQuery ? 'No announcements match your search' : 'You\'re all caught up!'}</p>
            </div>
        `;
        return;
    }

    // Render announcements
    container.innerHTML = `
        <div class="announcements-list">
            ${filtered.map(announcement => createAnnouncementCard(announcement)).join('')}
        </div>
    `;

    // Add click handlers for read more and mark as read
    filtered.forEach(announcement => {
        const card = document.getElementById(`announcement-${announcement.id}`);
        if (card) {
            // Mark as read on card click
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.action-link')) {
                    toggleAnnouncementRead(announcement.id, announcement.is_read);
                }
            });

            // Read more functionality
            const readMoreBtn = card.querySelector('.read-more');
            if (readMoreBtn) {
                readMoreBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const content = card.querySelector('.announcement-content');
                    content.classList.toggle('collapsed');
                    readMoreBtn.textContent = content.classList.contains('collapsed') 
                        ? 'Read more' 
                        : 'Show less';
                });
            }

            // Mark as read/unread action
            const markAction = card.querySelector('.mark-action');
            if (markAction) {
                markAction.addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleAnnouncementRead(announcement.id, announcement.is_read);
                });
            }
        }
    });
}

function createAnnouncementCard(announcement) {
    const timeAgo = getTimeAgo(new Date(announcement.created_at));
    const isPinned = announcement.is_pinned || false;
    const isLongContent = announcement.content && announcement.content.length > 200;
    
    // Determine priority for styling
    const priority = announcement.title.toLowerCase().includes('urgent') ? 'urgent' :
                   announcement.title.toLowerCase().includes('important') ? 'important' : 'general';

    return `
        <div class="announcement-card ${announcement.is_read ? 'read' : 'unread'} ${priority} ${isPinned ? 'pinned' : ''}" 
             id="announcement-${announcement.id}">
            <div class="announcement-header">
                <div class="announcement-title-section">
                    <div class="announcement-badges">
                        ${isPinned ? '<span class="badge badge-pinned"><i class="fas fa-thumbtack"></i> Pinned</span>' : ''}
                        ${!announcement.is_read ? '<span class="badge badge-unread">New</span>' : ''}
                        <span class="badge badge-${announcement.announcement_type}">
                            ${announcement.announcement_type === 'system' ? 'System' : announcement.source_name}
                        </span>
                        ${priority === 'urgent' ? '<span class="badge badge-urgent">Urgent</span>' : ''}
                        ${priority === 'important' ? '<span class="badge badge-important">Important</span>' : ''}
                    </div>
                    <h3 class="announcement-title">
                        ${isPinned ? '<i class="fas fa-thumbtack pin-icon"></i>' : ''}
                        ${announcement.title}
                    </h3>
                    <div class="announcement-meta">
                        <span class="meta-item">
                            <i class="fas fa-user"></i>
                            ${announcement.author_name}
                        </span>
                        <span class="meta-item">
                            <i class="fas fa-clock"></i>
                            ${timeAgo}
                        </span>
                        ${announcement.is_read ? `
                            <span class="meta-item">
                                <i class="fas fa-check"></i>
                                Read ${getTimeAgo(new Date(announcement.read_at))}
                            </span>
                        ` : ''}
                    </div>
                </div>
            </div>
            <div class="announcement-content ${isLongContent ? 'collapsed' : ''}">
                ${announcement.content || 'No additional details provided.'}
            </div>
            ${isLongContent ? '<span class="read-more">Read more</span>' : ''}
            <div class="announcement-actions">
                <span class="action-link mark-action">
                    <i class="fas fa-${announcement.is_read ? 'envelope' : 'check'}"></i>
                    Mark as ${announcement.is_read ? 'unread' : 'read'}
                </span>
            </div>
        </div>
    `;
}

async function toggleAnnouncementRead(announcementId, currentlyRead) {
    try {
        if (currentlyRead) {
            // Mark as unread
            const response = await fetch(`/api/announcements/${announcementId}/mark-unread?student_id=${currentUser.id}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) throw new Error('Failed to mark as unread');
        } else {
            // Mark as read
            const response = await fetch(`/api/announcements/${announcementId}/mark-read?student_id=${currentUser.id}`, {
                method: 'POST'
            });
            
            if (!response.ok) throw new Error('Failed to mark as read');
        }

        // Reload announcements
        await loadAnnouncements();

    } catch (error) {
        console.error('Error toggling read status:', error);
        alert('Failed to update announcement status');
    }
}

async function markAllAsRead() {
    if (!confirm('Mark all announcements as read?')) return;

    try {
        const response = await fetch(`/api/announcements/mark-all-read?student_id=${currentUser.id}`, {
            method: 'POST'
        });

        if (!response.ok) throw new Error('Failed to mark all as read');

        const result = await response.json();
        alert(result.message);

        // Reload announcements
        await loadAnnouncements();

    } catch (error) {
        console.error('Error marking all as read:', error);
        alert('Failed to mark all announcements as read');
    }
}

function updateUnreadBadge() {
    const unreadCount = allAnnouncements.filter(a => !a.is_read).length;
    const badge = document.getElementById('unreadBadge');
    if (badge) {
        badge.textContent = unreadCount;
        badge.style.display = unreadCount > 0 ? 'inline-block' : 'none';
    }
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
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks}w ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function showError() {
    document.getElementById('announcementsContainer').innerHTML = `
        <div class="empty-state">
            <i class="fas fa-exclamation-circle"></i>
            <h3>Error loading announcements</h3>
            <p>Please refresh the page to try again</p>
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
    const currentTab = document.querySelector('[data-page="announcements"]');
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
