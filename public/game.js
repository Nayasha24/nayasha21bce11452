const socket = io();
let gameState = null;
let playerAssigned = null;
let selectedPiece = null;

function initializeGame() {
    document.getElementById('choosePlayer').style.display = 'block';
    document.getElementById('player-A').addEventListener('click', () => selectPlayer('A'));
    document.getElementById('player-B').addEventListener('click', () => selectPlayer('B'));
}

function selectPlayer(player) {
    socket.emit('joinGame', player);
    document.getElementById('choosePlayer').style.display = 'none';
}

function renderBoard() {
    if(!gameState) return;
    const board = document.getElementById('game-board');
    board.innerHTML = '';
    for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 5; x++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            const piece = gameState.board[y][x];
            if (piece) {
                cell.textContent = piece.split('-')[1];
                cell.classList.add(`piece-${piece[0]}`);
            }
            cell.onclick = () => selectPiece(x, y);
            board.appendChild(cell);
        }
    }
}

function selectPiece(x, y) {
    if (!gameState || gameState.currentPlayer !== playerAssigned) return;
    const piece = gameState.board[y][x];
    if (piece && piece.startsWith(playerAssigned)) {
        selectedPiece = { x, y, type: piece.split('-')[1] };
        document.getElementById('selected-piece').textContent = `Selected: ${piece}`;
        showMoveOptions(piece.split('-')[1]);
        highlightSelectedCell(x, y);
    }
}

function highlightSelectedCell(x, y) {
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => cell.classList.remove('selected'));
    cells[y * 5 + x].classList.add('selected');
}

function showMoveOptions(pieceType) {
    const moveButtons = document.getElementById('move-buttons');
    moveButtons.innerHTML = '';
    const moves = ['F', 'B', 'L', 'R', 'FL', 'FR', 'BL', 'BR'];
    
    moves.forEach(move => {
        const button = document.createElement('button');
        button.textContent = move;
        button.onclick = () => makeMove(move);
        moveButtons.appendChild(button);
    });
}

function makeMove(direction) {
    const pieces = {
        'P': { name: 'Pawn', moves: ['F', 'B', 'L', 'R'], range: 1 },
        'H1': { name: 'Hero1', moves: ['F', 'B', 'L', 'R'], range: 2 },
        'H2': { name: 'Hero2', moves: ['FL', 'FR', 'BL', 'BR'], range: 2 },
        'H3': { name: 'Hero3', moves: ['FL', 'FR', 'BL', 'BR', 'RF', 'RB', 'LF', 'LB'], range: 3 }
    };
    
    
    if (selectedPiece) {
        const pieceType = selectedPiece.type.startsWith('P') ? 'P' : selectedPiece.type;
        const pieceInfo = pieces[pieceType]; // Get the piece info from the pieces object
        
        if (pieceInfo) {
            const directions = {
                'F': [0, -1], 'B': [0, 1], 'L': [-1, 0], 'R': [1, 0],
                'FL': [-1, -1], 'FR': [1, -1], 'BL': [-1, 1], 'BR': [1, 1],
                'RF': [1, -1], 'RB': [1, 1], 'LF': [-1, -1], 'LB': [-1, 1]
            };
            
            if (pieceInfo.moves.includes(direction)) {
                const [dx, dy] = directions[direction];
                const toX = selectedPiece.x + (dx * pieceInfo.range);
                const toY = selectedPiece.y + (dy * pieceInfo.range);
                
                socket.emit('move', {
                    player: playerAssigned,
                    fromX: selectedPiece.x,
                    fromY: selectedPiece.y,
                    toX: toX,
                    toY: toY
                });
            } else {
                console.error('Invalid move direction for the selected piece');
            }
        } else {
            console.error('Selected piece type not found in pieces object');
        }
    } else {
        console.error('No piece selected');
    }
}


function updateStatus() {
    const statusElement = document.getElementById('game-status');
    if (gameState) {
        statusElement.textContent = `Current Player: ${gameState.currentPlayer}`;
    } else {
        statusElement.textContent = 'Waiting for players...';
    }
}

function updateMoveHistory() {
    const historyList = document.getElementById('history-list');
    historyList.innerHTML = gameState.moveHistory.map(move => `<li>${move}</li>`).join('');
}

socket.on('playerAssigned', (player) => {
    playerAssigned = player;
    console.log('Assigned as player:', player);
});

socket.on('gameStart', (state) => {
    gameState = state;
    renderBoard();
    updateStatus();
    updateMoveHistory();
});

socket.on('gameUpdate', (state) => {
    gameState = state;
    renderBoard();
    updateStatus();
    updateMoveHistory();
    selectedPiece = null;
    document.getElementById('selected-piece').textContent = '';
    document.getElementById('move-buttons').innerHTML = '';
});

socket.on('invalidMove', () => {
    alert('Invalid move! Try again.');
});

socket.on('gameOver', ({ result }) => {
    let message;
    if (result === 'draw') {
        message = "Game Over! It's a draw!";
    } else {
        message = `Game Over! Player ${result} wins!`;
    }
    
    const modal = document.getElementById('game-over-modal');
    const messageElement = document.getElementById('game-over-message');
    const newGameButton = document.getElementById('new-game-button');
    
    messageElement.textContent = message;
    modal.style.display = 'block';
    
    newGameButton.onclick = () => {
        modal.style.display = 'none';
        gameState = null;
        selectedPiece = null;
        renderBoard();
        updateStatus();
        document.getElementById('choosePlayer').style.display = 'block';
    };
});

socket.on('gameReset', () => {
    gameState = null;
    selectedPiece = null;
    renderBoard();
    updateStatus();
    document.getElementById('MoveHist').innerHTML = '<h3>Move History</h3><ul id="history-list"></ul>';
    document.getElementById('choosePlayer').style.display = 'block';
});

// Initialize the game
initializeGame();
