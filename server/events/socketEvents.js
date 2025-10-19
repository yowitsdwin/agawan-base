// server/events/socketEvents.js
// Comprehensive socket event handling with lobby system

const CONSTANTS = require('../../shared/constants');

function setupSocketEvents(io, lobbyManager, Player) {
  io.on('connection', (socket) => {
    let currentPlayer = null;
    let currentRoom = null;

    console.log(`[Socket] Player connected: ${socket.id}`);

    // ==================== LOBBY EVENTS ====================

    socket.on('createLobby', (data) => {
      try {
        const username = sanitizeUsername(data.username, socket.id);
        const settings = {
          map: data.settings?.map || 'classic',
          winningScore: data.settings?.winningScore || CONSTANTS.GAME_CONFIG.DEFAULT_WINNING_SCORE,
          gameMode: data.settings?.gameMode || CONSTANTS.GAME_MODES.DAY
        };

        const { lobbyId, lobby } = lobbyManager.createLobby(socket.id, username, settings);
        
        currentRoom = lobby;
        currentPlayer = new Player(socket.id, socket, username);
        
        if (currentRoom.addPlayer(currentPlayer)) {
          socket.join(lobbyId);
          socket.emit('lobbyCreated', { 
            lobbyId, 
            roomState: currentRoom.getRoomState() 
          });
          console.log(`[Lobby] ${username} created lobby ${lobbyId}`);
        }
      } catch (error) {
        console.error(`[createLobby] Error:`, error);
        socket.emit('serverError', { 
          message: error.message || 'Failed to create lobby',
          code: 'CREATE_LOBBY_FAILED'
        });
      }
    });

    socket.on('joinLobby', (data) => {
      try {
        const lobbyId = data.lobbyId?.toUpperCase().trim();
        const username = sanitizeUsername(data.username, socket.id);

        if (!lobbyId || lobbyId.length !== CONSTANTS.LOBBY.ID_LENGTH) {
          socket.emit('serverError', { 
            message: 'Invalid lobby code',
            code: 'INVALID_LOBBY_CODE'
          });
          return;
        }

        const lobby = lobbyManager.getLobby(lobbyId);
        if (!lobby) {
          socket.emit('serverError', { 
            message: 'Lobby not found',
            code: 'LOBBY_NOT_FOUND'
          });
          return;
        }

        currentRoom = lobby;
        currentPlayer = new Player(socket.id, socket, username);
        
        if (currentRoom.addPlayer(currentPlayer)) {
          socket.join(lobbyId);
          socket.emit('lobbyJoined', { 
            lobbyId, 
            roomState: currentRoom.getRoomState() 
          });
          console.log(`[Lobby] ${username} joined lobby ${lobbyId}`);
        }
      } catch (error) {
        console.error(`[joinLobby] Error:`, error);
        socket.emit('serverError', { 
          message: error.message || 'Failed to join lobby',
          code: 'JOIN_LOBBY_FAILED'
        });
      }
    });

    socket.on('updateLobbySettings', (data) => {
      try {
        if (!currentRoom || !currentPlayer) return;
        
        // Only host can change settings
        if (currentPlayer.id !== currentRoom.settings.hostId) {
          socket.emit('serverError', { 
            message: 'Only the host can change settings',
            code: 'NOT_HOST'
          });
          return;
        }

        const result = currentRoom.updateLobbySettings(data.settings);
        if (!result.success) {
          socket.emit('serverError', { 
            message: result.message,
            code: 'SETTINGS_UPDATE_FAILED'
          });
        }
      } catch (error) {
        console.error(`[updateLobbySettings] Error:`, error);
      }
    });

    socket.on('changeTeam', () => {
      try {
        if (currentPlayer && currentRoom) {
          currentRoom.changeTeam(currentPlayer.id);
        }
      } catch (error) {
        console.error(`[changeTeam] Error:`, error);
      }
    });

    socket.on('playerReady', () => {
      try {
        if (currentPlayer && currentRoom) {
          currentRoom.setPlayerReady(currentPlayer.id);
        }
      } catch (error) {
        console.error(`[playerReady] Error:`, error);
      }
    });

    // ==================== GAME EVENTS ====================

    socket.on('updatePosition', (data) => {
      if (!currentPlayer || !currentRoom || !data || 
          typeof data.x !== 'number' || typeof data.y !== 'number') {
        return;
      }

      const now = Date.now();
      const deltaTime = (now - currentPlayer.lastUpdate) / 1000;
      const distance = Math.hypot(data.x - currentPlayer.x, data.y - currentPlayer.y);
      const maxDistance = CONSTANTS.GAME_CONFIG.PLAYER_SPEED * 
                          currentPlayer.speedMultiplier * deltaTime * 1.15;
      
      if (distance > maxDistance && deltaTime > 0) {
        return; // Anti-cheat: ignore invalid movement
      }

      currentPlayer.updatePosition(data.x, data.y);
      currentPlayer.lastUpdate = now;
    });

    socket.on('rescuePlayer', (data) => {
      try {
        if (currentPlayer && currentRoom && data && data.targetId) {
          const targetPlayer = currentRoom.players.get(data.targetId);
          if (targetPlayer) {
            currentRoom.gameLogic.handleRescue(currentPlayer, targetPlayer);
          }
        }
      } catch (error) {
        console.error(`[rescuePlayer] Error:`, error);
      }
    });
    
    socket.on('collectPowerup', (data) => {
      try {
        if (currentPlayer && currentRoom && data && data.powerupId) {
          if (currentRoom.powerups.has(data.powerupId)) {
            const powerupType = data.powerupType;
            const powerup = CONSTANTS.POWERUPS[
              Object.keys(CONSTANTS.POWERUPS).find(
                key => CONSTANTS.POWERUPS[key].id === powerupType
              )
            ];
            
            if (powerup) {
              currentPlayer.addPowerup(powerup);
            }
            
            currentRoom.powerups.delete(data.powerupId);
            currentRoom.broadcast('powerupCollected', { 
              playerId: currentPlayer.id, 
              powerupId: data.powerupId 
            });
          }
        }
      } catch (error) {
        console.error(`[collectPowerup] Error:`, error);
      }
    });

    // ==================== CHAT EVENTS ====================

    socket.on('chatMessage', (data) => {
      try {
        if (!currentPlayer || !currentRoom || !data || 
            typeof data.message !== 'string') {
          return;
        }

        const message = data.message.substring(0, CONSTANTS.VALIDATION.MESSAGE_MAX_LENGTH).trim();
        const type = (data.type === 'team') ? 'team' : 'global';
        
        if (message.length === 0) return;

        currentRoom.addChatMessage(currentPlayer.id, message, type);
      } catch (error) {
        console.error(`[chatMessage] Error:`, error);
      }
    });

    // ==================== DISCONNECT EVENT ====================

    socket.on('disconnect', () => {
      console.log(`[Socket] Player disconnected: ${socket.id}`);
      
      try {
        if (currentPlayer && currentRoom) {
          currentRoom.removePlayer(currentPlayer.id);
          
          // Clean up empty lobbies
          if (currentRoom.players.size === 0) {
            lobbyManager.deleteLobby(currentRoom.id);
          }
        }
      } catch (error) {
        console.error(`[disconnect] Error:`, error);
      }
    });
  });
}

// Helper function to sanitize username
function sanitizeUsername(username, socketId) {
  let sanitized = (username || `Player_${socketId.substr(0, 4)}`)
    .substring(0, CONSTANTS.VALIDATION.USERNAME_MAX_LENGTH)
    .trim();
  
  if (sanitized.length < CONSTANTS.VALIDATION.USERNAME_MIN_LENGTH) {
    sanitized = `Player_${socketId.substr(0, 4)}`;
  }
  
  return sanitized;
}

module.exports = setupSocketEvents;