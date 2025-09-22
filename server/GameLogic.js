const CONSTANTS = require('../shared/constants');

class GameLogic {
  constructor(room) {
    this.room = room;
  }

  checkCollisions() {
    const activePlayers = Array.from(this.room.players.values())
      .filter(p => p.state === CONSTANTS.PLAYER_STATES.ACTIVE);
    for (let i = 0; i < activePlayers.length; i++) {
      for (let j = i + 1; j < activePlayers.length; j++) {
        const player1 = activePlayers[i];
        const player2 = activePlayers[j];

        if (this.isColliding(player1, player2)) {
          this.handleCollision(player1, player2);
        }
      }
    }
  }

  isColliding(player1, player2) {
    const distance = Math.hypot(player1.x - player2.x, player1.y - player2.y);
    return distance <= CONSTANTS.GAME_CONFIG.PLAYER_SIZE;
  }

  handleCollision(player1, player2) {
    if (player1.canTag(player2)) {
      this.tagPlayer(player1, player2);
    } else if (player2.canTag(player1)) {
      this.tagPlayer(player2, player1);
    }
  }

  tagPlayer(tagger, tagged) {
    tagged.freeze();
    tagger.tags++;
    this.room.broadcast('playerTagged', {
      tagger: tagger.getState(),
      tagged: tagged.getState()
    });
    // **NEW**: Broadcast the specific state change
    this.room.broadcast('playerStateChanged', {
      playerId: tagged.id,
      state: tagged.state
    });
  }

  checkScoring() {
    for (const player of this.room.players.values()) {
      if (player.state === CONSTANTS.PLAYER_STATES.ACTIVE) {
        const enemyTeam = player.team === CONSTANTS.TEAMS.RED ? CONSTANTS.TEAMS.BLUE : CONSTANTS.TEAMS.RED;
        if (player.isInBase(enemyTeam)) {
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
    // Check win condition
    if (this.room.teamScores[player.team] >= CONSTANTS.GAME_CONFIG.WINNING_SCORE) {
      this.endGame(player.team);
    }
  }

  handleRescue(rescuer, rescued) {
    if (rescuer.team === rescued.team && rescued.state === CONSTANTS.PLAYER_STATES.FROZEN) {
      rescued.rescue();
      rescuer.rescues++;
      
      this.room.broadcast('playerRescued', {
        rescuer: rescuer.getState(),
        rescued: rescued.getState()
      });
      // **NEW**: Broadcast the specific state change
      this.room.broadcast('playerStateChanged', {
        playerId: rescued.id,
        state: rescued.state
      });
    }
  }

  endGame(winnerTeam = null) {
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
  }

  getPlayerStats() {
    return Array.from(this.room.players.values()).map(p => ({
      username: p.username, team: p.team,
      score: p.score, tags: p.tags, rescues: p.rescues
    }));
  }
}

module.exports = GameLogic;