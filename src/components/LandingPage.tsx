'use client';

import { useState, useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import Board3D from './Board3D';
import { ExtendedGameState, createInitialState, createEmptyBoard } from '@/lib/gameLogic';
import { WinningLine, Position } from '@/types/game';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import AnimatedBackground from './AnimatedBackground';

interface LandingPageProps {
  onStartGame: () => void;
}

// Hook to detect mobile
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

// Animated camera for landing page - only animates when user is not interacting
function LandingCamera({ isMobile }: { isMobile: boolean }) {
  const { camera } = useThree();
  const timeRef = useRef(0);
  const controlsRef = useRef<any>(null);
  const isInteractingRef = useRef(false);
  const lastInteractionTime = useRef(0);

  useFrame(() => {
    // Check if user is interacting (within last 2 seconds)
    const timeSinceInteraction = Date.now() - lastInteractionTime.current;
    const shouldAnimate = timeSinceInteraction > 2000 && !isInteractingRef.current;
    
    if (shouldAnimate) {
      timeRef.current += 0.005;
      
      // Gentle motion from isometric view - slight circular movement
      const baseDistance = isMobile ? 12 : 10;
      const angle = timeRef.current * 0.3;
      const x = baseDistance * Math.cos(angle) + Math.sin(timeRef.current * 0.5) * 0.5;
      const y = baseDistance * 0.7 + Math.sin(timeRef.current) * 1;
      const z = baseDistance * Math.sin(angle) + Math.cos(timeRef.current * 0.3) * 0.5;
      
      camera.position.lerp(new THREE.Vector3(x, y, z), 0.05);
      camera.lookAt(0, 0, 0);
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={true}
      enableZoom={true}
      enableRotate={true}
      minDistance={isMobile ? 10 : 8}
      maxDistance={isMobile ? 35 : 30}
      onStart={() => {
        isInteractingRef.current = true;
        lastInteractionTime.current = Date.now();
      }}
      onEnd={() => {
        isInteractingRef.current = false;
        lastInteractionTime.current = Date.now();
      }}
    />
  );
}

// Helper function to create preset winning game states
function createPresetState(
  winningLine: Position[],
  winner: 'X' | 'O',
  additionalMoves: Position[] = []
): ExtendedGameState {
  const board = createEmptyBoard();
  const opponent: 'X' | 'O' = winner === 'X' ? 'O' : 'X';
  
  // Separate winning moves (save last for final move) and opponent moves
  const winningMoves = winningLine.slice(0, -1);
  const finalWinningMove = winningLine[winningLine.length - 1];
  
  // Create a pool of all moves to place
  const allWinnerMoves = [...winningMoves];
  const allOpponentMoves = [...additionalMoves];
  
  // Ensure we have balanced moves: winner should have one more (the winning move)
  // So if winner has N moves in winning line, opponent should have N-1 additional moves
  // Adjust if needed to keep it realistic
  const totalWinnerMoves = allWinnerMoves.length + 1; // +1 for final move
  const totalOpponentMoves = allOpponentMoves.length;
  
  // Trim moves if needed to keep balance (winner can have 1 more)
  const maxOpponentMoves = totalWinnerMoves - 1;
  const opponentMovesToUse = allOpponentMoves.slice(0, maxOpponentMoves);
  
  // Create alternating game sequence starting with X
  const gameSequence: Array<{ player: 'X' | 'O'; position: Position }> = [];
  let winnerIdx = 0;
  let opponentIdx = 0;
  let currentPlayer: 'X' | 'O' = 'X'; // X always starts
  
  // Strictly alternate: X, O, X, O, ...
  // Place moves in order, ensuring winner has exactly one more move
  while (winnerIdx < allWinnerMoves.length || opponentIdx < opponentMovesToUse.length) {
    if (currentPlayer === winner && winnerIdx < allWinnerMoves.length) {
      const pos = allWinnerMoves[winnerIdx];
      if (board[pos.x][pos.y][pos.z] === null) {
        gameSequence.push({ player: winner, position: pos });
        board[pos.x][pos.y][pos.z] = winner;
        winnerIdx++;
        currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
      } else {
        winnerIdx++;
      }
    } else if (currentPlayer === opponent && opponentIdx < opponentMovesToUse.length) {
      const pos = opponentMovesToUse[opponentIdx];
    if (board[pos.x][pos.y][pos.z] === null) {
        gameSequence.push({ player: opponent, position: pos });
        board[pos.x][pos.y][pos.z] = opponent;
        opponentIdx++;
        currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
      } else {
        opponentIdx++;
      }
    } else {
      // If current player has no moves, skip their turn
      currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
    }
  }
  
  // Place the final winning move (winner always has one more move)
  board[finalWinningMove.x][finalWinningMove.y][finalWinningMove.z] = winner;
  
  // Create move history with timestamps
  let timestamp = Date.now() - (gameSequence.length + 1) * 1000;
  const moveHistory = gameSequence.map(move => ({
    player: move.player,
    position: move.position,
    timestamp: timestamp++,
  }));
  
  // Add the final winning move
  moveHistory.push({
    player: winner,
    position: finalWinningMove,
    timestamp: timestamp,
  });
  
  return {
    board,
    currentPlayer: opponent,
    status: 'win',
    winningLine: { positions: winningLine, winner },
    moveCount: moveHistory.length,
    moveHistory,
    threats: [],
    lastMovePosition: finalWinningMove,
  };
}

// Preset 1: Single plane, 1D win (row in layer 0)
function createPreset1(): ExtendedGameState {
  const winningLine: Position[] = [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 2, y: 0, z: 0 },
    { x: 3, y: 0, z: 0 },
  ];
  // X wins with 4 pieces, so O should have 3 moves (X has 1 more)
  // Realistic game: O tries to block X's row and build own lines
  const additionalMoves: Position[] = [
    { x: 1, y: 1, z: 0 }, // O's first move - starts building diagonal
    { x: 2, y: 1, z: 0 }, // O blocks near X's second piece
    { x: 0, y: 1, z: 0 }, // O blocks near X's first piece
  ];
  return createPresetState(winningLine, 'X', additionalMoves);
}

// Preset 2: Multi-plane diagonal win (3D space diagonal)
function createPreset2(): ExtendedGameState {
  const winningLine: Position[] = [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 1, z: 1 },
    { x: 2, y: 2, z: 2 },
    { x: 3, y: 3, z: 3 },
  ];
  // O wins with 4 pieces, so X should have 3 moves (O has 1 more)
  // Realistic 3D diagonal game: X tries to block O's diagonal
  const additionalMoves: Position[] = [
    { x: 1, y: 0, z: 0 }, // X blocks near O's first piece
    { x: 2, y: 1, z: 1 }, // X blocks near O's second piece
    { x: 3, y: 2, z: 2 }, // X blocks near O's third piece
  ];
  return createPresetState(winningLine, 'O', additionalMoves);
}

// Preset 3: Multi-plane straight win (pillar/column)
function createPreset3(): ExtendedGameState {
  const winningLine: Position[] = [
    { x: 1, y: 1, z: 0 },
    { x: 1, y: 1, z: 1 },
    { x: 1, y: 1, z: 2 },
    { x: 1, y: 1, z: 3 },
  ];
  // X wins with 4 pieces, so O should have 3 moves (X has 1 more)
  // Realistic vertical column game: O tries to block X's column
  const additionalMoves: Position[] = [
    { x: 0, y: 1, z: 0 }, // O blocks near X's first piece
    { x: 2, y: 1, z: 1 }, // O blocks near X's second piece
    { x: 0, y: 1, z: 2 }, // O blocks near X's third piece
  ];
  return createPresetState(winningLine, 'X', additionalMoves);
}

type PresetType = 'empty' | 'preset1' | 'preset2' | 'preset3';

export default function LandingPage({ onStartGame }: LandingPageProps) {
  const [fadeOut, setFadeOut] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<PresetType>('preset2');
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  
  // Get the current game state based on selected preset
  const getGameState = (): ExtendedGameState => {
    switch (selectedPreset) {
      case 'preset1':
        return createPreset1();
      case 'preset2':
        return createPreset2();
      case 'preset3':
        return createPreset3();
      default:
        return createInitialState();
    }
  };
  
  const currentGameState = getGameState();

  // Handle scroll to reveal 3D grid
  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      
      const scrollY = window.scrollY || window.pageYOffset;
      const windowHeight = window.innerHeight;
      const scrollThreshold = windowHeight * 0.3; // Show grid after scrolling 30% of viewport
      
      if (scrollY > scrollThreshold) {
        setShowGrid(true);
        setShowScrollToTop(true);
        // Calculate progress for fade-in animation (0 to 1)
        const progress = Math.min(1, (scrollY - scrollThreshold) / (windowHeight * 0.3));
        setScrollProgress(progress);
      } else {
        setShowGrid(false);
        setShowScrollToTop(false);
        setScrollProgress(0);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Check initial scroll position
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStart = () => {
    setFadeOut(true);
    // Navigate after fade animation
    setTimeout(() => {
      onStartGame();
    }, 500);
  };

  return (
    <div 
      ref={containerRef}
      className={`relative w-full bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 transition-opacity duration-500 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}
    >

      {/* First Section - Full Viewport */}
      <div className="relative w-full min-h-screen flex flex-col items-center justify-center z-10 pointer-events-none px-4 sm:px-6 md:px-8 lg:px-12" style={{ scrollSnapAlign: 'start' }}>
        <div className="w-full max-w-[640px] sm:max-w-3xl lg:max-w-4xl mx-auto text-center animate-fade-in">
            {/* Title */}
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent drop-shadow-2xl mb-2 sm:mb-3">
              QuadCube
            </h1>
            
            {/* Subtitle */}
          <p className="text-gray-200 text-sm sm:text-base md:text-lg max-w-3xl mx-auto text-center leading-relaxed mb-4 sm:mb-5 md:mb-6">
              Experience 3D Tic Tac Toe in a stunning <span className="text-purple-300 font-semibold">4×4×4</span> three-dimensional space. Get 4 in a row across any dimension to win!
            </p>

            {/* Rules Section */}
          <div className="pointer-events-auto">
            <h2 className="text-base sm:text-xl md:text-2xl font-bold text-white mb-3 sm:mb-4 text-center">
                How to Play
              </h2>
            <div className="flex flex-col gap-2 sm:gap-3 md:gap-4 max-w-2xl mx-auto">
                {/* Rule 1 */}
                <div className="flex items-start gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl bg-gradient-to-r from-purple-500/15 to-pink-500/10 border border-purple-500/25 shadow-lg">
                  <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-xs sm:text-sm shadow-md">
                    1
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-white font-semibold mb-1 text-sm sm:text-base md:text-lg">Take Turns</h3>
                    <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">Players alternate placing X and O on the 4×4×4 grid</p>
                  </div>
                </div>

                {/* Rule 2 */}
                <div className="flex items-start gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl bg-gradient-to-r from-purple-500/15 to-pink-500/10 border border-purple-500/25 shadow-lg">
                  <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-xs sm:text-sm shadow-md">
                    2
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-white font-semibold mb-1 text-sm sm:text-base md:text-lg">Get 4 in a Row</h3>
                    <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">Win by connecting 4 pieces horizontally, vertically, diagonally, or through 3D space</p>
                  </div>
                </div>

                {/* Rule 3 */}
                <div className="flex items-start gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl bg-gradient-to-r from-purple-500/15 to-pink-500/10 border border-purple-500/25 shadow-lg">
                  <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-xs sm:text-sm shadow-md">
                    3
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-white font-semibold mb-1 text-sm sm:text-base md:text-lg">Explore 3D Space</h3>
                    <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">Rotate and zoom to see all layers and plan your strategy</p>
                  </div>
                </div>

                {/* Rule 4 */}
                <div className="flex items-start gap-2 sm:gap-3 p-3 sm:p-4 rounded-xl bg-gradient-to-r from-purple-500/15 to-pink-500/10 border border-purple-500/25 shadow-lg">
                  <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-xs sm:text-sm shadow-md">
                    4
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-white font-semibold mb-1 text-sm sm:text-base md:text-lg">Think Strategically</h3>
                    <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">Block your opponent while building your own winning line</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Start Button */}
          <div className="mt-4 sm:mt-6 md:mt-8 flex justify-center pointer-events-auto">
              <Button
                onClick={handleStart}
                variant="gradient"
                size="lg"
              className="text-base sm:text-lg md:text-xl w-full sm:w-auto px-6 sm:px-8 md:px-10 py-4 sm:py-5 md:py-6"
              >
                Start Game →
              </Button>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-6 sm:bottom-1/2 sm:right-6 md:right-8 left-1/2 sm:left-auto sm:translate-x-0 sm:translate-y-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="flex flex-col items-center gap-2 text-gray-400">
            <span className="text-xs sm:text-sm opacity-70">Scroll to explore</span>
            <svg className="w-5 h-5 sm:w-6 sm:h-6 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ animation: 'bounce 2s ease-in-out infinite' }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>
      </div>

      {/* Second Section - 3D Grid Preview Area - Full Viewport */}
      <div className="relative w-full min-h-screen flex flex-col items-center justify-center z-[1] pointer-events-none px-4 sm:px-6 md:px-8 lg:px-12" style={{ scrollSnapAlign: 'start' }}>
        <div className="w-full max-w-6xl mx-auto flex flex-col items-center gap-4 sm:gap-6 md:gap-8">
        {/* Text header */}
          <div className="w-full text-center pointer-events-none">
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2 sm:mb-3">
              Explore the 3D Grid
            </h2>
            <p className="text-gray-200 text-sm sm:text-base md:text-lg max-w-2xl mx-auto">
              Rotate, zoom, and explore the interactive 3D tic tac toe board
            </p>
        </div>

        {/* Preset Buttons */}
          <div className="pointer-events-auto w-full max-w-5xl mx-auto">
            <div className="flex flex-wrap justify-center items-center gap-3 sm:gap-4 md:gap-6">
            <Button
              onClick={() => setSelectedPreset('preset1')}
              variant={selectedPreset === 'preset1' ? 'default' : 'ghost'}
              size="lg"
                className="text-sm sm:text-base md:text-lg px-6 sm:px-8 py-3"
            >
              Single Plane Win
            </Button>
            <Button
              onClick={() => setSelectedPreset('preset2')}
              variant={selectedPreset === 'preset2' ? 'default' : 'ghost'}
              size="lg"
                className="text-sm sm:text-base md:text-lg px-6 sm:px-8 py-3"
            >
              Multi-Plane Diagonal
            </Button>
            <Button
              onClick={() => setSelectedPreset('preset3')}
              variant={selectedPreset === 'preset3' ? 'default' : 'ghost'}
              size="lg"
                className="text-sm sm:text-base md:text-lg px-6 sm:px-8 py-3"
            >
              Multi-Plane Straight
            </Button>
          </div>
        </div>

        {/* Resizable 3D Canvas Container */}
          <div className="w-full max-w-6xl pointer-events-auto flex-1 flex items-center justify-center">
          <div 
              className="relative bg-black/25 backdrop-blur-md rounded-2xl border border-purple-500/35 shadow-[0_20px_60px_rgba(0,0,0,0.45)] overflow-hidden w-full"
            style={{ 
                height: '60vh',
                minHeight: '400px',
                maxHeight: '700px',
            }}
          >
            <Canvas 
              className="w-full h-full"
              gl={{ 
                antialias: true,
                alpha: true,
                powerPreference: 'default',
              }}
              dpr={[1, 2]}
              onCreated={({ gl }) => {
                gl.setClearColor(0x000000, 0);
              }}
            >
              <PerspectiveCamera 
                makeDefault 
                position={isMobile ? [10, 8, 10] : [8, 6, 8]} 
                fov={isMobile ? 45 : 50} 
              />
              <LandingCamera isMobile={isMobile} />

              {/* Lighting */}
              <ambientLight intensity={0.6} />
              <directionalLight position={[10, 10, 10]} intensity={1} />
              <directionalLight position={[-10, -5, -10]} intensity={0.4} color="#8B5CF6" />
              <pointLight position={[0, 5, 0]} intensity={0.6} color="#EC4899" />

              {/* Game Board - Shows selected preset */}
              <Board3D 
                gameState={currentGameState} 
                onCellClick={() => {}} 
                visibleLayers={[true, true, true, true]}
                explodeAmount={30}
                highlightLayer={null}
              />
            </Canvas>
            
            {/* Resize indicator */}
            <div className="absolute bottom-2 right-2 text-gray-500 text-xs pointer-events-none">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M22 22H20V20H22V22ZM22 18H20V16H22V18ZM18 22H16V20H18V22ZM18 18H16V16H18V18ZM14 22H12V20H14V22ZM22 14H20V12H22V14Z"/>
              </svg>
            </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Back to Top Button - Always visible when scrolled */}
      {showScrollToTop && (
        <Button
          onClick={scrollToTop}
          variant="icon"
          size="icon"
          className="fixed top-4 right-4 sm:top-6 sm:right-6 z-30 pointer-events-auto"
          aria-label="Scroll to top"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </Button>
      )}

      {/* Animated background particles */}
      <AnimatedBackground />
    </div>
  );
}
