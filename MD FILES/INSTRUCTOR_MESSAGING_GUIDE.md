# Instructor Messaging Integration Guide

## Overview
This guide helps you add messaging functionality to instructor pages (similar to student implementation).

## ✅ Already Completed

The backend API is already complete and works for both students and instructors.

## 📋 Optional: Add Messaging to Instructor Pages

### Option 1: Minimal Integration (Add Message Button to Subject View)

If instructors teach specific subjects and should be able to message their students, add a message button similar to students.

**File:** `HTML/instructor_subject_view.html`

**Step 1:** Add message button to people/students list

Find where students are displayed and add:
```html
<button class="btn-message-student" onclick="openMessageStudent(studentId, studentName)">
    <i class="fas fa-envelope"></i> Message Student
</button>
```

**Step 2:** Add styling in `CSS/instructor_subject_view.css`

```css
.btn-message-student {
    padding: 8px 12px;
    background: #3498db;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.85rem;
    transition: background 0.3s ease;
}

.btn-message-student:hover {
    background: #2980b9;
}
```

**Step 3:** Add modal in `HTML/instructor_subject_view.html` (before closing body tag)

```html
<!-- Message Student Modal -->
<div id="messageStudentModal" class="modal">
    <div class="modal-content" style="max-width: 500px;">
        <div class="modal-header">
            <h3><i class="fas fa-envelope"></i> Message Student</h3>
            <button class="close" onclick="closeMessageStudentModal()">&times;</button>
        </div>
        <div class="modal-body">
            <div style="margin-bottom: 16px; padding: 12px; background: #f0f0f0; border-radius: 4px;">
                <strong id="studentNameDisplay">Student Name</strong>
            </div>
            <div class="form-group">
                <label for="studentMessageText">Your Message:</label>
                <textarea id="studentMessageText" rows="5" placeholder="Type your message..." 
                          style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-family: inherit;"></textarea>
            </div>
        </div>
        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="closeMessageStudentModal()">Cancel</button>
            <button class="btn btn-primary" onclick="sendStudentMessage()">
                <i class="fas fa-paper-plane"></i> Send Message
            </button>
        </div>
    </div>
</div>

<script src="../JS/messaging.js"></script>
<script>
let selectedStudentId = null;
let selectedStudentName = null;

function openMessageStudent(studentId, studentName) {
    selectedStudentId = studentId;
    selectedStudentName = studentName;
    document.getElementById('studentNameDisplay').textContent = studentName;
    document.getElementById('messageStudentModal').style.display = 'block';
    document.getElementById('studentMessageText').focus();
}

function closeMessageStudentModal() {
    document.getElementById('messageStudentModal').style.display = 'none';
    document.getElementById('studentMessageText').value = '';
}

async function sendStudentMessage() {
    const messageText = document.getElementById('studentMessageText').value;
    const subjectId = new URLSearchParams(window.location.search).get('subject_id');
    
    if (!messageText.trim()) {
        alert('Please enter a message');
        return;
    }

    const success = await window.messagingSystem.sendMessage(
        selectedStudentId,
        messageText,
        subjectId
    );

    if (success) {
        alert('Message sent successfully!');
        closeMessageStudentModal();
    }
}

window.onclick = function(event) {
    const modal = document.getElementById('messageStudentModal');
    if (event.target === modal) {
        closeMessageStudentModal();
    }
}
</script>
```

---

### Option 2: Full Integration (Create Instructor Messages Page)

Create a complete messaging interface for instructors (similar to student messages page).

**File:** `HTML/instructor_messages.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ALS Instructor Portal - Messages</title>
    <link rel="stylesheet" href="../CSS/instructor_styles.css">
    <link rel="stylesheet" href="../CSS/student_messages.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
</head>
<body>
    <!-- Sidebar (reuse instructor sidebar) -->
    <div class="sidebar">
        <div class="sidebar-header">
            <div class="logo-container">
                <img src="../COMPONENTS/IMAGES/als logo.png" alt="ALS Logo" class="als-logo">
            </div>
            <h1>ALS Portal</h1>
            <p id="instructorName">Welcome, Instructor</p>
        </div>
        <div class="nav-tabs">
            <div class="nav-tab" data-page="dashboard">
                <i class="fas fa-chart-line"></i>
                <span>Dashboard</span>
            </div>
            <div class="nav-tab" data-page="learners">
                <i class="fas fa-users"></i>
                <span>Learners</span>
            </div>
            <div class="nav-tab" data-page="subjects">
                <i class="fas fa-book"></i>
                <span>Subjects</span>
            </div>
            <div class="nav-tab" data-page="mapping">
                <i class="fas fa-map-marked-alt"></i>
                <span>Mapping</span>
            </div>
            <div class="nav-tab" data-page="analytics">
                <i class="fas fa-chart-bar"></i>
                <span>Analytics</span>
            </div>
            <div class="nav-tab" data-page="messages" class="active">
                <i class="fas fa-envelope"></i>
                <span>Messages</span>
                <span class="badge" id="messagesBadge" style="display: none; background: #e74c3c; color: white; border-radius: 50%; width: 20px; height: 20px; font-size: 0.75rem; display: flex; align-items: center; justify-content: center;"></span>
            </div>
            <div class="nav-tab" data-page="logout">
                <i class="fas fa-sign-out-alt"></i>
                <span>Logout</span>
            </div>
        </div>
    </div>

    <div class="main-content">
        <header>
            <h1><i class="fas fa-envelope"></i> Messages</h1>
            <p>Communicate with your students</p>
        </header>

        <div class="messaging-container">
            <!-- Left Sidebar: Threads List -->
            <div class="message-threads-panel">
                <div class="threads-header">
                    <h3><i class="fas fa-comments"></i> Conversations</h3>
                </div>
                <div id="messageThreadList" class="message-threads-list">
                    <p style="padding: 20px; color: #999; text-align: center;">Loading conversations...</p>
                </div>
            </div>

            <!-- Right Panel: Conversation View -->
            <div id="conversationArea" class="conversation-area">
                <div class="empty-conversation">
                    <i class="fas fa-comment-dots"></i>
                    <h3>Select a conversation</h3>
                    <p>Choose a conversation from the list to start messaging</p>
                </div>
            </div>
        </div>
    </div>

    <script src="../JS/messaging.js"></script>
    <script>
    document.addEventListener('DOMContentLoaded', () => {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user || user.role !== 'instructor') {
            window.location.href = '/';
            return;
        }

        // Setup sidebar
        const currentTab = document.querySelector('[data-page="messages"]');
        if (currentTab) {
            currentTab.classList.add('active');
        }

        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const page = tab.dataset.page;
                if (page === 'logout') {
                    localStorage.removeItem('user');
                    window.location.href = '/';
                    return;
                }
                window.location.href = `/instructor_${page === 'dashboard' ? 'dashboard' : page}`;
            });
        });

        // Set instructor name
        document.getElementById('instructorName').textContent = `Welcome, ${user.full_name || 'Instructor'}`;
    });
    </script>
</body>
</html>
```

**Add this endpoint to ALS.py:**

```python
@app.get("/instructor_messages", response_class=FileResponse)
async def instructor_messages():
    return FileResponse("HTML/instructor_messages.html")
```

**Add link to instructor sidebar:** (in your instructor sidebar component)
```html
<div class="nav-tab" data-page="messages">
    <i class="fas fa-envelope"></i>
    <span>Messages</span>
</div>
```

---

## 🔧 Backend Setup (Already Done)

All API endpoints work for both students and instructors:

```javascript
// Send message (works for both)
window.messagingSystem.sendMessage(recipientId, messageText);

// Get conversations (works for both)
window.messagingSystem.getConversation(otherUserId);

// Get all threads (works for both)
window.messagingSystem.loadMessageThreads();

// Get unread count (works for both)
window.messagingSystem.getUnreadCount();
```

---

## 📱 Key Differences

| Feature | Students | Instructors |
|---------|----------|-------------|
| Message button on subject | ✅ Yes | Depends on implementation |
| Dedicated messages page | ✅ Yes | Optional |
| Can message students | ❌ Only instructors | ✅ Yes |
| Unread badge | ✅ Yes | ✅ Yes |
| Auto-polling | ✅ Yes | ✅ Yes |

---

## 🎯 Recommended Approach

**Start with:** Option 1 (Minimal Integration)
- Add message button to instructor subject view to message students
- Instructors can use student messages page interface (already works)
- Minimal code changes

**Later upgrade to:** Option 2 (Full Integration)
- Create dedicated instructor messages page
- Better UX for instructor-to-student messaging
- More professional appearance

---

## 📞 Support

If you need help implementing either option:
1. Check `MESSAGING_IMPLEMENTATION.md` for detailed API documentation
2. Reference `JS/messaging.js` for available methods
3. Look at `HTML/student_messages.html` for a working example

The messaging system is designed to work for both students and instructors with the same backend - just customize the frontend as needed!
