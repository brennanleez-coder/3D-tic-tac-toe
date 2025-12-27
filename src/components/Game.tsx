'use client';

import { useCallback, useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import Board3D from './Board3D';
import { Position } from '@/types/game';
import { ExtendedGameState, Move, createInitialState, makeMove, undoMove } from '@/lib/gameLogic';
import { Sheet, SheetContent } from './ui/sheet';
import AnimatedBackground from './AnimatedBackground';

// Hook to detect mobile
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640); // sm breakpoint
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

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

// Camera controller component
function CameraController({ 
  targetPreset,
  onTransitionComplete,
  isMobile = false,
}: { 
  targetPreset: CameraPreset | null;
  onTransitionComplete: () => void;
  isMobile?: boolean;
}) {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const targetPosition = useRef<THREE.Vector3 | null>(null);
  const targetLookAt = useRef<THREE.Vector3 | null>(null);
  const transitioning = useRef(false);
  const initialized = useRef(false);

  // Initialize camera position for mobile on mount
  useEffect(() => {
    if (!initialized.current && isMobile) {
      // Set initial zoomed out position for mobile
      camera.position.set(10, 8, 12);
      camera.lookAt(0, 0, 0);
      initialized.current = true;
    }
  }, [camera, isMobile]);

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
      minDistance={isMobile ? 8 : 5}
      maxDistance={isMobile ? 30 : 25}
    />
  );
}

const DEFAULT_TURN_TIME_LIMIT = 15; // seconds per turn
const STORAGE_KEY_TURN_TIME = 'tictactoe-3d-turn-time-limit';
const STORAGE_KEY_TIMER_ENABLED = 'tictactoe-3d-timer-enabled';
const BASE_REPLAY_DELAY = 700; // ms between autoplay steps

type ReplayMode = 'idle' | 'replay-paused' | 'replay-playing' | 'replay-finished';
interface ReplayState {
  mode: ReplayMode;
  stepIndex: number; // how many moves have been applied
  speed: number; // 0.5, 1, 2
  winningMoveIndex: number | null;
}

export default function Game() {
  const router = useRouter();
  const [gameState, setGameState] = useState<ExtendedGameState>(createInitialState);
  const [displayState, setDisplayState] = useState<ExtendedGameState>(gameState);
  const [recentlyRemovedMove, setRecentlyRemovedMove] = useState<Move | null>(null);
  const [spreadPreset, setSpreadPreset] = useState<SpreadPreset>('normal');
  const [cameraPreset, setCameraPreset] = useState<CameraPreset | null>(null);
  const [mobileControlsOpen, setMobileControlsOpen] = useState(false);
  const [showMobileHint, setShowMobileHint] = useState(true);
  const [replayState, setReplayState] = useState<ReplayState>({
    mode: 'idle',
    stepIndex: 0,
    speed: 1,
    winningMoveIndex: null,
  });
  
  // Load turn time limit from localStorage
  const [turnTimeLimit, setTurnTimeLimit] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY_TURN_TIME);
      return stored ? parseInt(stored, 10) : DEFAULT_TURN_TIME_LIMIT;
    }
    return DEFAULT_TURN_TIME_LIMIT;
  });

  // Load timer enabled state from localStorage (default: false)
  const [timerEnabled, setTimerEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY_TIMER_ENABLED);
      return stored === 'true';
    }
    return false;
  });
  
  const [timeRemaining, setTimeRemaining] = useState(turnTimeLimit);
  const isMobile = useIsMobile();
  const gameStateRef = useRef(gameState);
  const turnTimeLimitRef = useRef(turnTimeLimit);
  const timerEnabledRef = useRef(timerEnabled);
  const replayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const replayStepRef = useRef(0);
  const recordedMovesRef = useRef<Move[]>([]);

  // Keep refs in sync
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    turnTimeLimitRef.current = turnTimeLimit;
  }, [turnTimeLimit]);

  useEffect(() => {
    timerEnabledRef.current = timerEnabled;
  }, [timerEnabled]);
  
  useEffect(() => {
    replayStepRef.current = replayState.stepIndex;
  }, [replayState.stepIndex]);

  // Record only real moves for replay (skip entries don't change board)
  const recordedMoves = useMemo(
    () => gameState.moveHistory.filter((move) => move.type !== 'skip' && move.position) as Move[],
    [gameState.moveHistory]
  );

  useEffect(() => {
    recordedMovesRef.current = recordedMoves;
  }, [recordedMoves]);

  const clearReplayTimer = useCallback(() => {
    if (replayTimerRef.current) {
      clearInterval(replayTimerRef.current);
      replayTimerRef.current = null;
    }
  }, []);

  // Build a game state by applying the first N recorded moves
  const applyRecordedMove = useCallback((state: ExtendedGameState, move: Move): ExtendedGameState => {
    if (!move.position) return state;
    return makeMove({ ...state, currentPlayer: move.player }, move.position);
  }, []);

  const buildStateFromMoves = useCallback(
    (count: number): ExtendedGameState => {
      let state = createInitialState();
      for (let i = 0; i < count; i++) {
        const move = recordedMovesRef.current[i];
        if (move) {
          state = applyRecordedMove(state, move);
        }
      }
      return state;
    },
    [applyRecordedMove]
  );

  const calculateWinningMoveIndex = useCallback((): number | null => {
    let state = createInitialState();
    for (let i = 0; i < recordedMovesRef.current.length; i++) {
      const move = recordedMovesRef.current[i];
      state = applyRecordedMove(state, move);
      if (state.status === 'win') {
        return i; // zero-based index of winning move
      }
    }
    return null;
  }, [applyRecordedMove]);

  // Sync displayed state with live gameplay while not replaying
  useEffect(() => {
    if (replayState.mode === 'idle') {
      setDisplayState(gameState);
    }
  }, [gameState, replayState.mode]);

  // Save turn time limit to localStorage when changed
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_TURN_TIME, turnTimeLimit.toString());
    }
  }, [turnTimeLimit]);

  // Save timer enabled state to localStorage when changed
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_TIMER_ENABLED, timerEnabled.toString());
    }
  }, [timerEnabled]);

  // Reset timer when player changes, game resets, or time limit changes (only if timer is enabled)
  useEffect(() => {
    if (gameState.status === 'playing' && timerEnabled) {
      setTimeRemaining(turnTimeLimitRef.current);
    }
  }, [gameState.currentPlayer, gameState.status, turnTimeLimit, timerEnabled]);

  // Timer effect - countdown and skip turn if time runs out (only if timer is enabled)
  useEffect(() => {
    if (gameState.status !== 'playing' || !timerEnabled) {
      return;
    }

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        const currentState = gameStateRef.current;
        const enabled = timerEnabledRef.current;
        
        if (!enabled) {
          return prev; // Don't countdown if timer is disabled
        }
        
        if (currentState.status !== 'playing') {
          return prev;
        }

        if (prev <= 0) {
          return 0; // Hold at zero until timeout handler runs
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState.status, timerEnabled]);

  // Handle timeout separately to avoid nested state updates in the interval
  useEffect(() => {
    if (!timerEnabled) return;
    if (gameState.status !== 'playing') return;
    if (timeRemaining > 0) return;

    // Penalize current player by skipping their turn
    setGameState((prevState) => {
      if (prevState.status !== 'playing') return prevState;
      const skippedPlayer = prevState.currentPlayer;
      return {
        ...prevState,
        currentPlayer: skippedPlayer === 'X' ? 'O' : 'X',
        moveHistory: [
          ...prevState.moveHistory,
          {
            player: skippedPlayer,
            timestamp: Date.now(),
            type: 'skip',
            reason: 'timeout',
          },
        ],
      };
    });

    // Reset timer for the next player
    setTimeRemaining(turnTimeLimitRef.current);
  }, [timeRemaining, timerEnabled, gameState.status]);

  const handleCellClick = useCallback((position: Position) => {
    if (replayState.mode !== 'idle') return; // disable input during replay
    setGameState((prev) => {
      const newState = makeMove(prev, position);
      // Reset timer when move is made (only if timer is enabled)
      if (timerEnabled) {
        setTimeRemaining(turnTimeLimit);
      }
      return newState;
    });
  }, [turnTimeLimit, timerEnabled, replayState.mode]);

  const handleReset = useCallback(() => {
    clearReplayTimer();
    setReplayState((prev) => ({ ...prev, mode: 'idle', stepIndex: 0 }));
    setGameState(createInitialState());
    if (timerEnabled) {
      setTimeRemaining(turnTimeLimit);
    }
    setDisplayState(createInitialState());
    setRecentlyRemovedMove(null);
  }, [turnTimeLimit, timerEnabled, clearReplayTimer]);

  const handleUndo = useCallback(() => {
    if (replayState.mode !== 'idle') return;
    setGameState((prev) => undoMove(prev));
  }, [replayState.mode]);

  const handleCameraPreset = useCallback((preset: CameraPreset) => {
    setCameraPreset(preset);
  }, []);

  const canUndo = gameState.moveHistory.length > 0 && gameState.status === 'playing' && replayState.mode === 'idle';

  // Calculate history display variables for Game component
  const historyStartIndex = Math.max(0, gameState.moveHistory.length - 10);
  const visibleHistory = gameState.moveHistory.slice(historyStartIndex);
  const highlightedIndex =
    replayState.mode === 'idle'
      ? gameState.moveHistory.length - 1
      : replayState.stepIndex - 1;

  // --- Replay controls ---
  const handleStartReplay = useCallback(() => {
    if (recordedMovesRef.current.length === 0) return;
    clearReplayTimer();
    setReplayState({
      mode: 'replay-paused',
      stepIndex: 0,
      speed: 1,
      winningMoveIndex: calculateWinningMoveIndex(),
    });
    setDisplayState(createInitialState());
    replayStepRef.current = 0;
    setRecentlyRemovedMove(null);
  }, [calculateWinningMoveIndex, clearReplayTimer]);

  const stepToIndex = useCallback(
    (targetIndex: number) => {
      const moves = recordedMovesRef.current;
      const clamped = Math.max(0, Math.min(moves.length, targetIndex));
      const nextState = buildStateFromMoves(clamped);
      const previousStep = replayStepRef.current;
      if (clamped < previousStep) {
        const removed = moves[previousStep - 1];
        setRecentlyRemovedMove(removed || null);
      } else {
        setRecentlyRemovedMove(null);
      }

      // Stop autoplay if we hit win or the end
      const winIndex = replayState.winningMoveIndex;
      const shouldStopForWin = winIndex !== null && clamped >= winIndex + 1;
      const isFinished = clamped === moves.length;
      if (shouldStopForWin || isFinished) {
        clearReplayTimer();
      }

      setDisplayState(nextState);
      setReplayState((prev) => {
        let mode = prev.mode;
        if (isFinished) {
          mode = 'replay-finished';
        } else if (shouldStopForWin && prev.mode === 'replay-playing') {
          mode = 'replay-paused';
        }
        return { ...prev, stepIndex: clamped, mode };
      });
      replayStepRef.current = clamped;
    },
    [buildStateFromMoves, clearReplayTimer, replayState.winningMoveIndex]
  );

  const handleStepForward = useCallback(() => {
    if (replayState.mode === 'idle') return;
    stepToIndex(replayState.stepIndex + 1);
  }, [replayState.mode, replayState.stepIndex, stepToIndex]);

  const handleStepBackward = useCallback(() => {
    if (replayState.mode === 'idle') return;
    stepToIndex(replayState.stepIndex - 1);
  }, [replayState.mode, replayState.stepIndex, stepToIndex]);

  const handleExitReplay = useCallback(() => {
    clearReplayTimer();
    setReplayState((prev) => ({
      ...prev,
      mode: 'idle',
      stepIndex: gameState.moveHistory.length,
    }));
    setDisplayState(gameState);
    replayStepRef.current = gameState.moveHistory.length;
    setRecentlyRemovedMove(null);
  }, [clearReplayTimer, gameState]);

  const handleReplayPlay = useCallback(() => {
    if (replayState.mode === 'idle') return;
    setReplayState((prev) => ({ ...prev, mode: 'replay-playing' }));
  }, [replayState.mode]);

  const handleReplayPause = useCallback(() => {
    clearReplayTimer();
    if (replayState.mode === 'idle') return;
    setReplayState((prev) => ({ ...prev, mode: 'replay-paused' }));
  }, [clearReplayTimer, replayState.mode]);

  const handleSpeedChange = useCallback((speed: number) => {
    setReplayState((prev) => ({ ...prev, speed }));
  }, []);

  // Autoplay effect
  useEffect(() => {
    if (replayState.mode !== 'replay-playing') {
      clearReplayTimer();
      return;
    }

    clearReplayTimer();
    const delay = BASE_REPLAY_DELAY / replayState.speed;
    replayTimerRef.current = setInterval(() => {
      stepToIndex(replayStepRef.current + 1);
    }, delay);

    return () => clearReplayTimer();
  }, [replayState.mode, replayState.speed, stepToIndex, clearReplayTimer]);

  return (
    <div className="relative w-full h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 overflow-hidden" style={{ height: '100vh', overflow: 'hidden' }}>
      {/* Animated Background */}
      <AnimatedBackground />

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
          gl.setClearColor(0x000000, 0);
        }}
      >
        <PerspectiveCamera 
          makeDefault 
          position={isMobile ? [10, 8, 12] : [6, 5, 8]} 
          fov={isMobile ? 45 : 50} 
        />
        <CameraController 
          targetPreset={cameraPreset}
          onTransitionComplete={() => setCameraPreset(null)}
          isMobile={isMobile}
        />

        {/* Lighting */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 10, 10]} intensity={1} />
        <directionalLight position={[-10, -5, -10]} intensity={0.4} color="#8B5CF6" />
        <pointLight position={[0, 5, 0]} intensity={0.6} color="#EC4899" />

        {/* Game Board */}
        <Board3D 
          gameState={displayState} 
          onCellClick={handleCellClick} 
          visibleLayers={[true, true, true, true]}
          explodeAmount={SPREAD_VALUES[spreadPreset]}
          highlightLayer={null}
          recentlyRemovedMove={recentlyRemovedMove}
        />
      </Canvas>

      {/* UI Overlay */}
      <GameUI 
        gameState={displayState} 
        onReset={handleReset}
        onUndo={handleUndo}
        canUndo={canUndo}
        spreadPreset={spreadPreset}
        setSpreadPreset={setSpreadPreset}
        onCameraPreset={handleCameraPreset}
        mobileControlsOpen={mobileControlsOpen}
        setMobileControlsOpen={setMobileControlsOpen}
        timeRemaining={timeRemaining}
        turnTimeLimit={turnTimeLimit}
        setTurnTimeLimit={setTurnTimeLimit}
        timerEnabled={timerEnabled}
        setTimerEnabled={setTimerEnabled}
        replayState={replayState}
        onStartReplay={handleStartReplay}
        onExitReplay={handleExitReplay}
        onReplayPlay={handleReplayPlay}
        onReplayPause={handleReplayPause}
        onStepForward={handleStepForward}
        onStepBackward={handleStepBackward}
        onSpeedChange={handleSpeedChange}
        totalRecordedMoves={recordedMoves.length}
      />

      {/* Mobile Interaction Hint */}
      {isMobile && showMobileHint && (
        <div className="sm:hidden absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-auto z-50 max-w-[90%] px-4">
          <div className="bg-gradient-to-b from-black/90 to-black/80 backdrop-blur-xl rounded-xl p-4 sm:p-5 border border-purple-500/40 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <p className="text-white text-sm font-medium mb-1">💡 View Controls</p>
                <p className="text-gray-300 text-xs leading-relaxed">
                  Pinch to zoom • Drag to rotate
                </p>
              </div>
              <button
                onClick={() => setShowMobileHint(false)}
                className="w-6 h-6 rounded-full bg-black/50 active:bg-black/70 text-gray-400 active:text-white flex items-center justify-center transition-all flex-shrink-0 text-xs"
                aria-label="Dismiss hint"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Left Side - Spread & Camera Controls (Desktop) */}
      <div className="hidden sm:block absolute left-3 sm:left-4 md:left-5 top-1/2 -translate-y-1/2 pointer-events-auto">
        <div className="bg-gradient-to-b from-black/60 to-black/40 backdrop-blur-xl rounded-2xl p-4 sm:p-6 md:p-8 border border-purple-500/30 shadow-2xl shadow-purple-900/20">
          {/* Spread Presets */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-purple-400 text-sm">📐</span>
              <p className="text-xs text-gray-300 font-semibold uppercase tracking-wider">Spread</p>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {(['compact', 'normal', 'spread', 'exploded'] as SpreadPreset[]).map((preset) => (
                <button
                  key={preset}
                  onClick={() => setSpreadPreset(preset)}
                  className={`px-3 py-2 text-xs rounded-lg transition-all capitalize font-medium ${
                    spreadPreset === preset
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                      : 'bg-black/50 text-gray-400 hover:bg-black/70 hover:text-white'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Camera Presets */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-cyan-400 text-sm">📷</span>
              <p className="text-xs text-gray-300 font-semibold uppercase tracking-wider">Camera</p>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {(['isometric', 'top', 'side', 'front'] as CameraPreset[]).map((preset) => (
                <button
                  key={preset}
                  onClick={() => handleCameraPreset(preset)}
                  className="px-3 py-2 text-xs rounded-lg transition-all capitalize font-medium bg-black/50 text-gray-400 hover:bg-gradient-to-r hover:from-cyan-600 hover:to-blue-600 hover:text-white"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Turn Timer Toggle */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-yellow-400 text-sm">⏱️</span>
              <p className="text-xs text-gray-300 font-semibold uppercase tracking-wider">Turn Timer</p>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => setTimerEnabled(!timerEnabled)}
                className={`px-3 py-2 text-xs rounded-lg transition-all capitalize font-medium ${
                  timerEnabled
                    ? 'bg-gradient-to-r from-yellow-600 to-orange-600 text-white shadow-lg'
                    : 'bg-black/50 text-gray-400 hover:bg-black/70 hover:text-white'
                }`}
              >
                {timerEnabled ? 'On' : 'Off'}
              </button>
            </div>
            {timerEnabled && (
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="5"
                  max="60"
                  step="5"
                  value={turnTimeLimit}
                  onChange={(e) => setTurnTimeLimit(parseInt(e.target.value, 10))}
                  className="flex-1 h-2 bg-black/50 rounded-lg appearance-none cursor-pointer accent-purple-600"
                />
                <span className="text-xs text-gray-400 font-mono min-w-[35px] text-right">
                  {turnTimeLimit}s
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Side - Move History (Desktop) - Below Turn Indicator */}
      <div className="hidden sm:block absolute right-3 sm:right-4 md:right-5 top-[calc(50%-200px)] md:top-[calc(50%-220px)] pointer-events-auto">
        <div className="bg-gradient-to-b from-black/60 to-black/40 backdrop-blur-xl rounded-2xl p-4 sm:p-6 md:p-8 border border-purple-500/30 shadow-2xl shadow-purple-900/20 w-[200px] sm:w-[240px] md:w-[280px]">
          {/* Move History */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-blue-400 text-sm">📜</span>
              <p className="text-xs text-gray-300 font-semibold uppercase tracking-wider">History</p>
            </div>
            <div className="flex flex-col gap-2 text-xs max-h-[50vh] overflow-y-auto">
              {visibleHistory.map((move, i) => {
                const globalIndex = historyStartIndex + i;
                const isActive = highlightedIndex === globalIndex && highlightedIndex >= 0;
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-2 py-2 px-3 bg-black/40 rounded-lg hover:bg-black/60 transition-colors ${
                      isActive ? 'border border-yellow-500/50' : ''
                    }`}
                  >
                    <span className={`font-bold text-sm ${move.player === 'X' ? 'text-red-400' : 'text-cyan-400'}`}>
                      {move.player}
                    </span>
                    {move.type === 'skip' ? (
                      <span className="text-gray-400 text-[10px]">Turn skipped • timer</span>
                    ) : move.position ? (
                      <span className="text-gray-400 font-mono text-[10px]">
                        ({move.position.x},{move.position.y},{move.position.z})
                      </span>
                    ) : null}
                  </div>
                );
              })}
              {gameState.moveHistory.length === 0 && (
                <div className="text-gray-500 text-center py-3 text-xs">No moves yet</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Controls Sheet - Outside GameUI for proper z-index */}
      <Sheet open={mobileControlsOpen} onOpenChange={setMobileControlsOpen}>
        <SheetContent side="bottom" className="sm:hidden flex flex-col bg-gradient-to-b from-black/95 to-black/90 backdrop-blur-xl border-purple-500/30 [&>button]:hidden p-0">
          {/* Header with Close Button */}
          <div className="flex items-center justify-between px-4 sm:px-5 pt-4 sm:pt-5 pb-2 flex-shrink-0">
            <h2 className="text-base font-bold text-white">Settings</h2>
            <button
              onClick={() => setMobileControlsOpen(false)}
              className="w-8 h-8 rounded-full bg-black/50 active:bg-black/70 text-gray-400 active:text-white flex items-center justify-center transition-all text-lg"
              aria-label="Close settings"
            >
              ✕
            </button>
          </div>
          {/* Handle */}
          <div className="flex justify-center pb-2 sm:pb-3 flex-shrink-0">
            <div className="w-12 h-1.5 bg-gray-600 rounded-full" />
          </div>

          {/* Content - Scrollable */}
          <div className="px-4 sm:px-5 pb-6 sm:pb-8 overflow-y-auto flex-1 min-h-0">
            {/* Spread */}
            <div className="mb-4 sm:mb-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-purple-400 text-base">📐</span>
                <p className="text-xs text-gray-200 font-semibold uppercase tracking-wider">Spread</p>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {(['compact', 'normal', 'spread', 'exploded'] as SpreadPreset[]).map((preset) => (
                  <button
                    key={preset}
                    onClick={() => {
                      setSpreadPreset(preset);
                      setMobileControlsOpen(false);
                    }}
                    className={`py-2.5 px-1.5 text-[10px] rounded-lg transition-all capitalize font-semibold ${
                      spreadPreset === preset
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
                        : 'bg-black/60 text-gray-400 active:bg-black/80'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Camera */}
            <div className="mb-4 sm:mb-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-cyan-400 text-base">📷</span>
                <p className="text-xs text-gray-200 font-semibold uppercase tracking-wider">Camera</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(['isometric', 'top', 'side', 'front'] as CameraPreset[]).map((preset) => (
                  <button
                    key={preset}
                    onClick={() => {
                      handleCameraPreset(preset);
                      setMobileControlsOpen(false);
                    }}
                    className="py-2.5 px-2 text-[10px] rounded-lg transition-all capitalize font-semibold bg-black/60 text-gray-400 active:bg-gradient-to-r active:from-cyan-600 active:to-blue-600 active:text-white"
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Turn Timer Toggle */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-yellow-400 text-base">⏱️</span>
                <p className="text-xs text-gray-200 font-semibold uppercase tracking-wider">Turn Timer</p>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <button
                  onClick={() => setTimerEnabled(!timerEnabled)}
                  className={`px-4 py-2.5 text-xs rounded-lg transition-all capitalize font-semibold ${
                    timerEnabled
                      ? 'bg-gradient-to-r from-yellow-600 to-orange-600 text-white shadow-lg'
                      : 'bg-black/60 text-gray-400 active:bg-black/80'
                  }`}
                >
                  {timerEnabled ? 'On' : 'Off'}
                </button>
              </div>
              {timerEnabled && (
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="5"
                    max="60"
                    step="5"
                    value={turnTimeLimit}
                    onChange={(e) => setTurnTimeLimit(parseInt(e.target.value, 10))}
                    className="flex-1 h-2 bg-black/50 rounded-lg appearance-none cursor-pointer accent-purple-600"
                  />
                  <span className="text-sm text-gray-300 font-mono min-w-[40px] text-right">
                    {turnTimeLimit}s
                  </span>
                </div>
              )}
            </div>

          </div>
        </SheetContent>
      </Sheet>
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
  mobileControlsOpen,
  setMobileControlsOpen,
  timeRemaining,
  turnTimeLimit,
  setTurnTimeLimit,
  timerEnabled,
  setTimerEnabled,
  replayState,
  onStartReplay,
  onExitReplay,
  onReplayPlay,
  onReplayPause,
  onStepForward,
  onStepBackward,
  onSpeedChange,
  totalRecordedMoves,
}: {
  gameState: ExtendedGameState;
  onReset: () => void;
  onUndo: () => void;
  canUndo: boolean;
  spreadPreset: SpreadPreset;
  setSpreadPreset: (preset: SpreadPreset) => void;
  onCameraPreset: (preset: CameraPreset) => void;
  mobileControlsOpen: boolean;
  setMobileControlsOpen: (open: boolean) => void;
  timeRemaining: number;
  turnTimeLimit: number;
  setTurnTimeLimit: (limit: number) => void;
  timerEnabled: boolean;
  setTimerEnabled: (enabled: boolean) => void;
  replayState: ReplayState;
  onStartReplay: () => void;
  onExitReplay: () => void;
  onReplayPlay: () => void;
  onReplayPause: () => void;
  onStepForward: () => void;
  onStepBackward: () => void;
  onSpeedChange: (speed: number) => void;
  totalRecordedMoves: number;
}) {
  const router = useRouter();
  const { currentPlayer, status, winningLine, moveCount, threats } = gameState;
  const isReplayActive = replayState.mode !== 'idle';
  const currentStep = replayState.stepIndex;
  const canStartReplay = (gameState.status === 'win' || gameState.status === 'draw') && totalRecordedMoves > 0;
  const moveCounter = isReplayActive ? currentStep : totalRecordedMoves;
  
  // Calculate history display variables
  const historyStartIndex = Math.max(0, gameState.moveHistory.length - 10);
  const visibleHistory = gameState.moveHistory.slice(historyStartIndex);
  const highlightedIndex =
    replayState.mode === 'idle'
      ? gameState.moveHistory.length - 1
      : replayState.stepIndex - 1;

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col">
      {/* Settings Button - Mobile */}
      <div className="sm:hidden absolute top-3 right-3 pointer-events-auto z-50">
        <button
          onClick={() => setMobileControlsOpen(!mobileControlsOpen)}
          className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 text-white shadow-xl shadow-purple-500/50 flex items-center justify-center text-lg hover:scale-110 active:scale-95 transition-all border-2 border-white/20"
          aria-label="Settings"
        >
          ⚙️
        </button>
      </div>


      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-3 sm:p-4 md:p-5 pointer-events-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => router.push('/')}
              className="text-base sm:text-xl font-bold bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent hover:opacity-80 transition-opacity cursor-pointer"
            >
              QuadCube
            </button>
            <div className="hidden sm:flex items-center gap-1.5 bg-black/40 backdrop-blur-sm rounded-full px-3 py-1.5">
              <span className="text-xs text-gray-400">{moveCount}</span>
              <span className="text-gray-600">/</span>
              <span className="text-xs text-purple-400">64</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 w-auto sm:w-auto">
            {/* Undo Button */}
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className={`text-white text-base sm:text-base font-medium sm:font-semibold py-3 sm:py-3 px-4 sm:px-6 rounded-xl transition-all flex items-center justify-center min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 ${
                canUndo 
                  ? 'bg-gray-700/80 hover:bg-gray-600 active:scale-95 sm:hover:scale-105' 
                  : 'bg-gray-800/50 opacity-50 cursor-not-allowed'
              }`}
              title="Undo"
            >
              <span className="sm:hidden text-xl">↩</span>
              <span className="hidden sm:inline">↩ Undo</span>
            </button>

            {/* Reset Button */}
            <button
              onClick={onReset}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-base sm:text-base font-medium sm:font-semibold py-3 sm:py-3 px-4 sm:px-10 rounded-xl transition-all active:scale-95 sm:hover:scale-105 shadow-md sm:shadow-lg shadow-purple-500/20 sm:shadow-purple-500/25 border border-white/10 flex items-center justify-center min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0"
              title="Reset Game"
            >
              <span className="sm:hidden text-xl">🔄</span>
              <span className="hidden sm:inline">Reset Game</span>
            </button>
          </div>
        </div>
      </div>

      {/* Player Turn Indicator and Timer - Flex Layout */}
      {status === 'playing' && (
        <div className="flex items-center justify-end gap-2 px-4 sm:px-5 pointer-events-none z-10 mt-16 sm:mt-0 sm:absolute sm:top-[calc(50%-280px)] md:sm:top-[calc(50%-300px)] sm:right-3 sm:right-4 md:right-5">
          {/* Player Turn Indicator */}
          <div className={`
            flex items-center gap-1.5 sm:gap-2 
            px-3 sm:px-4 py-1.5 sm:py-2 
            rounded-xl sm:rounded-xl 
            backdrop-blur-xl border
            ${currentPlayer === 'X' 
              ? 'bg-red-500/20 border-red-500/40 shadow-lg shadow-red-500/20' 
              : 'bg-cyan-500/20 border-cyan-500/40 shadow-lg shadow-cyan-500/20'
            }
          `}>
            <PlayerIndicator player={currentPlayer} size="lg" />
            <div className="flex flex-col gap-0.5">
              <span className="text-white font-bold text-xs sm:text-sm">
                {currentPlayer === 'X' ? 'Player 1' : 'Player 2'}
              </span>
              <span className="text-gray-400 text-[9px] sm:text-[10px] hidden sm:block">your turn</span>
            </div>
          </div>

          {/* Timer Card - Only show if timer is enabled */}
          {timerEnabled && (
            <div className={`
              flex items-center justify-center gap-2
              px-3 sm:px-4 py-2 sm:py-3
              rounded-xl sm:rounded-xl 
              backdrop-blur-xl border
              ${timeRemaining <= 5 
                ? 'bg-red-500/30 border-red-500/60 shadow-lg shadow-red-500/30' 
                : timeRemaining <= 10
                ? 'bg-yellow-500/20 border-yellow-500/40 shadow-lg shadow-yellow-500/20'
                : 'bg-purple-500/20 border-purple-500/40 shadow-lg shadow-purple-500/20'
              }
            `}>
              <span className="text-yellow-400 text-sm sm:text-base">⏱️</span>
              <span className={`font-mono font-bold text-base sm:text-lg ${timeRemaining <= 5 ? 'text-red-400' : timeRemaining <= 10 ? 'text-yellow-400' : 'text-purple-400'}`}>
                {timeRemaining}s
              </span>
            </div>
          )}
        </div>
      )}

      {/* Replay Controls */}
      {(isReplayActive || canStartReplay) && (
        <div className="absolute right-3 sm:right-4 md:right-5 bottom-24 sm:bottom-16 pointer-events-auto z-10 max-w-[320px]">
          <div className="bg-gradient-to-b from-black/70 to-black/50 backdrop-blur-xl rounded-2xl p-4 border border-purple-500/30 shadow-2xl shadow-purple-900/20 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-yellow-300">🔁</span>
                <p className="text-sm text-white font-semibold">
                  {isReplayActive ? 'Replay Controls' : 'Watch Replay'}
                </p>
              </div>
              <span className="text-[11px] text-gray-400 font-mono">
                Move {Math.min(moveCounter, totalRecordedMoves)}/{totalRecordedMoves}
              </span>
            </div>

            {!isReplayActive && (
              <button
                onClick={onStartReplay}
                className="w-full py-2 rounded-lg bg-gradient-to-r from-yellow-600 to-orange-600 text-white font-semibold text-sm hover:from-yellow-500 hover:to-orange-500 transition-all"
              >
                ▶️ Start Replay
              </button>
            )}

            {isReplayActive && (
              <>
                <div className="flex items-center gap-2 justify-between">
                  <button
                    onClick={onStepBackward}
                    disabled={currentStep === 0}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold ${
                      currentStep === 0
                        ? 'bg-gray-800/60 text-gray-500 cursor-not-allowed'
                        : 'bg-black/50 text-gray-200 hover:bg-black/70'
                    }`}
                  >
                    ⏮
                  </button>
                  {replayState.mode === 'replay-playing' ? (
                    <button
                      onClick={onReplayPause}
                      className="flex-1 py-2 rounded-lg bg-gradient-to-r from-red-600 to-pink-600 text-white font-semibold text-sm hover:from-red-500 hover:to-pink-500 transition-all"
                    >
                      ⏸ Pause
                    </button>
                  ) : (
                    <button
                      onClick={onReplayPlay}
                      className="flex-1 py-2 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold text-sm hover:from-green-500 hover:to-emerald-500 transition-all"
                    >
                      ▶️ Play
                    </button>
                  )}
                  <button
                    onClick={onStepForward}
                    disabled={currentStep >= totalRecordedMoves}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold ${
                      currentStep >= totalRecordedMoves
                        ? 'bg-gray-800/60 text-gray-500 cursor-not-allowed'
                        : 'bg-black/50 text-gray-200 hover:bg-black/70'
                    }`}
                  >
                    ⏭
                  </button>
                </div>

                <div className="flex items-center gap-2 justify-between">
                  <div className="flex items-center gap-1 text-[11px] text-gray-400">
                    <span className="px-2 py-1 rounded bg-black/40 border border-purple-500/30">
                      {replayState.mode === 'replay-finished' ? 'Finished' : replayState.mode === 'replay-playing' ? 'Playing' : 'Paused'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {[0.5, 1, 2].map((speed) => (
                      <button
                        key={speed}
                        onClick={() => onSpeedChange(speed)}
                        className={`px-2 py-1 rounded text-[11px] font-semibold ${
                          replayState.speed === speed
                            ? 'bg-purple-600 text-white'
                            : 'bg-black/50 text-gray-300 hover:bg-black/70'
                        }`}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={onExitReplay}
                  className="w-full py-2 rounded-lg bg-black/50 text-gray-300 hover:bg-black/70 border border-white/10 text-sm font-semibold transition-all"
                >
                  ⏹ Exit Replay
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Win Status */}
      {status === 'win' && winningLine && (
        <div className="absolute top-16 sm:top-[calc(50%-280px)] md:top-[calc(50%-300px)] left-1/2 sm:left-auto sm:right-3 sm:right-4 md:right-5 sm:translate-x-0 -translate-x-1/2 pointer-events-none z-10 sm:w-[240px] md:w-[280px]">
          <div className="flex items-center gap-2 sm:gap-2 px-4 sm:px-4 py-2 sm:py-2 rounded-2xl bg-yellow-500/20 backdrop-blur-xl border border-yellow-500/40 shadow-lg shadow-yellow-500/20">
            <PlayerIndicator player={winningLine.winner} size="lg" />
            <div className="flex flex-col gap-0.5">
              <span className="text-yellow-400 font-bold text-sm sm:text-base">
                🎉 {winningLine.winner === 'X' ? 'Player 1' : 'Player 2'} Wins!
              </span>
              <span className="text-gray-400 text-[10px] sm:text-xs">{moveCount} moves</span>
            </div>
          </div>
        </div>
      )}

      {/* Draw Status */}
      {status === 'draw' && (
        <div className="absolute top-16 sm:top-[calc(50%-280px)] md:top-[calc(50%-300px)] left-1/2 sm:left-auto sm:right-3 sm:right-4 md:right-5 sm:translate-x-0 -translate-x-1/2 pointer-events-none z-10 sm:w-[240px] md:w-[280px]">
          <div className="flex items-center gap-2 sm:gap-2 px-4 sm:px-4 py-2 sm:py-2 rounded-2xl bg-gray-500/20 backdrop-blur-xl border border-gray-500/40">
            <span className="text-2xl">🤝</span>
            <div className="flex flex-col gap-0.5">
              <span className="text-white font-bold text-sm sm:text-base">It's a Draw!</span>
              <span className="text-gray-400 text-[10px] sm:text-xs">All 64 cells filled</span>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Stats */}
      <div className="sm:hidden absolute top-14 sm:top-16 right-3 sm:right-4 pointer-events-none">
        <div className="bg-black/40 backdrop-blur-sm rounded-full px-2.5 py-1">
          <span className="text-[10px] text-gray-400">{moveCount}/64</span>
        </div>
      </div>

      {/* Bottom Controls Hint (Desktop only) */}
      <div className="hidden sm:block absolute bottom-3 sm:bottom-4 md:bottom-5 left-1/2 -translate-x-1/2 pointer-events-auto px-4">
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
