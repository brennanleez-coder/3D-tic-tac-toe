import { CellValue, GameState, Player, Position, WinningLine } from '@/types/game';

const BOARD_SIZE = 4;

// Move record for history
export interface Move {
  player: Player;
  position?: Position; // Optional for non-move events like timeouts
  timestamp: number;
  type?: 'move' | 'skip';
  reason?: 'timeout';
}

// Threat: a line where one player has 3 pieces and 1 empty
export interface Threat {
  player: Player;
  line: Position[];
  emptyCell: Position;
}

// Extended game state with history and threats
export interface ExtendedGameState extends GameState {
  moveHistory: Move[];
  threats: Threat[];
  lastMovePosition: Position | null;
}

/**
 * Creates an empty 4x4x4 game board
 */
export function createEmptyBoard(): CellValue[][][] {
  return Array(BOARD_SIZE)
    .fill(null)
    .map(() =>
      Array(BOARD_SIZE)
        .fill(null)
        .map(() => Array(BOARD_SIZE).fill(null))
    );
}

/**
 * Creates the initial game state
 */
export function createInitialState(): ExtendedGameState {
  return {
    board: createEmptyBoard(),
    currentPlayer: 'X',
    status: 'playing',
    winningLine: null,
    moveCount: 0,
    moveHistory: [],
    threats: [],
    lastMovePosition: null,
  };
}

/**
 * Generates all possible winning lines programmatically
 */
export function generateAllWinningLines(): Position[][] {
  const lines: Position[][] = [];

  // 1. Rows in each layer (x direction) - 16 lines
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let z = 0; z < BOARD_SIZE; z++) {
      const line: Position[] = [];
      for (let x = 0; x < BOARD_SIZE; x++) {
        line.push({ x, y, z });
      }
      lines.push(line);
    }
  }

  // 2. Columns in each layer (y direction) - 16 lines
  for (let x = 0; x < BOARD_SIZE; x++) {
    for (let z = 0; z < BOARD_SIZE; z++) {
      const line: Position[] = [];
      for (let y = 0; y < BOARD_SIZE; y++) {
        line.push({ x, y, z });
      }
      lines.push(line);
    }
  }

  // 3. Pillars (z direction) - 16 lines
  for (let x = 0; x < BOARD_SIZE; x++) {
    for (let y = 0; y < BOARD_SIZE; y++) {
      const line: Position[] = [];
      for (let z = 0; z < BOARD_SIZE; z++) {
        line.push({ x, y, z });
      }
      lines.push(line);
    }
  }

  // 4. Diagonals in each XY layer - 8 lines
  for (let z = 0; z < BOARD_SIZE; z++) {
    const diag1: Position[] = [];
    const diag2: Position[] = [];
    for (let i = 0; i < BOARD_SIZE; i++) {
      diag1.push({ x: i, y: i, z });
      diag2.push({ x: i, y: BOARD_SIZE - 1 - i, z });
    }
    lines.push(diag1, diag2);
  }

  // 5. Diagonals in each XZ plane - 8 lines
  for (let y = 0; y < BOARD_SIZE; y++) {
    const diag1: Position[] = [];
    const diag2: Position[] = [];
    for (let i = 0; i < BOARD_SIZE; i++) {
      diag1.push({ x: i, y, z: i });
      diag2.push({ x: i, y, z: BOARD_SIZE - 1 - i });
    }
    lines.push(diag1, diag2);
  }

  // 6. Diagonals in each YZ plane - 8 lines
  for (let x = 0; x < BOARD_SIZE; x++) {
    const diag1: Position[] = [];
    const diag2: Position[] = [];
    for (let i = 0; i < BOARD_SIZE; i++) {
      diag1.push({ x, y: i, z: i });
      diag2.push({ x, y: i, z: BOARD_SIZE - 1 - i });
    }
    lines.push(diag1, diag2);
  }

  // 7. 3D space diagonals - 4 lines
  const spaceDiags: Position[][] = [[], [], [], []];
  for (let i = 0; i < BOARD_SIZE; i++) {
    spaceDiags[0].push({ x: i, y: i, z: i });
    spaceDiags[1].push({ x: BOARD_SIZE - 1 - i, y: i, z: i });
    spaceDiags[2].push({ x: i, y: BOARD_SIZE - 1 - i, z: i });
    spaceDiags[3].push({ x: i, y: i, z: BOARD_SIZE - 1 - i });
  }
  lines.push(...spaceDiags);

  return lines;
}

// Pre-compute all winning lines
const ALL_WINNING_LINES = generateAllWinningLines();

/**
 * Check if a specific line is a winning line
 */
function checkLine(
  board: CellValue[][][],
  line: Position[]
): { isWin: boolean; player: Player | null } {
  const firstValue = board[line[0].x][line[0].y][line[0].z];
  
  if (firstValue === null) {
    return { isWin: false, player: null };
  }

  for (let i = 1; i < line.length; i++) {
    const { x, y, z } = line[i];
    if (board[x][y][z] !== firstValue) {
      return { isWin: false, player: null };
    }
  }

  return { isWin: true, player: firstValue };
}

/**
 * Check for a winner
 */
export function checkWinner(board: CellValue[][][]): WinningLine | null {
  for (const line of ALL_WINNING_LINES) {
    const result = checkLine(board, line);
    if (result.isWin && result.player) {
      return { positions: line, winner: result.player };
    }
  }
  return null;
}

/**
 * Detect threats (lines with 3 of same player + 1 empty)
 */
export function detectThreats(board: CellValue[][][]): Threat[] {
  const threats: Threat[] = [];

  for (const line of ALL_WINNING_LINES) {
    let xCount = 0;
    let oCount = 0;
    let emptyCell: Position | null = null;

    for (const pos of line) {
      const value = board[pos.x][pos.y][pos.z];
      if (value === 'X') xCount++;
      else if (value === 'O') oCount++;
      else emptyCell = pos;
    }

    // Threat: 3 of one player + 1 empty
    if (xCount === 3 && oCount === 0 && emptyCell) {
      threats.push({ player: 'X', line, emptyCell });
    } else if (oCount === 3 && xCount === 0 && emptyCell) {
      threats.push({ player: 'O', line, emptyCell });
    }
  }

  return threats;
}

/**
 * Check if board is full
 */
export function isBoardFull(board: CellValue[][][]): boolean {
  for (let x = 0; x < BOARD_SIZE; x++) {
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let z = 0; z < BOARD_SIZE; z++) {
        if (board[x][y][z] === null) return false;
      }
    }
  }
  return true;
}

/**
 * Make a move
 */
export function makeMove(
  state: ExtendedGameState,
  position: Position
): ExtendedGameState {
  const { x, y, z } = position;

  if (state.status !== 'playing' || state.board[x][y][z] !== null) {
    return state;
  }

  // Create new board
  const newBoard = state.board.map((layer, lx) =>
    layer.map((row, ly) =>
      row.map((cell, lz) =>
        lx === x && ly === y && lz === z ? state.currentPlayer : cell
      )
    )
  );

  // Record move
  const newMove: Move = {
    player: state.currentPlayer,
    position,
    timestamp: Date.now(),
    type: 'move',
  };

  const winningLine = checkWinner(newBoard);
  const moveCount = state.moveCount + 1;
  const isDraw = !winningLine && moveCount === BOARD_SIZE ** 3;
  const threats = winningLine ? [] : detectThreats(newBoard);

  return {
    board: newBoard,
    currentPlayer: state.currentPlayer === 'X' ? 'O' : 'X',
    status: winningLine ? 'win' : isDraw ? 'draw' : 'playing',
    winningLine,
    moveCount,
    moveHistory: [...state.moveHistory, newMove],
    threats,
    lastMovePosition: position,
  };
}

/**
 * Undo the last move
 */
export function undoMove(state: ExtendedGameState): ExtendedGameState {
  if (state.moveHistory.length === 0) return state;
  if (state.status === 'win') return state; // Can't undo after win

  const newHistory = state.moveHistory.slice(0, -1);

  // Only apply actual moves to the board
  const appliedMoves = newHistory.filter((move) => move.type !== 'skip' && move.position);

  // Rebuild board from history
  const newBoard = createEmptyBoard();
  for (const move of appliedMoves) {
    if (!move.position) continue;
    const { x, y, z } = move.position;
    newBoard[x][y][z] = move.player;
  }

  const lastMove = appliedMoves[appliedMoves.length - 1];
  const threats = detectThreats(newBoard);

  return {
    board: newBoard,
    currentPlayer: lastMove ? (lastMove.player === 'X' ? 'O' : 'X') : 'X',
    status: 'playing',
    winningLine: null,
    moveCount: appliedMoves.length,
    moveHistory: newHistory,
    threats,
    lastMovePosition: lastMove?.position || null,
  };
}

/**
 * Check if position is part of winning line
 */
export function isWinningPosition(
  winningLine: WinningLine | null,
  position: Position
): boolean {
  if (!winningLine) return false;
  return winningLine.positions.some(
    (p) => p.x === position.x && p.y === position.y && p.z === position.z
  );
}

/**
 * Check if position is a threat cell
 */
export function isThreatPosition(
  threats: Threat[],
  position: Position,
  player?: Player
): Threat | null {
  for (const threat of threats) {
    if (player && threat.player !== player) continue;
    if (
      threat.emptyCell.x === position.x &&
      threat.emptyCell.y === position.y &&
      threat.emptyCell.z === position.z
    ) {
      return threat;
    }
  }
  return null;
}

/**
 * Get world position for a cell
 */
export function getCellWorldPosition(
  position: Position,
  layerSpacing: number = 1.5,
  cellSpacing: number = 1.2
): [number, number, number] {
  const offset = ((BOARD_SIZE - 1) * cellSpacing) / 2;
  const verticalOffset = ((BOARD_SIZE - 1) * layerSpacing) / 2;
  
  return [
    position.x * cellSpacing - offset,
    position.z * layerSpacing - verticalOffset,
    position.y * cellSpacing - offset,
  ];
}

/**
 * Get total winning lines count
 */
export function getTotalWinningLines(): number {
  return ALL_WINNING_LINES.length;
}
