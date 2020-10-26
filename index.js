const app = require('express')();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const port = process.env.PORT || 3001;

const Database = require('./database');

app.get('/', (req, res) => {
  res.send({ some: 'response '}).status(200);
});

http.listen(port, () => {
  console.log('listening on *:' + port);
});

io.on('connection', (socket) => {
  console.log('Someone Connected!');

  socket.on('createRoom', () => {
    const roomCode = Database.createRoom({ host: socket.id });
    console.log('createdRoom:', roomCode);
    socket.join(roomCode);
    socket.emit('createdRoom', { roomCode });
  });

  socket.on('joinRoom', (request) => {
    const roomCode = request.roomCode;
    const player = Database.joinRoom({
      roomCode,
      playerId: socket.id,
      username: request.username
    });

    if (player) {
      socket.join(roomCode);
      socket.emit('joinedRoom', { player });
      io.in(roomCode).emit('playerList', { players: Database.getPlayersInRoom(roomCode) });
    } else {
      console.log('joining room failed!')
      socket.emit('joinRoomFailed');
    }
  });

  socket.on('startGame', (request) => {
    const roomCode = request.roomCode;
    Database.startGame({ roomCode });
    io.in(roomCode).emit('startedGame');
  });

  socket.on('submitPrompt', (request) => {
    const roomCode = request.roomCode;
    const prompt = request.prompt;
    const numPrompts = Database.submitPrompt({ roomCode, prompt });

    if (numPrompts > 3) {
      // TODO: We should have a timer rather than a hard cap to match jackbox
      // Once the timer ends (or cap is reached) move to stage 1
      io.in(roomCode).emit('stageChanged', { stage: 1 });

      // Game specific
      // In the future you'd have to send out separate prompts
      // Could probably combine these 2 messages *shrugs*
      io.in(roomCode).emit('prompts', Database.getPrompts({ roomCode }));
    }
  });

  socket.on('submitAnswer', (request) => {
    const roomCode = request.roomCode;
    const promptIndex = request.promptIndex;
    const player = request.player;
    const answer = request.answer;

    const shouldEnd = Database.submitAnswer({ roomCode, promptIndex, player, answer });

    if (shouldEnd) {
      io.in(roomCode).emit('stageChanged', { stage: 2 });
      io.in(roomCode).emit('answers', Database.getAnswers({ roomCode }));
    }
  });

  socket.on('vote', ({ roomCode, answer }) => {
    const vote = Database.vote({ roomCode, answer });

    if (vote.voteComplete) {
      if (vote.gameOver) {
        io.in(roomCode).emit('gameOver', Database.getResults({ roomCode }));
      } else {
        io.in(roomCode).emit('promptChange', { promptIndex: 1 });
      }
    }
  });
});
