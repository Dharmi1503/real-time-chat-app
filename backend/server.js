// Load environment variables
require('dotenv').config();

// Import required modules
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

// Create Express app
const app = express();
const server = http.createServer(app);

// Enable CORS for all origins (change in production)
app.use(cors());
app.use(express.json());

// Setup Socket.io with CORS
const io = socketIo(server, {
  cors: {
    origin: "*", // Allows all origins - change this in production
    methods: ["GET", "POST"]
  }
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chatdb')
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.log('❌ MongoDB connection error:', err));

// Create Message Schema for database
const messageSchema = new mongoose.Schema({
  roomId: String,
  sender: String,
  message: String,
  timestamp: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', messageSchema);

// Store active users
const activeUsers = new Map();

// Handle Socket.io connections
io.on('connection', (socket) => {
  console.log('🔗 New user connected:', socket.id);

  // When user joins a room
  socket.on('join-room', async (data) => {
    const { roomId, username } = data;
    
    // Save user info
    activeUsers.set(socket.id, { username, roomId });
    
    // Join the Socket.io room
    socket.join(roomId);
    
    // Load previous messages
    const previousMessages = await Message.find({ roomId })
      .sort({ timestamp: 1 })
      .limit(50); // Limit to last 50 messages
    
    // Send welcome message to the user
    socket.emit('welcome', {
      message: `Welcome to room: ${roomId}`,
      previousMessages,
      yourId: socket.id
    });
    
    // Notify others in the room
    socket.to(roomId).emit('user-joined', {
      username,
      message: `${username} joined the chat`
    });
    
    console.log(`👤 ${username} joined room: ${roomId}`);
  });

  // Handle new messages
  socket.on('send-message', async (data) => {
    const { roomId, message, sender } = data;
    
    // Save message to database
    const newMessage = new Message({
      roomId,
      sender,
      message,
      timestamp: new Date()
    });
    
    await newMessage.save();
    
    // Send to everyone in the room
    io.to(roomId).emit('receive-message', {
      sender,
      message,
      timestamp: new Date(),
      senderId: socket.id
    });
    
    console.log(`💬 Message in ${roomId} from ${sender}: ${message}`);
  });

  // Handle user disconnect
  socket.on('disconnect', () => {
    const user = activeUsers.get(socket.id);
    
    if (user) {
      // Notify others
      socket.to(user.roomId).emit('user-left', {
        username: user.username,
        message: `${user.username} left the chat`
      });
      
      // Remove from active users
      activeUsers.delete(socket.id);
      console.log(`👋 ${user.username} disconnected`);
    }
  });
});

// Health check route
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Chat server is running',
    timestamp: new Date() 
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket server ready for connections`);
});