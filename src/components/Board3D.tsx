'use client';

import { useMemo, useRef } from 'react';
import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import Cell from './Cell';
import { Player, Position } from '@/types/game';
import { ExtendedGameState, Threat, isWinningPosition, isThreatPosition } from '@/lib/gameLogic';

interface Board3DProps {
  gameState: ExtendedGameState;
  onCellClick: (position: Position) => void;
  visibleLayers: boolean[];
  explodeAmount?: number;
  highlightLayer?: number | null;
}

const BOARD_SIZE = 4;
const CELL_SPACING = 1.2;
const BASE_LAYER_SPACING = 1.5;

// Winning Line Beam Component
function WinningLineBeam({ 
  positions, 
  layerSpacing 
}: { 
  positions: Position[]; 
  layerSpacing: number;
}) {
  const tubeRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);
  
  const offset = ((BOARD_SIZE - 1) * CELL_SPACING) / 2;
  const verticalOffset = ((BOARD_SIZE - 1) * layerSpacing) / 2;

  // Calculate world positions for the line
  const worldPositions = useMemo(() => {
    return positions.map(pos => new THREE.Vector3(
      pos.x * CELL_SPACING - offset,
      pos.z * layerSpacing - verticalOffset,
      pos.y * CELL_SPACING - offset
    ));
  }, [positions, layerSpacing, offset, verticalOffset]);

  // Create tube geometry along the winning line
  const { tubeGeometry, glowGeometry } = useMemo(() => {
    const start = worldPositions[0];
    const end = worldPositions[worldPositions.length - 1];
    
    // Extend the line slightly past the markers
    const direction = new THREE.Vector3().subVectors(end, start).normalize();
    const extendedStart = start.clone().sub(direction.clone().multiplyScalar(0.3));
    const extendedEnd = end.clone().add(direction.clone().multiplyScalar(0.3));
    
    // Create a path for the tube
    const curve = new THREE.LineCurve3(extendedStart, extendedEnd);
    
    return {
      tubeGeometry: new THREE.TubeGeometry(curve, 20, 0.08, 16, false),
      glowGeometry: new THREE.TubeGeometry(curve, 20, 0.15, 16, false),
    };
  }, [worldPositions]);

  // Animate the glow
  useFrame((state) => {
    if (materialRef.current) {
      const pulse = Math.sin(state.clock.elapsedTime * 3) * 0.3 + 0.7;
      materialRef.current.emissiveIntensity = pulse;
    }
    if (glowRef.current) {
      const glowPulse = Math.sin(state.clock.elapsedTime * 3) * 0.15 + 0.3;
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity = glowPulse;
    }
  });

  return (
    <group>
      {/* Outer glow */}
      <mesh ref={glowRef} geometry={glowGeometry}>
        <meshBasicMaterial 
          color="#FFD700"
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>
      
      {/* Core beam */}
      <mesh ref={tubeRef} geometry={tubeGeometry}>
        <meshStandardMaterial 
          ref={materialRef}
          color="#FFD700"
          emissive="#FFD700"
          emissiveIntensity={0.7}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>
      
      {/* Endpoint spheres */}
      {[worldPositions[0], worldPositions[worldPositions.length - 1]].map((pos, i) => (
        <mesh key={i} position={pos}>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshStandardMaterial 
            color="#FFD700"
            emissive="#FFD700"
            emissiveIntensity={0.8}
          />
        </mesh>
      ))}
    </group>
  );
}

export default function Board3D({ 
  gameState, 
  onCellClick, 
  visibleLayers,
  explodeAmount = 0,
  highlightLayer = null,
}: Board3DProps) {
  const explodeSpacing = (explodeAmount / 100) * 2;
  const layerSpacing = BASE_LAYER_SPACING + explodeSpacing;

  // Calculate world positions for all cells
  const cells = useMemo(() => {
    const cellData: {
      position: Position;
      worldPosition: [number, number, number];
      layer: number;
    }[] = [];

    const offset = ((BOARD_SIZE - 1) * CELL_SPACING) / 2;
    const verticalOffset = ((BOARD_SIZE - 1) * layerSpacing) / 2;

    for (let x = 0; x < BOARD_SIZE; x++) {
      for (let y = 0; y < BOARD_SIZE; y++) {
        for (let z = 0; z < BOARD_SIZE; z++) {
          cellData.push({
            position: { x, y, z },
            worldPosition: [
              x * CELL_SPACING - offset,
              z * layerSpacing - verticalOffset,
              y * CELL_SPACING - offset,
            ],
            layer: z,
          });
        }
      }
    }

    return cellData;
  }, [layerSpacing]);

  const isGameWon = gameState.status === 'win';

  return (
    <group>
      {/* Grid lines for visual reference */}
      <GridLines visibleLayers={visibleLayers} layerSpacing={layerSpacing} isDimmed={isGameWon} />
      
      {/* Layer indicators */}
      <LayerIndicators visibleLayers={visibleLayers} layerSpacing={layerSpacing} highlightLayer={highlightLayer} />

      {/* Winning line beam */}
      {gameState.winningLine && (
        <WinningLineBeam 
          positions={gameState.winningLine.positions}
          layerSpacing={layerSpacing}
        />
      )}

      {/* Render visible cells */}
      {cells.map(({ position, worldPosition, layer }) => {
        const isWinningCell = isWinningPosition(gameState.winningLine, position);
        const threat = isThreatPosition(gameState.threats, position);
        const isNewlyPlaced: boolean = !!(gameState.lastMovePosition && 
          position.x === gameState.lastMovePosition.x &&
          position.y === gameState.lastMovePosition.y &&
          position.z === gameState.lastMovePosition.z);
        
        // Dim non-winning cells when game is won
        const isDimmed = isGameWon && !isWinningCell;

        return visibleLayers[layer] && (
          <Cell
            key={`${position.x}-${position.y}-${position.z}`}
            position={position}
            worldPosition={worldPosition}
            value={gameState.board[position.x][position.y][position.z]}
            isWinning={isWinningCell}
            isGameOver={gameState.status !== 'playing'}
            onClick={onCellClick}
            isHighlighted={highlightLayer === layer}
            threatPlayer={threat?.player || null}
            currentPlayer={gameState.currentPlayer}
            isNewlyPlaced={isNewlyPlaced}
            isDimmed={isDimmed}
          />
        );
      })}
    </group>
  );
}

// Grid lines component
function GridLines({ 
  visibleLayers, 
  layerSpacing,
  isDimmed,
}: { 
  visibleLayers: boolean[]; 
  layerSpacing: number;
  isDimmed: boolean;
}) {
  const offset = ((BOARD_SIZE - 1) * CELL_SPACING) / 2;
  const verticalOffset = ((BOARD_SIZE - 1) * layerSpacing) / 2;
  
  const lines = useMemo(() => {
    const lineData: { points: [number, number, number][]; layer: number }[] = [];
    
    for (let layer = 0; layer < BOARD_SIZE; layer++) {
      const y = layer * layerSpacing - verticalOffset;
      
      for (let z = 0; z < BOARD_SIZE; z++) {
        lineData.push({
          points: [
            [-offset - 0.4, y, z * CELL_SPACING - offset],
            [offset + 0.4, y, z * CELL_SPACING - offset],
          ],
          layer,
        });
      }
      
      for (let x = 0; x < BOARD_SIZE; x++) {
        lineData.push({
          points: [
            [x * CELL_SPACING - offset, y, -offset - 0.4],
            [x * CELL_SPACING - offset, y, offset + 0.4],
          ],
          layer,
        });
      }
    }
    
    return lineData;
  }, [offset, layerSpacing, verticalOffset]);

  return (
    <group>
      {lines.map((line, index) => (
        visibleLayers[line.layer] && (
          <Line
            key={index}
            points={line.points}
            color="#4B4B7C"
            lineWidth={1}
            transparent
            opacity={isDimmed ? 0.2 : 0.5}
          />
        )
      ))}
    </group>
  );
}

// Layer indicators component
function LayerIndicators({ 
  visibleLayers, 
  layerSpacing,
  highlightLayer,
}: { 
  visibleLayers: boolean[]; 
  layerSpacing: number;
  highlightLayer: number | null;
}) {
  const offset = ((BOARD_SIZE - 1) * CELL_SPACING) / 2;
  const verticalOffset = ((BOARD_SIZE - 1) * layerSpacing) / 2;
  const colors = ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3'];
  
  return (
    <group>
      {[0, 1, 2, 3].map((layer) => (
        visibleLayers[layer] && (
          <mesh 
            key={layer} 
            position={[-offset - 1.5, layer * layerSpacing - verticalOffset, 0]}
            scale={highlightLayer === layer ? 1.3 : 1}
          >
            <planeGeometry args={[0.6, 0.6]} />
            <meshBasicMaterial 
              color={colors[layer]}
              opacity={highlightLayer === layer ? 0.9 : 0.5}
              transparent
            />
          </mesh>
        )
      ))}
    </group>
  );
}
