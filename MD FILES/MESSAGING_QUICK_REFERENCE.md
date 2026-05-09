# Messaging System - Quick Reference Card

## 🚀 30-Second Setup

```bash
# 1. Create table in Supabase (copy-paste SQL)
# See MESSAGING_SETUP_CHECKLIST.md → "Create Supabase Table"

# 2. Restart backend
Ctrl+C
python -m uvicorn ALS:app --reload --host 0.0.0.0 --port 8000

# 3. Test
Login as student → Click subject → Click "Message Instructor"
```

---

## 📁 Key Files

| File | What | Use Case |
|------|------|----------|
| `JS/messaging.js` | Core module | All messaging logic |
| `HTML/student_messages.html` | Messages page | Full messaging UI |
| `HTML/student_subject_view.html` | Subject page | Message button |
| `CSS/student_messages.css` | Styling | UI design |
| `ALS.py` | Backend | API endpoints |

---

## 🎯 Main Functions

```javascript
// Send a message
window.messagingSystem.sendMessage(
    recipientId,      // UUID
    messageText,      // string
    subjectId,        // optional UUID
    attachmentUrl     // optional string
)

// Get conversation
window.messagingSystem.getConversation(otherUserId)

// Load all threads
window.messagingSystem.loadMessageThreads()

// Get unread count
window.messagingSystem.getUnreadCount()

// Mark as read
window.messagingSystem.markAsRead(messageId)

// Open conversation in UI
window.messagingSystem.openConversation(otherId, userName)
```

---

## 🔌 API Endpoints

```
POST   /api/messages/send
GET    /api/messages/conversation/{user_id}/{other_user_id}
GET    /api/messages/threads/{user_id}
PUT    /api/messages/{message_id}/read
GET    /api/messages/unread/{user_id}
GET    /api/messages/get-recipient-info/{user_id}
```

---

## 💾 Database Table

```sql
CREATE TABLE messages (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  receiver_id UUID NOT NULL REFERENCES auth.users(id),
  subject_id UUID REFERENCES subjects(id),
  message_text TEXT NOT NULL,
  attachment_url TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_receiver ON messages(receiver_id);
CREATE INDEX idx_messages_conversation ON messages(sender_id, receiver_id);
```

---

## ⚙️ Configuration

### Change Polling Speed
```javascript
// In JS/messaging.js, find startPolling()
// Change 5000 to your preferred milliseconds
// 3000 = 3 seconds, 10000 = 10 seconds
setInterval(async () => { ... }, 5000)
```

### Change Colors
```css
/* In CSS/student_messages.css */
.message-bubble.own .bubble-content {
    background: #YOUR_COLOR;
}
.message-bubble:not(.own) .bubble-content {
    background: #YOUR_COLOR;
}
```

### Add to Sidebar
```javascript
// Add to navigation
{
    icon: "fa-envelope",
    text: "Messages",
    url: "/student_messages"
}
```

---

## 🧪 Quick Test

### Test 1: From Console
```javascript
// Open DevTools (F12) and run:
window.messagingSystem.sendMessage(
    'recipient-uuid-here',
    'Test message'
).then(success => console.log('Sent:', success))
```

### Test 2: From UI
1. Login as student
2. Click subject
3. Click "Message Instructor" button
4. Type and send message
5. Go to "Messages" page
6. Verify conversation shows

---

## 🐛 Common Issues

| Issue | Solution |
|-------|----------|
| Table doesn't exist | Run SQL in Supabase |
| 404 error | Restart backend server |
| Messages not sending | Check browser console, verify UUIDs |
| No threads showing | Send a message first |
| Modal won't open | Ensure `messaging.js` is loaded |

---

## 📊 Features

✅ Send/receive messages  
✅ View conversation history  
✅ Mark messages as read  
✅ Unread count badge  
✅ Auto-polling (5 seconds)  
✅ Multiple conversations  
✅ Subject context  
✅ Responsive mobile UI  
✅ Message timestamps  
✅ User info display  

---

## 📚 Full Docs

- `MESSAGING_SETUP_CHECKLIST.md` - Setup guide
- `MESSAGING_IMPLEMENTATION.md` - Technical details
- `INSTRUCTOR_MESSAGING_GUIDE.md` - Instructor setup
- `MESSAGING_ARCHITECTURE_DIAGRAM.md` - System design
- `MESSAGING_FILES_SUMMARY.md` - File changes

---

## 🎨 UI Elements

### Message Button
```html
<button class="btn-message-instructor">
    <i class="fas fa-envelope"></i> Message Instructor
</button>
```

### Message Modal
```html
<div id="messageModal" class="modal">
    <input id="messageText" placeholder="Type message...">
    <button onclick="sendMessage()">Send</button>
</div>
```

### Message Threads
```html
<div id="messageThreadList">
    <!-- Threads rendered here -->
</div>
```

---

## 🔐 Security

- Messages stored per relationship
- Read status prevents access
- User authentication required
- UUIDs used (not usernames)
- Optional: Add RLS in Supabase

---

## 🚀 Next Steps

1. ✅ Create Supabase table
2. ✅ Restart backend
3. ✅ Test messaging
4. ⏳ (Optional) Customize colors
5. ⏳ (Optional) Add instructor page
6. ⏳ (Optional) Add notifications

---

## 🎯 API Response Examples

### Send Message Response
```json
{
    "success": true,
    "message": "Message sent successfully",
    "data": {
        "id": 123,
        "sender_id": "user-uuid",
        "receiver_id": "user-uuid",
        "message_text": "Hello",
        "is_read": false,
        "created_at": "2024-01-04T10:30:00Z"
    }
}
```

### Get Threads Response
```json
{
    "success": true,
    "threads": [
        {
            "other_user_id": "user-uuid",
            "subject_id": "subject-uuid",
            "last_message": "Thanks for your help!",
            "last_message_at": "2024-01-04T10:30:00Z",
            "unread_count": 2
        }
    ]
}
```

---

## 💬 Common Questions

**Q: How often does it update?**  
A: Every 5 seconds via auto-polling

**Q: Can I use WebSocket instead?**  
A: Yes, modify `startPolling()` method

**Q: Can instructors see all student messages?**  
A: No, only their direct conversations

**Q: How long are messages stored?**  
A: Indefinitely (until deleted)

**Q: Can I delete messages?**  
A: Not yet - optional future feature

---

## 📞 Need Help?

1. Check console for errors (F12)
2. Verify Supabase table exists
3. Restart backend server
4. Review documentation files
5. Check network tab for API calls

---

**Status: ✅ READY TO USE**

All done! Just create the table and restart your server.
