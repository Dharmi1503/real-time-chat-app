// Wait for page to load
document.addEventListener('DOMContentLoaded', function() {
    // Get all HTML elements we need
    const loginSection = document.getElementById('login-section');
    const chatSection = document.getElementById('chat-section');
    const joinBtn = document.getElementById('join-btn');
    const usernameInput = document.getElementById('username');
    const roomIdInput = document.getElementById('roomId');
    const roomDisplay = document.getElementById('room-display');
    const messagesContainer = document.getElementById('messages');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const connectionStatus = document.getElementById('connection-status');
    const userCount = document.getElementById('user-count');
    
    // Variables to store app state
    let socket = null;
    let currentRoomId = '';
    let currentUsername = '';
    let mySocketId = '';
    let usersInRoom = 1; // Start with yourself
    
    // Set initial state
    updateConnectionStatus(false);
    
    // 1. Handle Join Chat Button Click
    joinBtn.addEventListener('click', joinChat);
    
    // Allow pressing Enter to join chat
    roomIdInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            joinChat();
        }
    });
    
    // 2. Handle Send Message Button Click
    sendBtn.addEventListener('click', sendMessage);
    
    // Allow pressing Enter to send message
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    // Function to join chat room
    function joinChat() {
        // Get values from input fields
        const username = usernameInput.value.trim();
        const roomId = roomIdInput.value.trim();
        
        // Validate inputs
        if (!username || !roomId) {
            alert('❌ Please enter both your name and a room code');
            return;
        }
        
        if (username.length < 2) {
            alert('❌ Please enter a name with at least 2 characters');
            return;
        }
        
        if (roomId.length < 3) {
            alert('❌ Room code should be at least 3 characters');
            return;
        }
        
        // Save values
        currentUsername = username;
        currentRoomId = roomId;
        
        // Show chat section, hide login
        loginSection.style.display = 'none';
        chatSection.style.display = 'block';
        roomDisplay.textContent = roomId;
        
        // Connect to WebSocket server
        connectToServer();
    }
    
    // Function to connect to Socket.io server
    function connectToServer() {
        // For local testing, connect to localhost:3000
        // Change this to your server URL when deploying
        const serverUrl = 'http://localhost:3000';
        
        // Connect to the server
        socket = io(serverUrl);
        
        // Update connection status
        updateConnectionStatus(true);
        
        // Send join request to server
        socket.emit('join-room', {
            roomId: currentRoomId,
            username: currentUsername
        });
        
        // Listen for server responses
        
        // When server welcomes us
        socket.on('welcome', (data) => {
            mySocketId = data.yourId;
            showSystemMessage(data.message);
            
            // Load previous messages if any
            if (data.previousMessages && data.previousMessages.length > 0) {
                showSystemMessage(`📜 Loaded ${data.previousMessages.length} previous messages`);
                
                data.previousMessages.forEach(msg => {
                    const isMyMessage = msg.sender === currentUsername;
                    addMessage(msg.sender, msg.message, msg.timestamp, isMyMessage);
                });
            }
            
            // Enable message input
            messageInput.disabled = false;
            sendBtn.disabled = false;
            messageInput.focus();
        });
        
        // When receiving a new message
        socket.on('receive-message', (data) => {
            const isMyMessage = data.senderId === mySocketId;
            addMessage(data.sender, data.message, data.timestamp, isMyMessage);
        });
        
        // When someone joins the room
        socket.on('user-joined', (data) => {
            showSystemMessage(data.message);
            usersInRoom++;
            updateUserCount();
        });
        
        // When someone leaves the room
        socket.on('user-left', (data) => {
            showSystemMessage(data.message);
            usersInRoom = Math.max(1, usersInRoom - 1);
            updateUserCount();
        });
        
        // Handle connection errors
        socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            showSystemMessage('⚠️ Failed to connect to server. Trying to reconnect...');
            updateConnectionStatus(false);
        });
        
        // When reconnected after disconnection
        socket.on('reconnect', () => {
            showSystemMessage('✅ Reconnected to server');
            updateConnectionStatus(true);
            
            // Rejoin the room
            socket.emit('join-room', {
                roomId: currentRoomId,
                username: currentUsername
            });
        });
        
        // When disconnected from server
        socket.on('disconnect', () => {
            showSystemMessage('🔌 Disconnected from server');
            updateConnectionStatus(false);
        });
    }
    
    // Function to send a message
    function sendMessage() {
        const message = messageInput.value.trim();
        
        // Don't send empty messages
        if (!message || !socket) return;
        
        // Send message to server
        socket.emit('send-message', {
            roomId: currentRoomId,
            sender: currentUsername,
            message: message
        });
        
        // Clear input field and focus it
        messageInput.value = '';
        messageInput.focus();
    }
    
    // Function to add a message to the screen
    function addMessage(sender, text, timestamp, isMyMessage = false) {
        // Create message element
        const messageElement = document.createElement('div');
        
        // Set class based on who sent it
        messageElement.className = `message ${isMyMessage ? 'sent' : 'received'}`;
        
        // Format time (e.g., "2:30 PM")
        const timeString = new Date(timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Add message content (safely escape HTML)
        messageElement.innerHTML = `
            <strong>${escapeHtml(sender)}</strong><br>
            ${escapeHtml(text)}
            <div class="time">${timeString}</div>
        `;
        
        // Add to messages container
        messagesContainer.appendChild(messageElement);
        
        // Scroll to bottom to show new message
        messagesContainer.parentElement.scrollTop = messagesContainer.parentElement.scrollHeight;
    }
    
    // Function to show system messages (join/leave notifications)
    function showSystemMessage(text) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message system';
        messageElement.textContent = text;
        
        messagesContainer.appendChild(messageElement);
        
        // Scroll to bottom
        messagesContainer.parentElement.scrollTop = messagesContainer.parentElement.scrollHeight;
    }
    
    // Function to update connection status indicator
    function updateConnectionStatus(isConnected) {
        if (isConnected) {
            connectionStatus.classList.add('online');
            connectionStatus.innerHTML = '<i class="fas fa-circle"></i> Connected';
        } else {
            connectionStatus.classList.remove('online');
            connectionStatus.innerHTML = '<i class="fas fa-circle"></i> Offline';
        }
    }
    
    // Function to update user count display
    function updateUserCount() {
        userCount.textContent = usersInRoom;
    }
    
    // Helper function to prevent XSS attacks (escape HTML)
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});