const CONSTANTS = require('../../shared/constants.js');
const Room = require('../Room.js');

function setupSocketEvents(io, rooms, Player) {
  io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);
    
    let currentPlayer = null;
    let currentRoom = null;

    socket.on('joinGame', (data) => {
      try {
        const roomId = 'main'; // Simplified to one main room
        
        // **NEW**: Input sanitization
        let username = data.username || `Player_${socket.id.substr(0, 4)}`;
        if (typeof username !== 'string' || username.length === 0) {
            username = `Player_${socket.id.substr(0, 4)}`;
        }
        username = username.substring(0, 20).trim();

        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Room(roomId));
        }
        
        currentRoom = rooms.get(roomId);
        currentPlayer = new Player(socket.id, socket, username);
        
        currentRoom.addPlayer(currentPlayer);
        socket.join(roomId);

      } catch (error) {
        console.error(`[joinGame] Error for socket ${socket.id}:`, error);
        socket.emit('serverError', { message: 'An error occurred while joining the game.' });
      }
    });

    socket.on('updatePosition', (data) => {
      // **NEW**: Anti-cheat movement validation
      if (currentPlayer && currentRoom && data && typeof data.x === 'number' && typeof data.y === 'number') {
        const now = Date.now();
        const deltaTime = (now - currentPlayer.lastUpdate) / 1000; // time in seconds
        
        const distance = Math.hypot(data.x - currentPlayer.x, data.y - currentPlayer.y);
        const maxDistance = CONSTANTS.GAME_CONFIG.PLAYER_SPEED * deltaTime * 1.15; // 15% latency buffer
        
        if (distance > maxDistance && deltaTime > 0) {
            // console.warn(`Player ${currentPlayer.username} moved too fast. Cheating suspected.`);
            return; // Ignore invalid move
        }

        currentPlayer.updatePosition(data.x, data.y);
        currentPlayer.lastUpdate = now;
        
        // Broadcast validated position to other players in the room
        socket.to(currentRoom.id).emit('playerMoved', {
          playerId: currentPlayer.id,
          x: currentPlayer.x, // Use server-authoritative position
          y: currentPlayer.y,
        });
      }
    });

    socket.on('rescuePlayer', (data) => {
      // **NEW**: try...catch for stability
      try {
        if (currentPlayer && currentRoom && data && data.targetId) {
          const targetPlayer = currentRoom.players.get(data.targetId);
          if (targetPlayer) {
            currentRoom.gameLogic.handleRescue(currentPlayer, targetPlayer);
          }
        }
      } catch(error) {
        console.error(`[rescuePlayer] Error for socket ${socket.id}:`, error);
        socket.emit('serverError', { message: 'An error occurred during rescue attempt.' });
      }
    });

    socket.on('chatMessage', (data) => {
      try {
        if (currentPlayer && currentRoom && data && typeof data.message === 'string') {
          // **NEW**: Input sanitization
          const message = data.message.substring(0, 100).trim();
          const type = (data.type === 'team') ? 'team' : 'global';

          if (message.length === 0) return;
          
          const messageData = {
            username: currentPlayer.username,
            team: currentPlayer.team,
            message: message,
            type: type,
            timestamp: Date.now()
          };
          
          if (type === 'team') {
            // Send to team members only
            currentRoom.players.forEach(player => {
              if (player.team === currentPlayer.team) {
                player.socket.emit('chatMessage', messageData);
              }
            });
          } else {
            // Send to all players in room
            currentRoom.broadcast('chatMessage', messageData);
          }
        }
      } catch (error) {
        console.error(`[chatMessage] Error for socket ${socket.id}:`, error);
      }
    });

    socket.on('collectPowerup', (data) => {
      try {
        if (currentPlayer && currentRoom && data && data.powerupId) {
          const powerup = currentRoom.powerups.get(data.powerupId);
          if (powerup) {
            currentPlayer.addPowerup(powerup.type);
            currentRoom.powerups.delete(data.powerupId);
            
            currentRoom.broadcast('powerupCollected', {
              playerId: currentPlayer.id,
              powerupId: data.powerupId,
              powerupType: powerup.type
            });
          }
        }
      } catch (error) {
        console.error(`[collectPowerup] Error for socket ${socket.id}:`, error);
      }
    });

    socket.on('disconnect', () => {
      console.log('Player disconnected:', socket.id);
      try {
        if (currentPlayer && currentRoom) {
          currentRoom.removePlayer(currentPlayer.id);
          
          if (currentRoom.players.size === 0) {
            currentRoom.cleanup();
            rooms.delete(currentRoom.id);
            console.log(`Room ${currentRoom.id} is empty and has been cleaned up.`);
          }
        }
      } catch (error) {
        console.error(`[disconnect] Error for socket ${socket.id}:`, error);
      }
    });
  });
}

module.exports = setupSocketEvents;