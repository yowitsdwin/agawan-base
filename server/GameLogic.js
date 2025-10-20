// server/GameLogic.js
// Fixed to work with dynamic map configurations

const CONSTANTS = require('../shared/constants');

class GameLogic {
  constructor(room) {
    this.room = room;
  }

  update() {
    if (this.room.gameState !== CONSTANTS.GAME_STATES.PLAYING) return;
    
    this.checkPlayerTimers();
    this.checkCollisions();
    this.checkScoring();
    this.room.updatePowerups();
  }

  checkPlayerTimers() {
    for (const player of this.room.players.values()) {
      if (player.state === CONSTANTS.PLAYER_STATES.FROZEN && 
          Date.now() > player.frozenUntil) {
        player.rescue();
        this.room.broadcast('playerStateChanged', { 
          playerId: player.id, 
          state: player.state 
        });
      }
    }
  }

  checkCollisions() {
    const players = Array.from(this.room.players.values());
    
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const p1 = players[i];
        const p2 = players[j];
        
        if (this.isColliding(p1, p2)) {
          this.handleCollision(p1, p2);
        }
      }
    }
  }

  isColliding(p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y) <= 
           CONSTANTS.GAME_CONFIG.PLAYER_SIZE;
  }

  handleCollision(p1, p2) {
    if (p1.canTag(p2)) {
      this.tagPlayer(p1, p2);
    } else if (p2.canTag(p1)) {
      this.tagPlayer(p2, p1);
    }
  }

  tagPlayer(tagger, tagged) {
    if (tagged.state === CONSTANTS.PLAYER_STATES.SHIELDED) return;
    
    tagged.freeze();
    tagger.tags++;
    
    this.room.broadcast('playerTagged', { 
      tagger: tagger.getState(), 
      tagged: tagged.getState() 
    });
    
    this.room.broadcast('playerStateChanged', { 
      playerId: tagged.id, 
      state: tagged.state 
    });
    
    this.checkForTeamWipe();
  }

  handleRescue(rescuer, rescued) {
    if (rescuer.team === rescued.team && 
        rescued.state === CONSTANTS.PLAYER_STATES.FROZEN) {
      rescued.rescue();
      rescuer.rescues++;
      
      this.room.broadcast('playerRescued', { 
        rescuer: rescuer.getState(), 
        rescued: rescued.getState() 
      });
      
      this.room.broadcast('playerStateChanged', { 
        playerId: rescued.id, 
        state: rescued.state 
      });
    }
  }

  checkScoring() {
    for (const player of this.room.players.values()) {
      if (player.state !== CONSTANTS.PLAYER_STATES.FROZEN) {
        const enemyTeam = player.team === CONSTANTS.TEAMS.RED ? 
                          CONSTANTS.TEAMS.BLUE : CONSTANTS.TEAMS.RED;
        
        if (player.isInBase(enemyTeam)) {
          // Check for base capture win condition
          const enemyPlayers = Array.from(this.room.players.values())
            .filter(p => p.team === enemyTeam);
          
          const isBaseOpenForCapture = enemyPlayers.every(p => 
            p.state === CONSTANTS.PLAYER_STATES.FROZEN || 
            !p.isInBase(p.team)
          );
          
          if (isBaseOpenForCapture) {
            this.endGame(player.team, `${player.username} captured the base!`);
            return;
          }
          
          // If base is not open, just score a point
          this.scorePoint(player);
        }
      }
    }
  }

  scorePoint(player) {
    player.score++;
    this.room.teamScores[player.team]++;
    player.resetToBase();
    
    this.room.broadcast('scoreUpdate', { 
      scorer: player.getState(), 
      teamScores: this.room.teamScores 
    });
    
    // Check if winning score is reached (use room's custom winning score)
    if (this.room.teamScores[player.team] >= this.room.settings.winningScore) {
      this.endGame(player.team, "Score limit reached!");
    }
  }

  checkForTeamWipe() {
    const redTeam = Array.from(this.room.players.values())
      .filter(p => p.team === CONSTANTS.TEAMS.RED);
    const blueTeam = Array.from(this.room.players.values())
      .filter(p => p.team === CONSTANTS.TEAMS.BLUE);

    if (redTeam.length > 0 && 
        redTeam.every(p => p.state === CONSTANTS.PLAYER_STATES.FROZEN)) {
      this.endGame(CONSTANTS.TEAMS.BLUE, "Red team is eliminated!");
    } else if (blueTeam.length > 0 && 
               blueTeam.every(p => p.state === CONSTANTS.PLAYER_STATES.FROZEN)) {
      this.endGame(CONSTANTS.TEAMS.RED, "Blue team is eliminated!");
    }
  }
  
  endGame(winnerTeam = null, reason = "Time's up!") {
    if (this.room.gameState === CONSTANTS.GAME_STATES.ENDED) return;
    
    this.room.gameState = CONSTANTS.GAME_STATES.ENDED;
    
    // If no winner is specified (e.g., time ran out), determine by score
    if (!winnerTeam) {
      if (this.room.teamScores.red > this.room.teamScores.blue) {
        winnerTeam = CONSTANTS.TEAMS.RED;
      } else if (this.room.teamScores.blue > this.room.teamScores.red) {
        winnerTeam = CONSTANTS.TEAMS.BLUE;
      }
    }
    
    this.room.broadcast('gameOver', {
      winner: winnerTeam,
      reason: reason,
      finalScores: this.room.teamScores,
      playerStats: this.getPlayerStats()
    });

    // Instead of cleaning up, reset to lobby after 10 seconds
    setTimeout(() => {
      this.room.resetToLobby();
    }, 10000); // 10 seconds to view results
  }

  getPlayerStats() {
    return Array.from(this.room.players.values()).map(p => ({
      username: p.username,
      team: p.team,
      score: p.score,
      tags: p.tags,
      rescues: p.rescues
    }));
  }
}

module.exports = GameLogic;