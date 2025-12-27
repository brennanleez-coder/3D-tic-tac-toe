'use client';

import { useCallback, useState, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import Board3D from './Board3D';
import { Position } from '@/types/game';
import { ExtendedGameState, createInitialState, makeMove, undoMove } from '@/lib/gameLogic';

type SpreadPreset = 'compact' | 'normal' | 'spread' | 'exploded';

type CameraPreset = 'isometric' | 'top' | 'side' | 'front';

interface CameraTarget {
  position: [number, number, number];
  lookAt: [number, number, number];
}

const SPREAD_VALUES: Record<SpreadPreset, number> = {
  compact: 0,
  normal: 30,
  spread: 60,
  exploded: 100,
};

const CAMERA_PRESETS: Record<CameraPreset, CameraTarget> = {
  isometric: { position: [6, 5, 8], lookAt: [0, 0, 0] },
  top: { position: [0, 12, 0.1], lookAt: [0, 0, 0] },
  side: { position: [12, 0, 0], lookAt: [0, 0, 0] },
  front: { position: [0, 0, 12], lookAt: [0, 0, 0] },
};

const TURN_TIMER_SECONDS = 15;

// Camera controller component
function CameraController({ 
  targetPreset,
  onTransitionComplete,
}: { 
  targetPreset: CameraPreset | null;
  onTransitionComplete: () => void;
}) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const targetPosition = useRef<THREE.Vector3 | null>(null);
  const targetLookAt = useRef<THREE.Vector3 | null>(null);
  const transitioning = useRef(false);

  useEffect(() => {
    if (targetPreset) {
      const preset = CAMERA_PRESETS[targetPreset];
      targetPosition.current = new THREE.Vector3(...preset.position);
      targetLookAt.current = new THREE.Vector3(...preset.lookAt);
      transitioning.current = true;
    }
  }, [targetPreset]);

  useFrame(() => {
    if (transitioning.current && targetPosition.current && targetLookAt.current) {
      // Smoothly interpolate camera position
      camera.position.lerp(targetPosition.current, 0.05);
      
      // Check if we're close enough to target
      const distance = camera.position.distanceTo(targetPosition.current);
      if (distance < 0.1) {
        camera.position.copy(targetPosition.current);
        transitioning.current = false;
        targetPosition.current = null;
        onTransitionComplete();
      }

      // Update controls target
      if (controlsRef.current) {
        controlsRef.current.target.lerp(targetLookAt.current, 0.05);
        controlsRef.current.update();
      }
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={true}
      enableZoom={true}
      enableRotate={true}
      minDistance={5}
      maxDistance={25}
    />
  );
}

export default function Game() {
  const [gameState, setGameState] = useState<ExtendedGameState>(createInitialState);
  const [spreadPreset, setSpreadPreset] = useState<SpreadPreset>('normal');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset | null>(null);
  const [timerEnabled, setTimerEnabled] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(TURN_TIMER_SECONDS);
  const [hintsEnabled, setHintsEnabled] = useState(true);

  // Timer effect
  useEffect(() => {
    if (!timerEnabled || gameState.status !== 'playing') return;

    setTimeRemaining(TURN_TIMER_SECONDS);
    
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          // Time's up - forfeit turn
          setGameState((state) => ({
            ...state,
            currentPlayer: state.currentPlayer === 'X' ? 'O' : 'X',
          }));
          return TURN_TIMER_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timerEnabled, gameState.status, gameState.currentPlayer]);

  const handleCellClick = useCallback((position: Position) => {
    setGameState((prev) => makeMove(prev, position));
    if (timerEnabled) {
      setTimeRemaining(TURN_TIMER_SECONDS);
    }
  }, [timerEnabled]);

  const handleReset = useCallback(() => {
    setGameState(createInitialState());
    setTimeRemaining(TURN_TIMER_SECONDS);
  }, []);

  const handleUndo = useCallback(() => {
    setGameState((prev) => undoMove(prev));
    if (timerEnabled) {
      setTimeRemaining(TURN_TIMER_SECONDS);
    }
  }, [timerEnabled]);

  const handleCameraPreset = useCallback((preset: CameraPreset) => {
    setCameraPreset(preset);
  }, []);

  const canUndo = gameState.moveHistory.length > 0 && gameState.status === 'playing';

  return (
    <div className="relative w-full h-screen bg-slate-950 overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 -left-1/4 w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 -right-1/4 w-[500px] h-[500px] bg-pink-600/20 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-cyan-600/10 rounded-full blur-[80px] animate-pulse" style={{ animationDelay: '2s' }} />
        
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-purple-400/30 rounded-full animate-float"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 5}s`,
                animationDuration: `${8 + Math.random() * 4}s`,
              }}
            />
          ))}
        </div>

        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(139, 92, 246, 0.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(139, 92, 246, 0.5) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px',
          }}
        />
      </div>

      {/* 3D Canvas */}
      <Canvas 
        className="absolute inset-0"
        gl={{ 
          antialias: true,
          alpha: true,
          powerPreference: 'default',
          preserveDrawingBuffer: true,
        }}
        dpr={[1, 2]}
        onCreated={({ gl }) => {
          gl.setClearColor(0x0a0a1a, 1);
        }}
      >
        <PerspectiveCamera makeDefault position={[6, 5, 8]} fov={50} />
        <CameraController 
          targetPreset={cameraPreset}
          onTransitionComplete={() => setCameraPreset(null)}
        />

        {/* Lighting */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 10, 10]} intensity={1} />
        <directionalLight position={[-10, -5, -10]} intensity={0.4} color="#8B5CF6" />
        <pointLight position={[0, 5, 0]} intensity={0.6} color="#EC4899" />

        {/* Game Board */}
        <Board3D 
          gameState={gameState} 
          onCellClick={handleCellClick} 
          visibleLayers={[true, true, true, true]}
          explodeAmount={SPREAD_VALUES[spreadPreset]}
          highlightLayer={null}
        />
      </Canvas>

      {/* UI Overlay */}
      <GameUI 
        gameState={gameState} 
        onReset={handleReset}
        onUndo={handleUndo}
        canUndo={canUndo}
        spreadPreset={spreadPreset}
        setSpreadPreset={setSpreadPreset}
        onCameraPreset={handleCameraPreset}
        timerEnabled={timerEnabled}
        setTimerEnabled={setTimerEnabled}
        timeRemaining={timeRemaining}
        hintsEnabled={hintsEnabled}
        setHintsEnabled={setHintsEnabled}
      />
    </div>
  );
}

// Game UI Overlay Component
function GameUI({
  gameState,
  onReset,
  onUndo,
  canUndo,
  spreadPreset,
  setSpreadPreset,
  onCameraPreset,
  timerEnabled,
  setTimerEnabled,
  timeRemaining,
  hintsEnabled,
  setHintsEnabled,
}: {
  gameState: ExtendedGameState;
  onReset: () => void;
  onUndo: () => void;
  canUndo: boolean;
  spreadPreset: SpreadPreset;
  setSpreadPreset: (preset: SpreadPreset) => void;
  onCameraPreset: (preset: CameraPreset) => void;
  timerEnabled: boolean;
  setTimerEnabled: (enabled: boolean) => void;
  timeRemaining: number;
  hintsEnabled: boolean;
  setHintsEnabled: (enabled: boolean) => void;
}) {
  const { currentPlayer, status, winningLine, moveCount, threats } = gameState;
  const layerColors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3'];

  // Show threat warning only if hints are enabled
  const currentPlayerThreats = threats.filter(t => t.player !== currentPlayer);
  const hasThreats = hintsEnabled && currentPlayerThreats.length > 0;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-3 sm:p-4 pointer-events-auto">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
              3D Tic-Tac-Toe
            </h1>
            <div className="hidden sm:flex items-center gap-1.5 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1.5">
              <span className="text-xs text-gray-400">{moveCount}</span>
              <span className="text-gray-600">/</span>
              <span className="text-xs text-purple-400">64</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Undo Button */}
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className={`text-white text-xs sm:text-sm font-medium py-2 sm:py-2.5 px-3 sm:px-4 rounded-xl transition-all ${
                canUndo 
                  ? 'bg-gray-700 hover:bg-gray-600 hover:scale-105' 
                  : 'bg-gray-800 opacity-50 cursor-not-allowed'
              }`}
            >
              ↩ Undo
            </button>

            {/* Reset Button */}
            <button
              onClick={onReset}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-sm sm:text-base font-semibold py-2.5 sm:py-3 px-5 sm:px-8 rounded-xl transition-all hover:scale-105 shadow-lg shadow-purple-500/25 border border-white/10"
            >
              Reset Game
            </button>
          </div>
        </div>
      </div>

      {/* Turn Indicator */}
      <div className="absolute top-16 sm:top-20 left-1/2 -translate-x-1/2 pointer-events-none">
        {status === 'playing' && (
          <div className={`
            flex items-center gap-2 sm:gap-3 
            px-4 sm:px-6 py-2 sm:py-3 
            rounded-2xl 
            backdrop-blur-xl border
            ${currentPlayer === 'X' 
              ? 'bg-red-500/20 border-red-500/40 shadow-lg shadow-red-500/20' 
              : 'bg-cyan-500/20 border-cyan-500/40 shadow-lg shadow-cyan-500/20'
            }
          `}>
            <PlayerIndicator player={currentPlayer} size="lg" />
            <div className="flex flex-col">
              <span className="text-white font-bold text-sm sm:text-base">
                {currentPlayer === 'X' ? 'Player 1' : 'Player 2'}
              </span>
              <span className="text-gray-400 text-[10px] sm:text-xs">your turn</span>
            </div>
            
            {/* Timer */}
            {timerEnabled && (
              <div className={`ml-2 px-2 py-1 rounded-lg text-sm font-mono ${
                timeRemaining <= 5 ? 'bg-red-500/30 text-red-400 animate-pulse' : 'bg-black/30 text-white'
              }`}>
                {timeRemaining}s
              </div>
            )}

            {/* Threat Warning */}
            {hasThreats && (
              <div className="ml-2 px-2 py-1 rounded-lg bg-yellow-500/30 text-yellow-400 text-xs animate-pulse">
                ⚠️ Block!
              </div>
            )}
          </div>
        )}

        {status === 'win' && winningLine && (
          <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2 sm:py-3 rounded-2xl bg-yellow-500/20 backdrop-blur-xl border border-yellow-500/40 shadow-lg shadow-yellow-500/20">
            <PlayerIndicator player={winningLine.winner} size="lg" />
            <div className="flex flex-col">
              <span className="text-yellow-400 font-bold text-sm sm:text-lg">
                🎉 {winningLine.winner === 'X' ? 'Player 1' : 'Player 2'} Wins!
              </span>
              <span className="text-gray-400 text-[10px] sm:text-xs">{moveCount} moves</span>
            </div>
          </div>
        )}

        {status === 'draw' && (
          <div className="flex items-center gap-2 sm:gap-3 px-4 sm:px-6 py-2 sm:py-3 rounded-2xl bg-gray-500/20 backdrop-blur-xl border border-gray-500/40">
            <span className="text-2xl">🤝</span>
            <div className="flex flex-col">
              <span className="text-white font-bold text-sm sm:text-lg">It's a Draw!</span>
              <span className="text-gray-400 text-[10px] sm:text-xs">All 64 cells filled</span>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Stats */}
      <div className="sm:hidden absolute bottom-14 left-3 pointer-events-none">
        <div className="bg-black/40 backdrop-blur-sm rounded-full px-2.5 py-1">
          <span className="text-[10px] text-gray-400">{moveCount}/64</span>
        </div>
      </div>

      {/* Left Side - Controls */}
      <div className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 pointer-events-auto space-y-4">
        {/* Spread Presets */}
        <div className="bg-black/50 backdrop-blur-xl rounded-2xl p-3 sm:p-4 border border-purple-500/20">
          <p className="text-[10px] sm:text-xs text-gray-400 mb-3 text-center font-medium uppercase tracking-wider">Spread</p>
          <div className="flex flex-col gap-1.5">
            {(['compact', 'normal', 'spread', 'exploded'] as SpreadPreset[]).map((preset) => (
              <button
                key={preset}
                onClick={() => setSpreadPreset(preset)}
                className={`px-3 py-2 text-[11px] sm:text-xs rounded-lg transition-all capitalize font-medium ${
                  spreadPreset === preset
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-500/30'
                    : 'bg-black/40 text-gray-400 hover:bg-black/60 hover:text-white'
                }`}
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Camera Presets */}
        <div className="bg-black/50 backdrop-blur-xl rounded-2xl p-3 sm:p-4 border border-purple-500/20">
          <p className="text-[10px] sm:text-xs text-gray-400 mb-3 text-center font-medium uppercase tracking-wider">Camera</p>
          <div className="flex flex-col gap-1.5">
            {(['isometric', 'top', 'side', 'front'] as CameraPreset[]).map((preset) => (
              <button
                key={preset}
                onClick={() => onCameraPreset(preset)}
                className="px-3 py-2 text-[11px] sm:text-xs rounded-lg transition-all capitalize font-medium bg-black/40 text-gray-400 hover:bg-purple-600 hover:text-white hover:shadow-md hover:shadow-purple-500/30"
              >
                {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Timer Toggle */}
        <div className="bg-black/50 backdrop-blur-xl rounded-2xl p-3 sm:p-4 border border-purple-500/20">
          <p className="text-[10px] sm:text-xs text-gray-400 mb-3 text-center font-medium uppercase tracking-wider">Timer</p>
          <button
            onClick={() => setTimerEnabled(!timerEnabled)}
            className={`w-full px-3 py-2.5 text-[11px] sm:text-xs rounded-lg transition-all font-semibold ${
              timerEnabled
                ? 'bg-green-600 text-white shadow-md shadow-green-500/30'
                : 'bg-black/40 text-gray-400 hover:bg-black/60'
            }`}
          >
            {timerEnabled ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Hints Toggle */}
        <div className="bg-black/50 backdrop-blur-xl rounded-2xl p-3 sm:p-4 border border-purple-500/20">
          <p className="text-[10px] sm:text-xs text-gray-400 mb-3 text-center font-medium uppercase tracking-wider">Hints</p>
          <button
            onClick={() => setHintsEnabled(!hintsEnabled)}
            className={`w-full px-3 py-2.5 text-[11px] sm:text-xs rounded-lg transition-all font-semibold ${
              hintsEnabled
                ? 'bg-yellow-600 text-white shadow-md shadow-yellow-500/30'
                : 'bg-black/40 text-gray-400 hover:bg-black/60'
            }`}
          >
            {hintsEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>

      {/* Right Side - Legend */}
      <div className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 pointer-events-auto space-y-4">
        {/* Layer Legend */}
        <div className="bg-black/50 backdrop-blur-xl rounded-2xl p-3 sm:p-4 border border-purple-500/20">
          <p className="text-[10px] sm:text-xs text-gray-400 mb-3 text-center font-medium uppercase tracking-wider">Layers</p>
          <div className="flex flex-col gap-2.5">
            {[3, 2, 1, 0].map((i) => (
              <div key={i} className="flex items-center gap-2.5">
                <div 
                  className="w-4 h-4 rounded-md shadow-sm"
                  style={{ backgroundColor: layerColors[i] }}
                />
                <span className="text-xs text-gray-300 font-medium">{i + 1}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Move History */}
        <div className="bg-black/50 backdrop-blur-xl rounded-2xl p-3 sm:p-4 border border-purple-500/20 max-h-40 overflow-y-auto">
          <p className="text-[10px] sm:text-xs text-gray-400 mb-3 text-center font-medium uppercase tracking-wider">History</p>
          <div className="flex flex-col gap-1.5 text-[10px] sm:text-xs">
            {gameState.moveHistory.slice(-5).map((move, i) => (
              <div key={i} className="flex items-center gap-2 py-0.5">
                <span className={`font-bold ${move.player === 'X' ? 'text-red-400' : 'text-cyan-400'}`}>
                  {move.player}
                </span>
                <span className="text-gray-500 font-mono">
                  ({move.position.x},{move.position.y},{move.position.z})
                </span>
              </div>
            ))}
            {gameState.moveHistory.length === 0 && (
              <span className="text-gray-500 text-center">No moves yet</span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Controls Hint */}
      <div className="absolute bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto">
        <div className="bg-black/30 backdrop-blur-sm rounded-full px-4 py-1.5 flex items-center gap-3 text-[10px] text-gray-500">
          <span>🖱️ Drag to rotate</span>
          <span className="text-gray-700">•</span>
          <span>👆 Click cell to play</span>
        </div>
      </div>
    </div>
  );
}

// Player indicator component
function PlayerIndicator({
  player,
  size = 'sm',
}: {
  player: 'X' | 'O';
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClasses = {
    sm: 'w-5 h-5 text-xs',
    md: 'w-7 h-7 text-sm',
    lg: 'w-9 h-9 sm:w-11 sm:h-11 text-lg sm:text-xl',
  };

  const colorClasses = {
    X: 'bg-gradient-to-br from-red-400 to-pink-600 shadow-lg shadow-red-500/30',
    O: 'bg-gradient-to-br from-cyan-400 to-teal-600 shadow-lg shadow-cyan-500/30',
  };

  return (
    <div
      className={`${sizeClasses[size]} ${colorClasses[player]} rounded-lg flex items-center justify-center font-bold text-white`}
    >
      {player}
    </div>
  );
}
