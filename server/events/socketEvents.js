const CONSTANTS = require('../../shared/constants');

function setupSocketEvents(io, rooms, Player) {
  io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);
    
    let currentPlayer = null;
    let currentRoom = null;

    socket.on('joinGame', (data) => {
      const { username, roomId = 'main' } = data;
      
      // Create or get room
      if (!rooms.has(roomId)) {
        const Room = require('../Room');
        rooms.set(roomId, new Room(roomId));
      }
      
      currentRoom = rooms.get(roomId);
      currentPlayer = new Player(socket.id, socket, username || `Player_${socket.id.substr(0, 4)}`);
      
      currentRoom.addPlayer(currentPlayer);
    });

    socket.on('updatePosition', (data) => {
      if (currentPlayer && currentRoom) {
        currentPlayer.updatePosition(data.x, data.y);
        
        // Broadcast position to other players
        socket.to(currentRoom.id).emit('playerMoved', {
          playerId: currentPlayer.id,
          x: data.x,
          y: data.y,
          state: currentPlayer.state
        });
      }
    });

    socket.on('rescuePlayer', (data) => {
      if (currentPlayer && currentRoom) {
        const targetPlayer = currentRoom.players.get(data.targetId);
        if (targetPlayer) {
          currentRoom.gameLogic.handleRescue(currentPlayer, targetPlayer);
        }
      }
    });

    socket.on('chatMessage', (data) => {
      if (currentPlayer && currentRoom) {
        const messageData = {
          playerId: currentPlayer.id,
          username: currentPlayer.username,
          team: currentPlayer.team,
          message: data.message,
          type: data.type || 'global',
          timestamp: Date.now()
        };
        
        if (data.type === 'team') {
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
    });

    socket.on('collectPowerup', (data) => {
      if (currentPlayer && currentRoom) {
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
    });

    socket.on('disconnect', () => {
      console.log('Player disconnected:', socket.id);
      
      if (currentPlayer && currentRoom) {
        currentRoom.removePlayer(currentPlayer.id);
        
        // Clean up empty rooms
        if (currentRoom.players.size === 0) {
          currentRoom.cleanup();
          rooms.delete(currentRoom.id);
        }
      }
    });
  });
}

module.exports = setupSocketEvents;