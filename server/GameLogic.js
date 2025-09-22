const CONSTANTS = require('../shared/constants');

class GameLogic {
  constructor(room) {
    this.room = room;
  }

  // Check for collisions between all active players
  checkCollisions() {
    const players = Array.from(this.room.players.values());
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const player1 = players[i];
        const player2 = players[j];
        if (this.isColliding(player1, player2)) {
          this.handleCollision(player1, player2);
        }
      }
    }
  }

  isColliding(p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y) <= CONSTANTS.GAME_CONFIG.PLAYER_SIZE;
  }

  // Handle a collision based on game rules
  handleCollision(player1, player2) {
    // Determine who can tag whom
    if (player1.canTag(player2)) {
      this.tagPlayer(player1, player2);
    } else if (player2.canTag(player1)) {
      this.tagPlayer(player2, player1);
    }
  }

  // Freeze a player and notify everyone
  tagPlayer(tagger, tagged) {
    // A shielded player cannot be tagged
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
  }

  // Check if any players have scored
  checkScoring() {
    for (const player of this.room.players.values()) {
      if (player.state !== CONSTANTS.PLAYER_STATES.FROZEN) {
        const enemyTeam = player.team === CONSTANTS.TEAMS.RED ? CONSTANTS.TEAMS.BLUE : CONSTANTS.TEAMS.RED;
        if (player.isInBase(enemyTeam)) {
          this.scorePoint(player);
        }
      }
    }
  }

  // Award a point and check for a win
  scorePoint(player) {
    player.score++;
    this.room.teamScores[player.team]++;
    player.resetToBase();
    
    this.room.broadcast('scoreUpdate', {
      scorer: player.getState(),
      teamScores: this.room.teamScores
    });
    // Check win condition
    if (this.room.teamScores[player.team] >= CONSTANTS.GAME_CONFIG.WINNING_SCORE) {
      this.endGame(player.team);
    }
  }

  // Handle a rescue attempt
  handleRescue(rescuer, rescued) {
    if (rescuer.team === rescued.team && rescued.state === CONSTANTS.PLAYER_STATES.FROZEN) {
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

  // End the game and declare a winner
  endGame(winnerTeam = null) {
    if (this.room.gameState === CONSTANTS.GAME_STATES.ENDED) return; // Prevent multiple calls
    this.room.gameState = CONSTANTS.GAME_STATES.ENDED;
    
    if (!winnerTeam) {
      if (this.room.teamScores.red > this.room.teamScores.blue) {
        winnerTeam = CONSTANTS.TEAMS.RED;
      } else if (this.room.teamScores.blue > this.room.teamScores.red) {
        winnerTeam = CONSTANTS.TEAMS.BLUE;
      }
    }
    
    this.room.broadcast('gameOver', {
      winner: winnerTeam,
      finalScores: this.room.teamScores,
      playerStats: this.getPlayerStats()
    });

    this.room.cleanup(); // Important to stop timers and loops
  }

  getPlayerStats() {
    return Array.from(this.room.players.values()).map(p => ({
      username: p.username, team: p.team,
      score: p.score, tags: p.tags, rescues: p.rescues
    }));
  }
}

module.exports = GameLogic;
