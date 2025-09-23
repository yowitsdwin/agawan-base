const CONSTANTS = require('../../shared/constants');
const Room = require('../Room');

function setupSocketEvents(io, rooms, Player) {
  io.on('connection', (socket) => {
    let currentPlayer = null;
    let currentRoom = null;

    // --- Connection and Lobby Events ---

    socket.on('joinGame', (data) => {
      try {
        const roomId = 'main'; // All players join the same main room for now

        // Sanitize username to prevent errors and ensure it's valid
        let username = (data.username || `Player_${socket.id.substr(0, 4)}`).substring(0, 20).trim();
        if (!username) {
          username = `Player_${socket.id.substr(0, 4)}`;
        }

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

    socket.on('changeTeam', () => {
      try {
        if (currentPlayer && currentRoom) {
          currentRoom.changeTeam(currentPlayer.id);
        }
      } catch (error) {
        console.error(`[changeTeam] Error for socket ${socket.id}:`, error);
      }
    });

    socket.on('playerReady', () => {
      try {
        if (currentPlayer && currentRoom) {
          currentRoom.setPlayerReady(currentPlayer.id);
        }
      } catch (error) {
        console.error(`[playerReady] Error for socket ${socket.id}:`, error);
      }
    });

    // --- In-Game Action Events ---

    socket.on('updatePosition', (data) => {
      // Anti-cheat movement validation
      if (currentPlayer && currentRoom && data && typeof data.x === 'number' && typeof data.y === 'number') {
        const now = Date.now();
        const deltaTime = (now - currentPlayer.lastUpdate) / 1000;
        const distance = Math.hypot(data.x - currentPlayer.x, data.y - currentPlayer.y);
        const maxDistance = CONSTANTS.GAME_CONFIG.PLAYER_SPEED * deltaTime * 1.15; // 15% latency buffer
        
        if (distance > maxDistance && deltaTime > 0) {
            return; // Ignore the invalid move
        }

        currentPlayer.updatePosition(data.x, data.y);
        currentPlayer.lastUpdate = now;
      }
    });

    socket.on('rescuePlayer', (data) => {
      try {
        if (currentPlayer && currentRoom && data && data.targetId) {
          const targetPlayer = currentRoom.players.get(data.targetId);
          if (targetPlayer) {
            currentRoom.gameLogic.handleRescue(currentPlayer, targetPlayer);
          }
        }
      } catch(error) {
        console.error(`[rescuePlayer] Error for socket ${socket.id}:`, error);
      }
    });
    
    socket.on('collectPowerup', (data) => {
      try {
        if (currentPlayer && currentRoom && data && data.powerupId) {
          if (currentRoom.powerups.has(data.powerupId)) {
            const powerup = CONSTANTS.POWERUPS[Object.keys(CONSTANTS.POWERUPS).find(key => CONSTANTS.POWERUPS[key].id === data.powerupType)];
            if (powerup) {
              currentPlayer.addPowerup(powerup);
            }
            currentRoom.powerups.delete(data.powerupId);
            currentRoom.broadcast('powerupCollected', { playerId: currentPlayer.id, powerupId: data.powerupId });
          }
        }
      } catch (error) {
        console.error(`[collectPowerup] Error for socket ${socket.id}:`, error);
      }
    });

    socket.on('chatMessage', (data) => {
      try {
        if (currentPlayer && currentRoom && data && typeof data.message === 'string') {
          const message = data.message.substring(0, 100).trim();
          const type = (data.type === 'team') ? 'team' : 'global';
          if (message.length === 0) return;
          
          const messageData = {
            username: currentPlayer.username, team: currentPlayer.team,
            message: message, type: type, timestamp: Date.now()
          };
          
          if (type === 'team') {
            currentRoom.players.forEach(p => {
              if (p.team === currentPlayer.team) p.socket.emit('chatMessage', messageData);
            });
          } else {
            currentRoom.broadcast('chatMessage', messageData);
          }
        }
      } catch (error) {
        console.error(`[chatMessage] Error for socket ${socket.id}:`, error);
      }
    });

    // --- Disconnect Event ---

    socket.on('disconnect', () => {
      console.log('Player disconnected:', socket.id);
      try {
        if (currentPlayer && currentRoom) {
          currentRoom.removePlayer(currentPlayer.id);
          
          // If the room becomes empty, clean it up from the server's memory
          if (currentRoom.players.size === 0) {
            currentRoom.cleanup();
            rooms.delete(currentRoom.id);
          }
        }
      } catch (error) {
        console.error(`[disconnect] Error for socket ${socket.id}:`, error);
      }
    });
  });
}

module.exports = setupSocketEvents;

