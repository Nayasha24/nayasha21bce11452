const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');


const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(path.join(__dirname, 'public')));

let gameState = {
  board: Array(5).fill().map(() => Array(5).fill(null)),
  currentPlayer: 'A',
  players: {},
  moveHistory: []
};

const pieces = {
  'P': { name: 'Pawn', moves: ['F', 'B', 'L', 'R', 'FL', 'FR', 'BL', 'BR'], range: 1 },
  'H1': { name: 'Hero1', moves: ['F', 'B', 'L', 'R'], range: 2 },
  'H2': { name: 'Hero2', moves: ['FL', 'FR', 'BL', 'BR'], range: 2 },
  'H3': { name: 'Hero3', moves: ['FL', 'FR', 'BL', 'BR', 'RF', 'RB', 'LF', 'LB'], range: 2 }
};

function initializeGame() {
  gameState.board = [
    ['A-P1', 'A-H1', 'A-H2', 'A-H3', 'A-P2'],
    [null, null, null, null, null],
    [null, null, null, null, null],
    [null, null, null, null, null],
    ['B-P1', 'B-H1', 'B-H2', 'B-H3', 'B-P2']
  ];
  gameState.currentPlayer = 'A';
  gameState.moveHistory = [];
}

function isValidMove(player, fromX, fromY, toX, toY) {
  const piece = gameState.board[fromY][fromX];
  if (!piece || piece[0] !== player) return false;
  
  const [, type] = piece.split('-');
  const pieceType = pieces[type.startsWith('P') ? 'P' : type];

  // Ensure pieceType exists before accessing its properties
  if (!pieceType) return false;
  
  const dx = toX - fromX;
  const dy = toY - fromY;
  
  // Check if move is out of board bounds
  if (toX < 0 || toX > 4 || toY < 0 || toY > 4) return false;

  // Check if the target position is occupied by the player's own piece
  if (gameState.board[toY][toX] && gameState.board[toY][toX][0] === player) return false;

  // Determine valid moves based on piece type
  switch (pieceType) {
    case 'P': // Pawn moves
      if ((Math.abs(dx) == 1 && dy==0) || Math.abs(dy) == 1 && (dx==0)) {
        return true; // Pawn moves one step in any direction
      }
      break;

    case 'H1': // Hero1 moves (2 steps in any cardinal direction)
      if ((Math.abs(dx) === 2 && dy === 0) || (Math.abs(dy) === 2 && dx === 0)) {
        return true; // Moves exactly 2 steps horizontally or vertically
      }
      break;

    case 'H2': // Hero2 moves (2 steps diagonally)
      if (Math.abs(dx) === 2 && Math.abs(dy) === 2) {
        return true; // Moves exactly 2 steps diagonally
      }
      break;

    case 'H3': // Hero3 moves (3 steps in any direction)
      if ((Math.abs(dx) === 2 && Math.abs(dy) === 1 ) || (Math.abs(dx) === 2 && Math.abs(dy) === 1 ) ){
        return true; // Moves exactly 3 steps in any direction
      }
      break;
      
    default:
      return false; // If piece type is not recognized
  }

  return false; // If no valid move found
}


function processMove(player, fromX, fromY, toX, toY) {
  const piece = gameState.board[fromY][fromX];
  const capturedPiece = gameState.board[toY][toX];
  
  gameState.board[toY][toX] = piece;
  gameState.board[fromY][fromX] = null;
  
  const moveDescription = `${piece}: (${fromX},${fromY}) to (${toX},${toY})${capturedPiece ? ` capturing ${capturedPiece}` : ''}`;
  gameState.moveHistory.push(moveDescription);
  
  gameState.currentPlayer = gameState.currentPlayer === 'A' ? 'B' : 'A';
  return true;
}

function checkGameOver() {
  const aHeroes = gameState.board.flat().filter(cell => cell && cell.startsWith('A-H')).length;
  const bHeroes = gameState.board.flat().filter(cell => cell && cell.startsWith('B-H')).length;
  if (aHeroes === 0) return 'B';
  if (bHeroes === 0) return 'A';
  if (gameState.moveHistory.length >= 100) return 'draw';
  return null;
}

io.on('connection', (socket) => {
  console.log('New client connected');
  
  socket.on('joinGame', (player) => {
    if (!gameState.players[player]) {
      gameState.players[player] = socket.id;
      socket.emit('playerAssigned', player);
      
      if (Object.keys(gameState.players).length === 2) {
        initializeGame();
        io.emit('gameStart', gameState);
      }
    } else {
      socket.emit('gameUpdate', gameState);
    }
  });
  
  socket.on('move', ({ player, fromX, fromY, toX, toY }) => {
    if (player === gameState.currentPlayer && isValidMove(player, fromX, fromY, toX, toY)) {
      processMove(player, fromX, fromY, toX, toY);
      io.emit('gameUpdate', gameState);
      
      const result = checkGameOver();
      if (result) {
        io.emit('gameOver', { result });
      }
    } else {
      socket.emit('invalidMove');
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
    Object.keys(gameState.players).forEach(player => {
      if (gameState.players[player] === socket.id) {
        delete gameState.players[player];
      }
    });
    if (Object.keys(gameState.players).length < 2) {
      gameState = {
        board: Array(5).fill().map(() => Array(5).fill(null)),
        currentPlayer: 'A',
        players: {},
        moveHistory: []
      };
      io.emit('gameReset');
    }
  });
});

const PORT = process.env.PORT || 8000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
