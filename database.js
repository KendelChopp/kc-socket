const VALID_ROOM_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

class Answer {
  constructor({ id, value, player, prompt, promptIndex }) {
    this.id = id;
    this.value = value;
    this.player = player;
    this.prompt = prompt;
    this.promptIndex = promptIndex;
    this.votes = 0;
  }

  addVote() {
    this.votes++;
    this.player.addPoint();
  }
}

// One to many relationship with Answer
class Prompt {
  constructor({ value, player }) {
    this.value = value;
    this.player = player;
    this.answers = [];
  }

  get numAnswers() {
    return this.answers.length;
  }

  addAnswer(answer) {
    this.answers.push(answer);
  }

  getAnswer(answer) {
    return this.answers.find((potentialAnswer) => potentialAnswer.id === answer.id);
  }
}

class Player {
  constructor({ id, username, isVip = false }) {
    this.id = id;
    this.username = username;
    this.isVip = isVip;
    this.points = 0;
  }

  addPoint() {
    this.points++;
  }
}

class Room {
  constructor({ roomCode, host }) {
    this.roomCode = roomCode;
    this.host = host;
    this.vip = null;
    this.players = {};

    // TODO: this should be contained on a per-game basis
    this.inProgress = false;
    this.prompts = [];
    this.promptOne = null;
    this.promptTwo = null;
    /**
     * The stage of the game. This Should be game dependent
     * 0: Prompt Writing
     * 1: Answer Writing
     * 2: Voting
     *
     * @type {number}
     */
    this.stage = 0;
    this.promptIndex = 0;
    this.answerIncrementer = 1;
    this.totalVotes = 0;
  }

  get numPlayers() {
    return Object.keys(this.players).length;
  }

  /**
   * Create a player and add them to the lobby
   *
   * @returns {Player} the newly created player
   */
  joinPlayer({ playerId, username }) {
    const isVip = !Boolean(this.vip);
    const player = new Player({ id: playerId, username, isVip });
    this.players[playerId] = player;
    if (isVip) {
      this.vip = player;
    }
    return player;
  }

  /**
   * Set  the game to in progress and the stage to 0
   */
  startGame() {
    // TODO: should check there are enough players and that it was actually the VIP that started it
    this.inProgress = true;
    this.stage = 0;
    this.prompts = [];
  }

  // =================================
  // ========= GAME SPECIFIC =========
  // =================================

  /**
   * Submit a prompt for people to answer
   *
   * @returns {Number} the number of prompts
   */
  submitPrompt(prompt) {
    this.prompts.push(prompt);
    return this.prompts.length;
  }

  /**
   * Grabs 2 random prompts from the list of prompts
   *
   * @returns {Object} containing promptOne and promptTwo
   */
  getPrompts() {
    const promptOne = this.prompts.splice(Math.floor(Math.random()*this.prompts.length), 1)[0];
    const promptTwo = this.prompts.splice(Math.floor(Math.random()*this.prompts.length), 1)[0];

    // player would have to be populated during the submit period
    this.promptOne = new Prompt({ value: promptOne, player: null });
    this.promptTwo = new Prompt({ value: promptTwo, player: null });

    return {
      promptOne: this.promptOne,
      promptTwo: this.promptTwo
    };
  }

  get currentPrompt() {
    if (this.promptIndex === 0) {
      return this.promptOne;
    }

    return this.promptTwo;
  }

  /**
   * Submits an answer. Prompt in this context is a 0 or 1
   *
   * @returns {Boolean} true if everyone has submitted prompt two, false otherwise
   */
  submitAnswer({ promptIndex, player, answer }) {
    const pickedPrompt = promptIndex === 0 ? this.promptOne : this.promptTwo;
    const id = this.answerIncrementer++;
    const pickedPlayer = this.players[player.id];
    pickedPrompt.addAnswer(new Answer({ id, value: answer, player: pickedPlayer, promptIndex }));

    const allAnswered = this.promptTwo.numAnswers === this.numPlayers;
    if (allAnswered) {
      this.stage = 2;
    }

    return allAnswered;
  }

  getAnswers() {
    return {
      promptOne: this.promptOne,
      promptTwo: this.promptTwo
    }
  }

  vote(answer) {
    this.currentPrompt.getAnswer(answer).addVote();
    this.totalVotes++;

    if (this.totalVotes === this.numPlayers) {
      this.totalVotes = 0;
      this.promptIndex++;

      return {
        voteComplete: true,
        gameOver: this.promptIndex > 1
      };
    }

    return { voteComplete: false };
  }

  getResults() {
    return {
      players: Object.values(this.players),
      promptOne: this.promptOne,
      promptTwo: this.promptTwo
    };
  }
}

const Database = {
  rooms: {},

  /**
   * Creates a new room with a unique 4 digit code
   *
   * @returns {String} the room code
   */
  createRoom({ host }) {
    let roomCode;
    while (!roomCode || this.rooms[roomCode]) {
      roomCode = '';
      for (let i = 0; i < 4; i++) {
        roomCode += VALID_ROOM_CHARACTERS.charAt(Math.floor(Math.random() * 26));
      }
    }

    this.rooms[roomCode] = new Room({ roomCode, host });
    return roomCode;
  },

  /**
   * Whether or not the given room exists
   *
   * @returns {boolean}
   */
  hasRoom(roomCode) {
    if (!roomCode) {
      return false;
    }

    return Boolean(this.rooms[roomCode]);
  },

  /**
   * Get all of the players in a given room
   *
   * @returns {Player[]}
   */
  getPlayersInRoom(roomCode) {
    return Object.values(this.rooms[roomCode].players);
  },

  /**
   * join a room
   *
   * @returns {Object} idk some information about the player
   */
  joinRoom({ roomCode, playerId, username }) {
    if (this.hasRoom(roomCode)) {
      return this.rooms[roomCode].joinPlayer({ playerId, username });
    }

    return null;
  },

  /**
   * Start the game for the given room
   */
  startGame({ roomCode }) {
    this.rooms[roomCode].startGame();
  },

  // =================================
  // ========= GAME SPECIFIC =========
  // =================================

  /**
   * Submit a prompt for people to answer
   *
   * @returns {Number} the number of prompts
   */
  submitPrompt({ roomCode, prompt }) {
    return this.rooms[roomCode].submitPrompt(prompt);
  },

  /**
   * Grabs 2 prompts from the room
   *
   * @returns {Object} containing promptOne and promptTwo
   */
  getPrompts({ roomCode }) {
    return this.rooms[roomCode].getPrompts();
  },

  /**
   * Submits an answer returns true if the stage should end
   *
   * @returns {boolean} whether or not the stage should end
   */
  submitAnswer({ roomCode, promptIndex, player, answer }) {
    return this.rooms[roomCode].submitAnswer({ promptIndex, player, answer });
  },

  getAnswers({ roomCode }) {
    return this.rooms[roomCode].getAnswers();
  },

  vote({ roomCode, answer }) {
    return this.rooms[roomCode].vote(answer);
  },

  getResults({ roomCode }) {
    return this.rooms[roomCode].getResults();
  }
};

module.exports = Database;
