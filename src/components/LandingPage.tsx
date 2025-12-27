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
      
      // Gentle motion from side view - slight vertical movement
      const baseX = isMobile ? 12 : 10;
      const x = baseX + Math.sin(timeRef.current * 0.5) * 1;
      const y = Math.sin(timeRef.current) * 2;
      const z = Math.cos(timeRef.current * 0.3) * 1;
      
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
  
  // Place winning pieces
  winningLine.forEach(pos => {
    board[pos.x][pos.y][pos.z] = winner;
  });
  
  // Place additional moves (for opponent or other pieces)
  additionalMoves.forEach(pos => {
    if (board[pos.x][pos.y][pos.z] === null) {
      board[pos.x][pos.y][pos.z] = winner === 'X' ? 'O' : 'X';
    }
  });
  
  return {
    board,
    currentPlayer: winner,
    status: 'win',
    winningLine: { positions: winningLine, winner },
    moveCount: winningLine.length + additionalMoves.length,
    moveHistory: [],
    threats: [],
    lastMovePosition: null,
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
  const additionalMoves: Position[] = [
    { x: 0, y: 1, z: 0 },
    { x: 1, y: 1, z: 0 },
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
  const additionalMoves: Position[] = [
    { x: 0, y: 1, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 2, y: 0, z: 0 },
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
  const additionalMoves: Position[] = [
    { x: 0, y: 1, z: 0 },
    { x: 2, y: 1, z: 0 },
    { x: 1, y: 0, z: 0 },
  ];
  return createPresetState(winningLine, 'X', additionalMoves);
}

type PresetType = 'empty' | 'preset1' | 'preset2' | 'preset3';

export default function LandingPage({ onStartGame }: LandingPageProps) {
  const [fadeOut, setFadeOut] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<PresetType>('empty');
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
      className={`relative w-full min-h-[200vh] bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 transition-opacity duration-500 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}
    >
      {/* 3D Canvas - Reveals on scroll */}
      {showGrid && (
        <div 
          className="fixed inset-0 z-[5] pointer-events-auto"
          style={{ opacity: scrollProgress }}
        >
          {/* Text overlay - positioned at top */}
          <div className="absolute top-24 sm:top-28 left-0 right-0 text-center px-4 z-[10] pointer-events-none">
            <div className="bg-black/40 backdrop-blur-sm rounded-2xl px-6 py-4 inline-block border border-purple-500/20">
              <h2 className="text-2xl sm:text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
                Explore the 3D Grid
              </h2>
              <p className="text-gray-300 text-sm sm:text-base max-w-xl">
                Rotate, zoom, and explore the interactive board
              </p>
            </div>
          </div>

          {/* Preset Buttons - Overlay on top of Canvas */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[10] pointer-events-auto px-4 w-full max-w-4xl">
            <div className="bg-black/70 backdrop-blur-xl rounded-2xl px-4 py-3 border border-purple-500/40 shadow-2xl">
              <p className="text-gray-300 text-xs sm:text-sm mb-3 text-center font-medium">
                Explore Winning Patterns
              </p>
              <div className="flex flex-wrap justify-center items-center gap-2 sm:gap-3">
                <Button
                  onClick={() => setSelectedPreset('empty')}
                  variant={selectedPreset === 'empty' ? 'default' : 'ghost'}
                  size="default"
                >
                  Clear
                </Button>
                <Button
                  onClick={() => setSelectedPreset('preset1')}
                  variant={selectedPreset === 'preset1' ? 'default' : 'ghost'}
                  size="default"
                >
                  Single Plane Win
                </Button>
                <Button
                  onClick={() => setSelectedPreset('preset2')}
                  variant={selectedPreset === 'preset2' ? 'default' : 'ghost'}
                  size="default"
                >
                  Multi-Plane Diagonal
                </Button>
                <Button
                  onClick={() => setSelectedPreset('preset3')}
                  variant={selectedPreset === 'preset3' ? 'default' : 'ghost'}
                  size="default"
                >
                  Multi-Plane Straight
                </Button>
              </div>
            </div>
          </div>

          <Canvas 
            className="absolute inset-0 pointer-events-auto"
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
              position={isMobile ? [12, 0, 0] : [10, 0, 0]} 
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
        </div>
      )}

      {/* Overlay Content - First Section */}
      <div className="relative min-h-screen flex flex-col items-center justify-center z-10 pointer-events-none">
        <div className="text-center space-y-6 px-4 animate-fade-in">
          {/* Title */}
          <h1 className="text-5xl sm:text-7xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent drop-shadow-2xl">
            3D Tic-Tac-Toe
          </h1>
          
          {/* Subtitle */}
          <p className="text-gray-300 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed">
            Experience the classic game in a stunning <span className="text-purple-400 font-semibold">4×4×4</span> three-dimensional space
          </p>

          

          {/* Start Button */}
          <div className="mt-12 pointer-events-auto">
            <Button
              onClick={handleStart}
              variant="gradient"
              size="lg"
              className="text-xl"
            >
              Start Game →
            </Button>
          </div>

          {/* Hint for mobile */}
          {isMobile && (
            <p className="text-gray-500 text-xs mt-8 pointer-events-auto bg-black/20 backdrop-blur-sm px-4 py-2 rounded-full">
              Pinch to zoom • Drag to rotate
            </p>
          )}
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 pointer-events-none animate-bounce">
          <div className="flex flex-col items-center gap-2 text-gray-400">
            <span className="text-sm">Scroll to explore</span>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        </div>
      </div>

      {/* Second Section - 3D Grid Preview Area */}
      <div className="relative min-h-screen flex flex-col items-center justify-center z-[1] pointer-events-none">
        {/* 3D Grid takes center stage - full viewport height */}
        <div className="w-full flex-1 pointer-events-none" style={{ minHeight: '70vh' }} />
      </div>

      {/* Floating Back to Top Button - Always visible when scrolled */}
      {showScrollToTop && (
        <Button
          onClick={scrollToTop}
          variant="icon"
          size="icon"
          className="fixed top-6 right-6 z-30 pointer-events-auto"
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

