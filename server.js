const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: {
        origin: "*", // In production, replace with your specific domain
        methods: ["GET", "POST"]
    }
});
const path = require('path');

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve index.html for all routes (for client-side routing)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Game state
const rooms = new Map();

// Generate a random room code
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Handle room creation
    socket.on('createRoom', () => {
        console.log('Received createRoom request from:', socket.id);
        try {
            const roomCode = generateRoomCode();
            console.log('Generated room code:', roomCode);
            
            rooms.set(roomCode, {
                host: socket.id,
                players: new Map([[socket.id, {
                    id: socket.id,
                    position: { x: 0, y: 1, z: 0 },
                    rotation: { x: 0, y: 0, z: 0 },
                    color: 0x00ff00
                }]])
            });
            
            socket.join(roomCode);
            console.log('Socket joined room:', roomCode);
            
            // Send room creation confirmation
            socket.emit('roomCreated', { roomCode });
            console.log('Sent roomCreated event to:', socket.id, 'with code:', roomCode);
        } catch (error) {
            console.error('Error creating room:', error);
            socket.emit('roomError', 'Failed to create room');
        }
    });

    // Handle room joining
    socket.on('joinRoom', (roomCode) => {
        const room = rooms.get(roomCode);
        if (room) {
            socket.join(roomCode);
            
            // Add new player to room
            const newPlayer = {
                id: socket.id,
                position: { x: 3, y: 1, z: 0 },
                rotation: { x: 0, y: 0, z: 0 },
                color: 0xff0000
            };
            room.players.set(socket.id, newPlayer);

            // Send current players to the new player
            socket.emit('roomJoined', {
                roomCode,
                players: Array.from(room.players.values())
            });

            // Notify other players about the new player
            socket.to(roomCode).emit('playerJoined', newPlayer);
            
            console.log(`Player ${socket.id} joined room ${roomCode}`);
            console.log('Current players in room:', Array.from(room.players.keys()));
        } else {
            socket.emit('roomError', 'Room not found');
        }
    });

    // Handle player movement
    socket.on('playerMove', (data) => {
        const { roomCode, position, rotation } = data;
        const room = rooms.get(roomCode);
        
        if (room && room.players.has(socket.id)) {
            // Update player data
            const playerData = room.players.get(socket.id);
            playerData.position = position;
            playerData.rotation = rotation;
            
            // Broadcast movement to other players in the room
            socket.to(roomCode).emit('playerMoved', {
                id: socket.id,
                position: position,
                rotation: rotation
            });
            
            console.log(`Player ${socket.id} moved in room ${roomCode}:`, position);
        }
    });

    // Handle leaving room
    socket.on('leaveRoom', (roomCode) => {
        const room = rooms.get(roomCode);
        if (room) {
            socket.leave(roomCode);
            room.players.delete(socket.id);
            
            // If host left, close the room
            if (room.host === socket.id) {
                io.to(roomCode).emit('roomClosed');
                rooms.delete(roomCode);
                console.log(`Room ${roomCode} closed`);
            } else {
                // Notify other players about the disconnection
                io.to(roomCode).emit('playerDisconnected', socket.id);
            }
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        
        // Find and remove player from their room
        for (const [roomCode, room] of rooms.entries()) {
            if (room.players.has(socket.id)) {
                room.players.delete(socket.id);
                
                // If host left, close the room
                if (room.host === socket.id) {
                    io.to(roomCode).emit('roomClosed');
                    rooms.delete(roomCode);
                    console.log(`Room ${roomCode} closed`);
                } else {
                    // Notify other players about the disconnection
                    io.to(roomCode).emit('playerDisconnected', socket.id);
                }
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 