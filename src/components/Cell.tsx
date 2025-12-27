'use client';

import { useRef, useState, useEffect } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { CellValue, Player, Position } from '@/types/game';

interface CellProps {
  position: Position;
  worldPosition: [number, number, number];
  value: CellValue;
  isWinning: boolean;
  isGameOver: boolean;
  onClick: (position: Position) => void;
  isHighlighted?: boolean;
  threatPlayer?: Player | null;
  currentPlayer: Player;
  isNewlyPlaced?: boolean;
  isDimmed?: boolean;
  recentlyRemovedPlayer?: Player | null;
  recentlyRemovedId?: number | null;
}

// Easing function for bounce effect
function easeOutBounce(x: number): number {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (x < 1 / d1) {
    return n1 * x * x;
  } else if (x < 2 / d1) {
    return n1 * (x -= 1.5 / d1) * x + 0.75;
  } else if (x < 2.5 / d1) {
    return n1 * (x -= 2.25 / d1) * x + 0.9375;
  } else {
    return n1 * (x -= 2.625 / d1) * x + 0.984375;
  }
}

// X Marker Component with drop animation
function XMarker({ isWinning, isNewlyPlaced, isDimmed }: { isWinning: boolean; isNewlyPlaced: boolean; isDimmed: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const animationProgress = useRef(0);
  const dropHeight = 3;

  // Reset animation when newly placed changes
  useEffect(() => {
    if (isNewlyPlaced) {
      animationProgress.current = 0;
      if (groupRef.current) {
        groupRef.current.scale.setScalar(0.01);
        groupRef.current.position.y = dropHeight;
      }
    }
  }, [isNewlyPlaced]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    
    if (animationProgress.current < 1) {
      animationProgress.current = Math.min(1, animationProgress.current + delta * 2.5);
      const eased = easeOutBounce(animationProgress.current);
      
      // Scale from 0 to 1
      groupRef.current.scale.setScalar(eased);
      
      // Drop from above
      groupRef.current.position.y = dropHeight * (1 - eased);
    }
    
    if (isWinning) {
      groupRef.current.rotation.y += delta * 2;
    }
  });

  const barGeometry: [number, number, number] = [0.1, 0.7, 0.1];
  const color = isWinning ? '#FFD700' : '#FF6B6B';
  const emissive = isWinning ? '#FFD700' : '#FF3333';
  const opacity = isDimmed ? 0.3 : 1;

  return (
    <group ref={groupRef} scale={isNewlyPlaced ? 0.01 : 1} position={[0, isNewlyPlaced ? dropHeight : 0, 0]}>
      <mesh rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={barGeometry} />
        <meshStandardMaterial 
          color={color} 
          emissive={emissive}
          emissiveIntensity={isWinning ? 0.8 : 0.3}
          metalness={0.4}
          roughness={0.3}
          transparent={isDimmed}
          opacity={opacity}
        />
      </mesh>
      <mesh rotation={[0, 0, -Math.PI / 4]}>
        <boxGeometry args={barGeometry} />
        <meshStandardMaterial 
          color={color} 
          emissive={emissive}
          emissiveIntensity={isWinning ? 0.8 : 0.3}
          metalness={0.4}
          roughness={0.3}
          transparent={isDimmed}
          opacity={opacity}
        />
      </mesh>
    </group>
  );
}

// O Marker Component with drop animation
function OMarker({ isWinning, isNewlyPlaced, isDimmed }: { isWinning: boolean; isNewlyPlaced: boolean; isDimmed: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const animationProgress = useRef(0);
  const dropHeight = 3;

  // Reset animation when newly placed changes
  useEffect(() => {
    if (isNewlyPlaced) {
      animationProgress.current = 0;
      if (meshRef.current) {
        meshRef.current.scale.setScalar(0.01);
        meshRef.current.position.y = dropHeight;
      }
    }
  }, [isNewlyPlaced]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    
    if (animationProgress.current < 1) {
      animationProgress.current = Math.min(1, animationProgress.current + delta * 2.5);
      const eased = easeOutBounce(animationProgress.current);
      
      meshRef.current.scale.setScalar(eased);
      meshRef.current.position.y = dropHeight * (1 - eased);
    }
    
    if (isWinning) {
      meshRef.current.rotation.x += delta * 2;
      meshRef.current.rotation.z += delta;
    }
  });

  const color = isWinning ? '#FFD700' : '#4ECDC4';
  const emissive = isWinning ? '#FFD700' : '#00FFCC';
  const opacity = isDimmed ? 0.3 : 1;

  return (
    <mesh ref={meshRef} scale={isNewlyPlaced ? 0.01 : 1} position={[0, isNewlyPlaced ? dropHeight : 0, 0]}>
      <torusGeometry args={[0.3, 0.08, 16, 32]} />
      <meshStandardMaterial 
        color={color}
        emissive={emissive}
        emissiveIntensity={isWinning ? 0.8 : 0.3}
        metalness={0.4}
        roughness={0.3}
        transparent={isDimmed}
        opacity={opacity}
      />
    </mesh>
  );
}

// Brief fade/scale down marker for removals during replay stepping backward
function RemovedMarker({ player, removalId }: { player: Player; removalId: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const progressRef = useRef(0);
  const color = player === 'X' ? '#FF6B6B' : '#4ECDC4';

  useEffect(() => {
    progressRef.current = 0;
    if (meshRef.current) {
      meshRef.current.visible = true;
      meshRef.current.scale.setScalar(1);
      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      mat.opacity = 0.6;
    }
  }, [removalId]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    progressRef.current = Math.min(1, progressRef.current + delta * 2.5);
    const scale = Math.max(0, 1 - progressRef.current);
    meshRef.current.scale.setScalar(scale);
    const mat = meshRef.current.material as THREE.MeshStandardMaterial;
    mat.opacity = Math.max(0, 0.6 * (1 - progressRef.current));
    if (progressRef.current >= 1) {
      meshRef.current.visible = false;
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[0.35, 14, 14]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.2}
        transparent
        opacity={0.6}
        metalness={0.3}
        roughness={0.5}
      />
    </mesh>
  );
}

// Ghost marker for hover preview
function GhostMarker({ player }: { player: Player }) {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.02;
    }
  });

  if (player === 'X') {
    return (
      <group ref={groupRef}>
        <mesh rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.1, 0.7, 0.1]} />
          <meshStandardMaterial 
            color="#FF6B6B"
            emissive="#FF3333"
            emissiveIntensity={0.2}
            transparent
            opacity={0.4}
          />
        </mesh>
        <mesh rotation={[0, 0, -Math.PI / 4]}>
          <boxGeometry args={[0.1, 0.7, 0.1]} />
          <meshStandardMaterial 
            color="#FF6B6B"
            emissive="#FF3333"
            emissiveIntensity={0.2}
            transparent
            opacity={0.4}
          />
        </mesh>
      </group>
    );
  }

  return (
    <group ref={groupRef}>
      <mesh>
        <torusGeometry args={[0.3, 0.08, 16, 32]} />
        <meshStandardMaterial 
          color="#4ECDC4"
          emissive="#00FFCC"
          emissiveIntensity={0.2}
          transparent
          opacity={0.4}
        />
      </mesh>
    </group>
  );
}

// Empty Cell with hover preview
function EmptyCellWrapper({ 
  isGameOver, 
  isHighlighted, 
  threatPlayer,
  currentPlayer,
  onHover,
  onLeave,
  isHovered,
}: { 
  isGameOver: boolean; 
  isHighlighted: boolean;
  threatPlayer?: Player | null;
  currentPlayer: Player;
  onHover: () => void;
  onLeave: () => void;
  isHovered: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (glowRef.current && (isHighlighted || threatPlayer) && !isGameOver) {
      glowRef.current.rotation.y += 0.01;
      glowRef.current.rotation.x += 0.005;
    }
    
    // Pulse effect for threat cells
    if (meshRef.current && threatPlayer && !isGameOver) {
      const pulse = Math.sin(state.clock.elapsedTime * 3) * 0.1 + 0.9;
      meshRef.current.scale.setScalar(pulse);
    }
  });

  // Determine colors based on state
  let baseColor = '#6366F1';
  let baseOpacity = 0.4;
  
  if (threatPlayer) {
    baseColor = threatPlayer === 'X' ? '#FF6B6B' : '#4ECDC4';
    baseOpacity = 0.6;
  } else if (isHighlighted) {
    baseColor = '#818CF8';
    baseOpacity = 0.7;
  }

  return (
    <group>
      {/* Main clickable sphere */}
      <mesh 
        ref={meshRef}
        onPointerOver={(e) => {
          e.stopPropagation();
          if (!isGameOver) onHover();
          if (meshRef.current && !isGameOver) {
            const material = meshRef.current.material as THREE.MeshStandardMaterial;
            material.color.set('#A5B4FC');
            material.emissive.set('#6366F1');
            material.emissiveIntensity = 0.5;
          }
        }}
        onPointerOut={() => {
          onLeave();
          if (meshRef.current) {
            const material = meshRef.current.material as THREE.MeshStandardMaterial;
            material.color.set(baseColor);
            material.emissive.set(threatPlayer ? baseColor : '#000000');
            material.emissiveIntensity = threatPlayer ? 0.3 : 0;
          }
        }}
      >
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshStandardMaterial 
          color={baseColor}
          emissive={threatPlayer ? baseColor : '#000000'}
          emissiveIntensity={threatPlayer ? 0.3 : 0}
          opacity={baseOpacity}
          transparent
          metalness={0.2}
          roughness={0.5}
        />
      </mesh>

      {/* Outer ring indicator */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.35, 0.4, 32]} />
        <meshBasicMaterial 
          color={threatPlayer ? baseColor : (isHighlighted ? '#A5B4FC' : '#6366F1')}
          opacity={threatPlayer ? 0.7 : (isHighlighted ? 0.6 : 0.3)}
          transparent
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Ghost preview on hover */}
      {isHovered && !isGameOver && (
        <GhostMarker player={currentPlayer} />
      )}

      {/* Corner markers for highlighted/threat cells */}
      {(isHighlighted || threatPlayer) && (
        <group ref={glowRef}>
          {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([x, z], i) => (
            <mesh key={i} position={[x * 0.35, 0, z * 0.35]}>
              <boxGeometry args={[0.08, 0.08, 0.08]} />
              <meshBasicMaterial 
                color={threatPlayer ? baseColor : '#A5B4FC'} 
                opacity={0.8} 
                transparent 
              />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

export default function Cell({
  position,
  worldPosition,
  value,
  isWinning,
  isGameOver,
  onClick,
  isHighlighted = false,
  threatPlayer = null,
  currentPlayer,
  isNewlyPlaced = false,
  isDimmed = false,
  recentlyRemovedPlayer = null,
  recentlyRemovedId = null,
}: CellProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [wasNewlyPlaced, setWasNewlyPlaced] = useState(isNewlyPlaced);

  // Track if this cell was newly placed
  useEffect(() => {
    if (isNewlyPlaced) {
      setWasNewlyPlaced(true);
    } else if (value === null) {
      // Reset when cell becomes empty (game reset)
      setWasNewlyPlaced(false);
    }
  }, [isNewlyPlaced, value]);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (!value && !isGameOver) {
      onClick(position);
    }
  };

  return (
    <group 
      position={worldPosition}
      onClick={handleClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        if (!value && !isGameOver) {
          document.body.style.cursor = 'pointer';
        }
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'default';
      }}
    >
      {value === null && recentlyRemovedPlayer && recentlyRemovedId !== null && (
        <RemovedMarker
          key={`removed-${position.x}-${position.y}-${position.z}-${recentlyRemovedId}`}
          player={recentlyRemovedPlayer}
          removalId={recentlyRemovedId}
        />
      )}
      {value === null && (
        <EmptyCellWrapper 
          isGameOver={isGameOver} 
          isHighlighted={isHighlighted}
          threatPlayer={threatPlayer}
          currentPlayer={currentPlayer}
          onHover={() => setIsHovered(true)}
          onLeave={() => setIsHovered(false)}
          isHovered={isHovered}
        />
      )}
      {value === 'X' && <XMarker key={`x-${position.x}-${position.y}-${position.z}`} isWinning={isWinning} isNewlyPlaced={wasNewlyPlaced} isDimmed={isDimmed} />}
      {value === 'O' && <OMarker key={`o-${position.x}-${position.y}-${position.z}`} isWinning={isWinning} isNewlyPlaced={wasNewlyPlaced} isDimmed={isDimmed} />}
    </group>
  );
}
