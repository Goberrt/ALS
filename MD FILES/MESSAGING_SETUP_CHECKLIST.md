# Messaging System - Quick Setup Checklist

## ✅ What's Already Done

- ✅ Backend API endpoints created in `ALS.py`
- ✅ JavaScript messaging module created (`JS/messaging.js`)
- ✅ Student messages page UI updated (`HTML/student_messages.html`)
- ✅ Message button added to student subject view
- ✅ Complete CSS styling for messaging interface
- ✅ Polling system for auto-updating messages every 5 seconds

## 🔧 What You Need To Do

### CRITICAL: Create Supabase Tables

**⚠️ IMPORTANT:** Without these tables, the messaging system won't work!

1. **Go to your Supabase Project**
   - URL: `https://app.supabase.com/`
   - Select your ALS project

2. **Open SQL Editor**
   - Click "SQL Editor" in left sidebar
   - Click "New Query"

3. **Copy and Paste This SQL:**

```sql
-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  message_text TEXT NOT NULL,
  attachment_url TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_is_read ON messages(receiver_id, is_read);

-- Enable RLS (Row Level Security) - OPTIONAL but recommended
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Policy for users to see their own messages (OPTIONAL)
CREATE POLICY "Users can view their own messages" ON messages
  FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
  );

CREATE POLICY "Users can create messages" ON messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
  );
```

4. **Click "Run"** (or Cmd+Enter / Ctrl+Enter)

5. **Verify Creation**
   - Go to "Tables" in left sidebar
   - You should see a new `messages` table
   - Click it to verify the columns are correct

---

## 🧪 Testing the System

### Test 1: Send a Message
1. Open browser developer console (F12)
2. Paste this code:

```javascript
fetch('/api/messages/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        sender_id: 'paste_your_user_uuid_here',
        receiver_id: 'paste_recipient_uuid_here',
        message_text: 'Test message from browser'
    })
}).then(r => r.json()).then(d => console.log('Response:', d))
```

3. Replace UUIDs with actual user IDs from your auth.users table
4. Check console for success response

### Test 2: Check Messages Page
1. Login as a student
2. Click "Messages" in sidebar
3. Should see the testing message threads list (if you created messages)
4. Click on a conversation to view messages

### Test 3: Message from Subject View
1. Login as a student
2. Click any subject
3. Look for "Message Instructor" button in the instructor widget
4. Click it to test the message modal

---

## 📱 Features Available

### For Students:
- ✅ Send messages to their instructors
- ✅ View all conversations in Messages page
- ✅ See unread message count
- ✅ Auto-loading of new messages every 5 seconds
- ✅ Message instructor directly from subject page

### For Instructors:
- ✅ Send messages to students
- ✅ Reply to student messages
- ✅ View all conversations
- ✅ See unread counts

---

## 🎨 Customization Guide

### Change Button Color

In `CSS/student_subject_view.css`, find `.btn-message-instructor`:

```css
.btn-message-instructor {
    background: #3498db;  /* ← Change this color */
}

.btn-message-instructor:hover {
    background: #2980b9;  /* ← Change this too */
}
```

### Change Message Bubble Colors

In `CSS/student_messages.css`, find message bubble styles:

```css
.message-bubble.own .bubble-content {
    background: #3498db;  /* ← Your messages color */
}

.message-bubble:not(.own) .bubble-content {
    background: #e9ecef;  /* ← Others' messages color */
}
```

### Change Polling Frequency

In `JS/messaging.js`, find `startPolling()` method:

```javascript
this.pollingInterval = setInterval(async () => {
    // ...
}, 5000);  // ← Change 5000 to desired milliseconds
           // 3000 = 3 seconds, 10000 = 10 seconds
```

---

## 🐛 Common Issues & Solutions

### Issue: "Table doesn't exist" error
**Solution:** You haven't created the Supabase table yet. Follow the "Create Supabase Tables" section above.

### Issue: Messages not sending
**Solution:**
1. Check browser console for errors (F12)
2. Verify user UUIDs are correct (not usernames)
3. Check that both sender and receiver exist in auth.users
4. Restart the backend server (kill and rerun)

### Issue: Message modal not opening
**Solution:**
1. Check console for JavaScript errors
2. Ensure `messaging.js` is loaded: `console.log(window.messagingSystem)`
3. Make sure you're logged in as a student

### Issue: No messages appearing in threads list
**Solution:**
1. You need to actually send messages first
2. Try the "Test 1: Send a Message" section above
3. Wait 5 seconds for auto-refresh, or refresh the page

### Issue: "sender_id and receiver_id must be UUIDs"
**Solution:**
- Use actual user IDs from your `auth.users` table
- NOT usernames or email addresses
- Format: `123e4567-e89b-12d3-a456-426614174000`

---

## 📞 Getting User UUIDs

### From Supabase Dashboard:
1. Go to Authentication → Users
2. Click on a user
3. Copy the "UID" field (this is the UUID)

### From Database:
1. Go to SQL Editor
2. Run: `SELECT id, email FROM auth.users;`
3. The `id` column contains the UUIDs

---

## 🚀 Next Steps

1. ✅ Create Supabase tables (REQUIRED)
2. ✅ Test with browser console
3. ✅ Test from UI (Messages page)
4. ✅ Test message button in subject view
5. ✅ Customize colors/styling
6. Add notifications (optional future feature)
7. Add message search (optional future feature)
8. Add emoji support (optional future feature)

---

## 📊 Database Info

**Table Name:** `messages`

**Columns:**
- `id` - Auto-generated message ID
- `sender_id` - UUID of person sending
- `receiver_id` - UUID of person receiving
- `subject_id` - Optional subject UUID for context
- `message_text` - The actual message content
- `attachment_url` - Optional file attachment
- `is_read` - Whether recipient has read it
- `created_at` - Timestamp when created
- `updated_at` - Timestamp when updated

---

## ✨ You're All Set!

Once you:
1. Create the Supabase table
2. Restart your backend server

The messaging system should work immediately. No code changes needed!

---

**Questions?** Check `MESSAGING_IMPLEMENTATION.md` for more detailed information.
