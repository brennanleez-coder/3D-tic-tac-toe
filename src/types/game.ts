export type Player = 'X' | 'O';
export type CellValue = Player | null;
export type GameStatus = 'playing' | 'win' | 'draw';

export interface Position {
  x: number;
  y: number;
  z: number;
}

export interface WinningLine {
  positions: Position[];
  winner: Player;
}

export interface GameState {
  board: CellValue[][][];
  currentPlayer: Player;
  status: GameStatus;
  winningLine: WinningLine | null;
  moveCount: number;
}

