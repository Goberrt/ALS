// Messaging System Module
// Handles all messaging functionality across the platform

class MessagingSystem {
    constructor() {
        this.currentConversation = null;
        this.currentUser = null;
        this.threads = [];
        this.unreadCount = 0;
        this.pollingInterval = null;
        this.init();
    }

    async init() {
        // Get current user from localStorage or session
        this.currentUser = this.getCurrentUser();
        if (this.currentUser) {
            await this.loadMessageThreads();
            this.startPolling();
        }
    }

    getCurrentUser() {
        const userStr = localStorage.getItem('user');
        return userStr ? JSON.parse(userStr) : null;
    }

    // ============ SEND MESSAGE ============
    async sendMessage(receiverId, messageText, subjectId = null, attachmentUrl = null) {
        if (!this.currentUser) {
            alert('Please log in first');
            return false;
        }

        if (!messageText.trim()) {
            alert('Please enter a message');
            return false;
        }

        try {
            const response = await fetch('/api/messages/send', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sender_id: this.currentUser.id,
                    receiver_id: receiverId,
                    subject_id: subjectId,
                    message_text: messageText,
                    attachment_url: attachmentUrl
                })
            });

            const data = await response.json();

            if (data.success) {
                console.log('Message sent successfully');
                return true;
            } else {
                alert('Failed to send message: ' + data.message);
                return false;
            }
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Error sending message: ' + error.message);
            return false;
        }
    }

    // ============ GET CONVERSATION ============
    async getConversation(otherUserId) {
        if (!this.currentUser) return [];

        try {
            const response = await fetch(
                `/api/messages/conversation/${this.currentUser.id}/${otherUserId}`
            );
            const data = await response.json();

            // Handle both array response and success-wrapped response
            if (Array.isArray(data)) {
                this.currentConversation = {
                    otherUserId: otherUserId,
                    messages: data
                };
                return data;
            } else if (data.success) {
                this.currentConversation = {
                    otherUserId: otherUserId,
                    messages: data.messages
                };
                return data.messages;
            } else {
                console.error('Failed to fetch conversation');
                return [];
            }
        } catch (error) {
            console.error('Error fetching conversation:', error);
            return [];
        }
    }

    // ============ GET MESSAGE THREADS ============
    async loadMessageThreads() {
        if (!this.currentUser) return;

        try {
            const response = await fetch(`/api/messages/threads/${this.currentUser.id}`);
            const data = await response.json();

            if (data.success) {
                this.threads = data.threads;
                await this.updateThreadUI();
            }
        } catch (error) {
            console.error('Error loading message threads:', error);
        }
    }

    async updateThreadUI() {
        const threadList = document.getElementById('messageThreadList');
        if (!threadList) return;

        threadList.innerHTML = '';

        if (this.threads.length === 0) {
            threadList.innerHTML = '<p style="padding: 20px; color: #999; text-align: center;">No conversations yet</p>';
            return;
        }

        for (const thread of this.threads) {
            const userInfo = await this.getUserInfo(thread.other_user_id);
            const threadEl = document.createElement('div');
            threadEl.className = 'message-thread';
            threadEl.style.cursor = 'pointer';
            threadEl.style.padding = '12px 15px';
            threadEl.style.borderBottom = '1px solid #eee';
            threadEl.style.display = 'flex';
            threadEl.style.justifyContent = 'space-between';
            threadEl.style.alignItems = 'center';
            threadEl.style.transition = 'background-color 0.2s';

            const info = document.createElement('div');
            info.style.flex = '1';

            const nameEl = document.createElement('div');
            nameEl.style.fontWeight = '600';
            nameEl.style.color = '#333';
            nameEl.textContent = userInfo.name || 'Unknown User';

            const messageEl = document.createElement('div');
            messageEl.style.fontSize = '0.875rem';
            messageEl.style.color = '#666';
            messageEl.style.whiteSpace = 'nowrap';
            messageEl.style.overflow = 'hidden';
            messageEl.style.textOverflow = 'ellipsis';
            messageEl.style.marginTop = '4px';
            messageEl.textContent = thread.last_message;

            info.appendChild(nameEl);
            info.appendChild(messageEl);

            if (thread.unread_count > 0) {
                const badge = document.createElement('span');
                badge.style.backgroundColor = '#3498db';
                badge.style.color = 'white';
                badge.style.borderRadius = '50%';
                badge.style.width = '24px';
                badge.style.height = '24px';
                badge.style.display = 'flex';
                badge.style.alignItems = 'center';
                badge.style.justifyContent = 'center';
                badge.style.fontSize = '0.75rem';
                badge.style.fontWeight = 'bold';
                badge.textContent = thread.unread_count;
                threadEl.appendChild(badge);
            }

            threadEl.appendChild(info);
            threadEl.onclick = () => this.openConversation(thread.other_user_id, userInfo.name);

            threadEl.onmouseover = () => {
                threadEl.style.backgroundColor = '#f0f0f0';
            };
            threadEl.onmouseout = () => {
                threadEl.style.backgroundColor = 'transparent';
            };

            threadList.appendChild(threadEl);
        }
    }

    // ============ GET USER INFO ============
    async getUserInfo(userId) {
        try {
            const response = await fetch(`/api/messages/get-recipient-info/${userId}`);
            const data = await response.json();

            if (data.success) {
                return data.user;
            }
        } catch (error) {
            console.error('Error fetching user info:', error);
        }
        return { name: 'Unknown User', id: userId };
    }

    // ============ MARK AS READ ============
    async markAsRead(messageId) {
        try {
            await fetch(`/api/messages/${messageId}/read`, {
                method: 'PUT'
            });
        } catch (error) {
            console.error('Error marking message as read:', error);
        }
    }

    // ============ GET UNREAD COUNT ============
    async getUnreadCount() {
        if (!this.currentUser) return 0;

        try {
            const response = await fetch(`/api/messages/unread/${this.currentUser.id}`);
            const data = await response.json();

            if (data.success) {
                this.unreadCount = data.unread_count;
                this.updateMessagesBadge();
                return data.unread_count;
            }
        } catch (error) {
            console.error('Error fetching unread count:', error);
            return 0;
        }
    }

    updateMessagesBadge() {
        const badge = document.getElementById('messagesBadge');
        if (badge) {
            if (this.unreadCount > 0) {
                badge.style.display = 'flex';
                badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
            } else {
                badge.style.display = 'none';
            }
        }
    }

    // ============ OPEN CONVERSATION ============
    async openConversation(otherUserId, userName) {
        const messages = await this.getConversation(otherUserId);
        this.renderConversation(messages, userName, otherUserId);
    }

    renderConversation(messages, userName, otherUserId) {
        const conversationArea = document.getElementById('conversationArea');
        if (!conversationArea) return;

        // Clear existing content
        conversationArea.innerHTML = '';

        // Header
        const header = document.createElement('div');
        header.style.padding = '20px';
        header.style.borderBottom = '1px solid #eee';
        header.style.backgroundColor = '#f8f9fa';

        const headerTitle = document.createElement('h3');
        headerTitle.style.margin = '0 0 5px 0';
        headerTitle.style.color = '#333';
        headerTitle.textContent = userName || 'Unknown User';

        header.appendChild(headerTitle);
        conversationArea.appendChild(header);

        // Messages
        const messagesContainer = document.createElement('div');
        messagesContainer.id = 'messagesContainer';
        messagesContainer.style.flex = '1';
        messagesContainer.style.overflowY = 'auto';
        messagesContainer.style.padding = '20px';
        messagesContainer.style.display = 'flex';
        messagesContainer.style.flexDirection = 'column';
        messagesContainer.style.gap = '12px';

        if (messages.length === 0) {
            const noMessages = document.createElement('div');
            noMessages.style.textAlign = 'center';
            noMessages.style.color = '#999';
            noMessages.style.marginTop = '40px';
            noMessages.textContent = 'No messages yet. Start the conversation!';
            messagesContainer.appendChild(noMessages);
        } else {
            messages.forEach(msg => {
                const isOwn = msg.sender_id === this.currentUser.id;
                const messageEl = this.createMessageElement(msg, isOwn);
                messagesContainer.appendChild(messageEl);

                // Mark as read if it's incoming
                if (!isOwn && !msg.is_read) {
                    this.markAsRead(msg.id);
                }
            });
        }

        conversationArea.appendChild(messagesContainer);

        // Input area
        const inputArea = document.createElement('div');
        inputArea.style.padding = '15px 20px';
        inputArea.style.borderTop = '1px solid #eee';
        inputArea.style.backgroundColor = '#f8f9fa';
        inputArea.style.display = 'flex';
        inputArea.style.gap = '10px';

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Type a message...';
        input.style.flex = '1';
        input.style.padding = '10px 12px';
        input.style.border = '1px solid #ddd';
        input.style.borderRadius = '6px';
        input.style.fontSize = '0.95rem';
        input.style.fontFamily = 'inherit';

        const sendBtn = document.createElement('button');
        sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
        sendBtn.style.padding = '10px 16px';
        sendBtn.style.backgroundColor = '#3498db';
        sendBtn.style.color = 'white';
        sendBtn.style.border = 'none';
        sendBtn.style.borderRadius = '6px';
        sendBtn.style.cursor = 'pointer';
        sendBtn.style.fontSize = '1rem';
        sendBtn.onmouseover = () => sendBtn.style.backgroundColor = '#2980b9';
        sendBtn.onmouseout = () => sendBtn.style.backgroundColor = '#3498db';

        sendBtn.onclick = async () => {
            const success = await this.sendMessage(otherUserId, input.value);
            if (success) {
                input.value = '';
                // Refresh conversation
                await this.openConversation(otherUserId, userName);
            }
        };

        input.onkeypress = async (e) => {
            if (e.key === 'Enter') {
                const success = await this.sendMessage(otherUserId, input.value);
                if (success) {
                    input.value = '';
                    await this.openConversation(otherUserId, userName);
                }
            }
        };

        inputArea.appendChild(input);
        inputArea.appendChild(sendBtn);
        conversationArea.appendChild(inputArea);

        // Scroll to bottom
        setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 100);
    }

    createMessageElement(msg, isOwn) {
        const el = document.createElement('div');
        el.style.display = 'flex';
        el.style.justifyContent = isOwn ? 'flex-end' : 'flex-start';

        const bubble = document.createElement('div');
        bubble.style.maxWidth = '60%';
        bubble.style.padding = '12px 16px';
        bubble.style.borderRadius = '12px';
        bubble.style.wordWrap = 'break-word';

        if (isOwn) {
            bubble.style.backgroundColor = '#3498db';
            bubble.style.color = 'white';
        } else {
            bubble.style.backgroundColor = '#e9ecef';
            bubble.style.color = '#333';
        }

        const text = document.createElement('div');
        text.textContent = msg.message_text;
        text.style.fontSize = '0.95rem';

        const time = document.createElement('div');
        time.style.fontSize = '0.75rem';
        time.style.marginTop = '6px';
        time.style.opacity = '0.7';
        const date = new Date(msg.created_at);
        time.textContent = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        bubble.appendChild(text);
        bubble.appendChild(time);
        el.appendChild(bubble);

        return el;
    }

    // ============ POLLING ============
    startPolling() {
        // Poll every 5 seconds
        this.pollingInterval = setInterval(async () => {
            await this.loadMessageThreads();
            await this.getUnreadCount();

            // Refresh current conversation if open
            if (this.currentConversation) {
                const messages = await this.getConversation(this.currentConversation.otherUserId);
                const messagesContainer = document.getElementById('messagesContainer');
                if (messagesContainer && messages.length > this.currentConversation.messages.length) {
                    // New messages arrived, refresh
                    const userName = document.querySelector('#conversationArea > div:first-child > h3')?.textContent;
                    this.renderConversation(messages, userName, this.currentConversation.otherUserId);
                }
            }
        }, 5000);
    }

    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }
    }

    destroy() {
        this.stopPolling();
    }
}

// Initialize messaging system when DOM is ready
let messagingSystem = null;

function initializeMessaging() {
    if (!messagingSystem) {
        messagingSystem = new MessagingSystem();
    }
    return messagingSystem;
}

// Export for use in other scripts
window.messagingSystem = initializeMessaging();
