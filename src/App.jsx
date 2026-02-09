import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Physics,
  RigidBody,
  CuboidCollider,
  BallCollider,
  useRapier,
} from "@react-three/rapier";

/**
 * Tofu64: a small retro-feeling 3D platformer starter.
 *
 * Controls:
 *  - WASD / Arrow keys: move
 *  - Space: jump
 *  - R: reset to spawn
 *
 * Note:
 * Some sandbox/preview renderers can evaluate components in an SSR-like pass.
 * This file avoids referencing browser-only globals except inside guarded effects.
 */

function makeDefaultKeys() {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
    jump: false,
    reset: false,
  };
}

function safeSetKey(keysObj, code, isDown) {
  // Defensive: in some environments, key events can be proxied/partial.
  if (!keysObj || typeof code !== "string") return;

  if (code === "KeyW" || code === "ArrowUp") keysObj.up = isDown;
  if (code === "KeyS" || code === "ArrowDown") keysObj.down = isDown;
  if (code === "KeyA" || code === "ArrowLeft") keysObj.left = isDown;
  if (code === "KeyD" || code === "ArrowRight") keysObj.right = isDown;
  if (code === "Space") keysObj.jump = isDown;
  if (code === "KeyR") keysObj.reset = isDown;
}

function useKeys() {
  // Keep the mutable object stable across renders.
  // Some sandboxes can produce confusing stack traces; ensure .current is ALWAYS defined.
  const keysRef = useRef(null);
  if (keysRef.current == null) keysRef.current = makeDefaultKeys();

  useEffect(() => {
    // Guard against SSR / pre-render passes.
    if (typeof window === "undefined") return;

    const onKeyDown = (e) => {
      const code = e?.code;
      if (
        code === "ArrowUp" ||
        code === "ArrowDown" ||
        code === "ArrowLeft" ||
        code === "ArrowRight" ||
        code === "Space"
      ) {
        e.preventDefault();
      }
      safeSetKey(keysRef.current, code, true);
    };

    const onKeyUp = (e) => {
      const code = e?.code;
      if (
        code === "ArrowUp" ||
        code === "ArrowDown" ||
        code === "ArrowLeft" ||
        code === "ArrowRight" ||
        code === "Space"
      ) {
        e.preventDefault();
      }
      safeSetKey(keysRef.current, code, false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  return keysRef;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function HUD({ collected, total, win, hint, escaped, exitOpen }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        fontFamily:
          "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
        color: "#e6f4ff",
        textShadow: "0 2px 0 rgba(0,0,0,0.55)",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 16,
          top: 14,
          display: "flex",
          gap: 12,
          alignItems: "center",
        }}
      >
        <div
          style={{
            background: "rgba(0,0,0,0.40)",
            border: "1px solid rgba(255,255,255,0.18)",
            padding: "8px 10px",
            borderRadius: 10,
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.95 }}>TOFU64: FRIDGE LEVEL</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>
            Edamame: <b>{collected}</b> / {total}
          </div>
        </div>

        <div
          style={{
            background: "rgba(0,0,0,0.40)",
            border: "1px solid rgba(255,255,255,0.18)",
            padding: "8px 10px",
            borderRadius: 10,
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.95 }}>Exit status</div>
          <div style={{ fontSize: 12, opacity: 0.95, marginTop: 6 }}>
            {exitOpen ? "Fridge door unlocked." : "Find all edamame."}
          </div>
        </div>

        <div
          style={{
            background: "rgba(0,0,0,0.40)",
            border: "1px solid rgba(255,255,255,0.18)",
            padding: "8px 10px",
            borderRadius: 10,
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.95 }}>Controls</div>
          <div style={{ fontSize: 12, opacity: 0.95, marginTop: 6 }}>
            Move: WASD / Arrows
            <br />
            Jump: Space
            <br />
            Reset: R
          </div>
        </div>
      </div>

      {hint ? (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 18,
            transform: "translateX(-50%)",
            background: "rgba(0,0,0,0.45)",
            border: "1px solid rgba(255,255,255,0.18)",
            padding: "8px 10px",
            borderRadius: 10,
            fontSize: 12,
            opacity: 0.95,
          }}
        >
          {hint}
        </div>
      ) : null}

      {win ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
          }}
        >
          <div
            style={{
              pointerEvents: "none",
              background: "rgba(0,0,0,0.55)",
              border: "1px solid rgba(255,255,255,0.20)",
              padding: "18px 18px",
              borderRadius: 14,
              textAlign: "center",
              maxWidth: 520,
            }}
          >
            <div style={{ fontSize: 18, letterSpacing: 0.3 }}>
              YOU RAIDED THE FRIDGE
            </div>
            <div style={{ fontSize: 13, opacity: 0.95, marginTop: 10 }}>
              {escaped
                ? "You escaped with the tofu haul."
                : "You collected all edamame."}
              <br />
              Press <b>R</b> to run it back.
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RetroOverlay() {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        background:
          "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px)",
        backgroundSize: "100% 3px",
        mixBlendMode: "soft-light",
        opacity: 0.5,
      }}
    />
  );
}

function FridgeLighting() {
  return (
    <>
      <ambientLight intensity={0.48} />
      {/* Fridge bulb */}
      <pointLight
        castShadow
        position={[0, 7.2, -7.5]}
        intensity={55}
        distance={28}
      />
      <pointLight
        castShadow
        position={[5.5, 5.0, -1]}
        intensity={12}
        distance={18}
      />
      <pointLight
        castShadow
        position={[-5.5, 5.0, -1]}
        intensity={12}
        distance={18}
      />
      <directionalLight
        castShadow
        position={[6, 10, 8]}
        intensity={0.6}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={1}
        shadow-camera-far={30}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
      />
    </>
  );
}

function FridgeBackdrop() {
  // Low-poly, N64-ish fog
  const { scene } = useThree();
  useEffect(() => {
    scene.fog = new THREE.Fog(new THREE.Color("#cfe6ff"), 10, 55);
    scene.background = new THREE.Color("#bfe0ff");
    return () => {
      scene.fog = null;
    };
  }, [scene]);
  return null;
}

function StaticBlock({
  pos,
  size,
  color = "#d9dde3",
  roughness = 0.95,
  metalness = 0.05,
}) {
  return (
    <RigidBody type="fixed" position={pos} colliders={false}>
      <CuboidCollider args={[size[0] / 2, size[1] / 2, size[2] / 2]} />
      <mesh castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={color}
          roughness={roughness}
          metalness={metalness}
        />
      </mesh>
    </RigidBody>
  );
}

function Shelf({ pos, w = 10.8, d = 6.8, t = 0.45 }) {
  return (
    <group>
      {/* Shelf slab */}
      <StaticBlock pos={pos} size={[w, t, d]} color="#e8eef5" roughness={0.6} />
      {/* Lip */}
      <StaticBlock
        pos={[pos[0], pos[1] + 0.25, pos[2] + d / 2 - 0.2]}
        size={[w, 0.35, 0.35]}
        color="#f5fbff"
        roughness={0.45}
      />
    </group>
  );
}

function Collectible({ id, position, onCollect, disabled }) {
  const ref = useRef(null);
  const [spin] = useState(() => Math.random() * Math.PI * 2);

  useFrame((state, dt) => {
    if (!ref.current || disabled) return;
    ref.current.rotation.y += dt * 2.1;
    const t = state.clock.elapsedTime;
    ref.current.position.y = position[1] + Math.sin(t * 2.2 + spin) * 0.12;
  });

  return (
    <RigidBody type="fixed" colliders={false} position={position}>
      <BallCollider
        args={[0.38]}
        sensor
        onIntersectionEnter={() => {
          if (!disabled) onCollect(id);
        }}
      />
      <mesh ref={ref}>
        <torusGeometry args={[0.32, 0.12, 10, 18]} />
        <meshStandardMaterial
          color="#3cff75"
          roughness={0.25}
          metalness={0.15}
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.15, 10, 10]} />
        <meshStandardMaterial
          color="#b8ffca"
          roughness={0.3}
          metalness={0.1}
        />
      </mesh>
    </RigidBody>
  );
}

function ExitPortal({ open, onExit }) {
  const ringRef = useRef(null);
  const [spin] = useState(() => Math.random() * Math.PI * 2);

  useFrame((state, dt) => {
    if (!ringRef.current) return;
    ringRef.current.rotation.y += dt * 0.8;
    const t = state.clock.elapsedTime;
    ringRef.current.position.y = 6.5 + Math.sin(t * 1.6 + spin) * 0.15;
  });

  return (
    <RigidBody type="fixed" position={[0, 6.5, 8.1]} colliders={false}>
      <CuboidCollider
        args={[1.1, 1.6, 0.6]}
        sensor
        onIntersectionEnter={() => {
          if (open) onExit();
        }}
      />
      <group ref={ringRef}>
        <mesh>
          <torusGeometry args={[1.1, 0.18, 12, 24]} />
          <meshStandardMaterial
            color={open ? "#ffd35c" : "#8aa6c8"}
            emissive={open ? "#ffb93f" : "#2f3a4a"}
            emissiveIntensity={open ? 0.8 : 0.15}
            roughness={0.3}
            metalness={0.3}
          />
        </mesh>
        <mesh>
          <circleGeometry args={[0.9, 24]} />
          <meshStandardMaterial
            color={open ? "#ffe8a1" : "#d2e4f5"}
            opacity={open ? 0.5 : 0.2}
            transparent
          />
        </mesh>
      </group>
    </RigidBody>
  );
}

function FridgeLevel({ onCollect, collectedSet }) {
  const collectibles = useMemo(
    () => [
      { id: 1, p: [0.0, 1.2, 3.1] },
      { id: 2, p: [3.6, 1.2, 2.6] },
      { id: 3, p: [-3.8, 1.2, 1.8] },
      { id: 4, p: [4.8, 3.2, -2.8] },
      { id: 5, p: [-4.6, 3.2, -2.2] },
      { id: 6, p: [0.0, 5.2, -2.5] },
      { id: 7, p: [3.8, 5.2, -5.8] },
      { id: 8, p: [-3.8, 5.2, -5.8] },
      { id: 9, p: [0.0, 7.2, -6.8] },
      { id: 10, p: [0.0, 3.2, 5.3] },
    ],
    []
  );

  return (
    <group>
      {/* The fridge interior shell */}
      <StaticBlock
        pos={[0, -1.2, 0]}
        size={[16, 1.8, 20]}
        color="#e9f3ff"
        roughness={0.65}
      />
      <StaticBlock
        pos={[0, 5.0, -10]}
        size={[16, 14, 1]}
        color="#d9e7f5"
        roughness={0.6}
      />
      <StaticBlock
        pos={[0, 5.0, 10]}
        size={[16, 14, 1]}
        color="#d9e7f5"
        roughness={0.6}
      />
      <StaticBlock
        pos={[8, 5.0, 0]}
        size={[1, 14, 20]}
        color="#d9e7f5"
        roughness={0.6}
      />
      <StaticBlock
        pos={[-8, 5.0, 0]}
        size={[1, 14, 20]}
        color="#d9e7f5"
        roughness={0.6}
      />
      <StaticBlock
        pos={[0, 12.0, 0]}
        size={[16, 1, 20]}
        color="#d9e7f5"
        roughness={0.6}
      />

      {/* Condensation details */}
      <StaticBlock
        pos={[0, 0.05, -7.6]}
        size={[12.5, 0.12, 1.2]}
        color="#f7fbff"
        roughness={0.35}
      />

      {/* Spawn pad */}
      <mesh position={[0, 0.2, 6.5]} receiveShadow>
        <cylinderGeometry args={[1.6, 1.8, 0.25, 12]} />
        <meshStandardMaterial color="#c5f6ff" roughness={0.2} />
      </mesh>

      {/* Shelves (platforms) */}
      <Shelf pos={[0, 0.95, 3.6]} />
      <Shelf pos={[0, 2.95, -2.4]} />
      <Shelf pos={[0, 4.95, -6.0]} />
      <Shelf pos={[0, 6.95, -7.4]} w={9.6} d={4.6} />

      {/* A few chunky "food" obstacles */}
      <StaticBlock
        pos={[5.2, 1.45, 4.5]}
        size={[1.4, 1.0, 1.4]}
        color="#ff7aa2"
        roughness={0.5}
      />
      <StaticBlock
        pos={[-5.0, 1.55, 4.0]}
        size={[1.2, 1.2, 1.2]}
        color="#ffd24a"
        roughness={0.5}
      />
      <StaticBlock
        pos={[0.0, 3.55, 1.0]}
        size={[2.2, 1.3, 1.0]}
        color="#86c6ff"
        roughness={0.45}
      />

      {/* Ice tray "stairs" */}
      <StaticBlock
        pos={[6.2, 1.0, -4.0]}
        size={[2.0, 0.6, 3.4]}
        color="#e6fbff"
        roughness={0.15}
        metalness={0.05}
      />
      <StaticBlock
        pos={[6.2, 1.7, -5.2]}
        size={[1.6, 0.6, 1.2]}
        color="#e6fbff"
        roughness={0.15}
      />
      <StaticBlock
        pos={[6.2, 2.4, -6.0]}
        size={[1.2, 0.6, 1.2]}
        color="#e6fbff"
        roughness={0.15}
      />

      {/* Door frame hint, purely visual */}
      <mesh position={[0, 5.0, 9.15]} receiveShadow>
        <boxGeometry args={[14.8, 12.5, 0.2]} />
        <meshStandardMaterial color="#a5c9f0" roughness={0.55} />
      </mesh>

      {/* Collectibles */}
      {collectibles.map((c) => (
        <Collectible
          key={c.id}
          id={c.id}
          position={c.p}
          onCollect={onCollect}
          disabled={collectedSet.has(c.id)}
        />
      ))}
    </group>
  );
}

function TofuAvatar({ bodyRef }) {
  return (
    <RigidBody
      ref={bodyRef}
      colliders={false}
      position={[0, 1.9, 6.5]}
      linearDamping={2.2}
      angularDamping={4.0}
      friction={0.9}
      restitution={0.0}
      canSleep={false}
    >
      <CuboidCollider args={[0.52, 0.52, 0.52]} />
      <group>
        <mesh castShadow>
          <boxGeometry args={[1.05, 1.05, 1.05]} />
          <meshStandardMaterial
            color="#f3e7c9"
            roughness={0.85}
            metalness={0.0}
          />
        </mesh>

        {/* Tiny face */}
        <mesh position={[0, 0.08, 0.55]}>
          <boxGeometry args={[0.82, 0.38, 0.02]} />
          <meshStandardMaterial color="#2b2b2b" roughness={1} />
        </mesh>
        <mesh position={[-0.22, 0.08, 0.565]}>
          <boxGeometry args={[0.14, 0.12, 0.03]} />
          <meshStandardMaterial color="#f3e7c9" roughness={1} />
        </mesh>
        <mesh position={[0.22, 0.08, 0.565]}>
          <boxGeometry args={[0.14, 0.12, 0.03]} />
          <meshStandardMaterial color="#f3e7c9" roughness={1} />
        </mesh>
        <mesh position={[0, -0.08, 0.565]}>
          <boxGeometry args={[0.2, 0.06, 0.03]} />
          <meshStandardMaterial color="#f3e7c9" roughness={1} />
        </mesh>
      </group>
    </RigidBody>
  );
}

function PlayerController({ bodyRef, keysRef, onHint, onReset }) {
  const { world } = useRapier();
  const { camera } = useThree();
  const jumpCooldown = useRef(0);
  const camVel = useRef(new THREE.Vector3());

  const tmpVec = useMemo(() => new THREE.Vector3(), []);
  const tmpVec2 = useMemo(() => new THREE.Vector3(), []);
  const tmpQuat = useMemo(() => new THREE.Quaternion(), []);

  useFrame((state, dt) => {
    // In some sandbox/preload states, Rapier may not be fully ready on the first frame.
    if (!world) return;

    const body = bodyRef.current;
    if (!body) return;

    const k = keysRef?.current || makeDefaultKeys();

    // Reset
    if (k.reset) {
      k.reset = false;
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      body.setTranslation({ x: 0, y: 1.9, z: 6.5 }, true);
      onHint("Reset.");
      onReset();
    }

    const p = body.translation();
    const v = body.linvel();

    // Respawn if you fall out
    if (p.y < -6) {
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setTranslation({ x: 0, y: 1.9, z: 6.5 }, true);
      onHint("You slipped. Back to spawn.");
      return;
    }

    // Ground check via raycast
    const rayOrigin = { x: p.x, y: p.y - 0.52, z: p.z };
    const hit = world.castRay(
      {
        origin: rayOrigin,
        dir: { x: 0, y: -1, z: 0 },
      },
      0.14,
      true
    );

    const grounded = !!hit;

    // Movement input
    const moveX = (k.right ? 1 : 0) - (k.left ? 1 : 0);
    const moveZ = (k.down ? 1 : 0) - (k.up ? 1 : 0);

    // Camera-relative movement (use camera yaw only).
    tmpVec.set(0, 0, -1);
    tmpQuat.setFromEuler(new THREE.Euler(0, camera.rotation.y, 0));
    tmpVec.applyQuaternion(tmpQuat);

    const forward = tmpVec2.copy(tmpVec).setY(0).normalize();
    const right = tmpVec2.set(-forward.z, 0, forward.x).normalize();

    const wish = new THREE.Vector3();
    wish
      .addScaledVector(right, moveX)
      .addScaledVector(forward, -moveZ)
      .normalize();

    // Platformer tuning
    const maxSpeed = grounded ? 7.0 : 6.2;
    const accel = grounded ? 45 : 18;

    const targetVX = wish.x * maxSpeed;
    const targetVZ = wish.z * maxSpeed;

    // Smoothly accelerate toward target velocity
    const newVX = lerp(v.x, targetVX, clamp(accel * dt, 0, 1));
    const newVZ = lerp(v.z, targetVZ, clamp(accel * dt, 0, 1));

    body.setLinvel({ x: newVX, y: v.y, z: newVZ }, true);

    // Jump
    jumpCooldown.current = Math.max(0, jumpCooldown.current - dt);
    if (k.jump && grounded && jumpCooldown.current <= 0) {
      jumpCooldown.current = 0.18;
      body.setLinvel({ x: newVX, y: 7.6, z: newVZ }, true);
    }

    // Turn tofu to face movement
    const facing = Math.atan2(newVX, newVZ);
    if (Math.abs(newVX) + Math.abs(newVZ) > 0.2) {
      body.setRotation(
        {
          x: 0,
          y: Math.sin(facing / 2),
          z: 0,
          w: Math.cos(facing / 2),
        },
        true
      );
    }

    // Camera chase
    const desired = new THREE.Vector3(p.x, p.y, p.z).add(
      new THREE.Vector3(0, 3.8, 8.6)
    );
    desired.z = clamp(desired.z, -8.8, 14);

    const camPos = camera.position;
    camVel.current.lerp(desired.sub(camPos), clamp(6.5 * dt, 0, 1));
    camPos.addScaledVector(camVel.current, clamp(8.0 * dt, 0, 1));

    camera.lookAt(new THREE.Vector3(p.x, p.y + 1.1, p.z));

    // Context hints
    if (p.z > 8.4) onHint("You are near the fridge door.");
    else if (p.y > 6.3) onHint("Top shelf. Nice.");
    else if (grounded) onHint("");
  });

  return null;
}

// "Test cases" (minimal runtime assertions)
// These run once on mount and will throw in dev if the keys object is malformed.
function useDevAssertions(keysRef) {
  useEffect(() => {
    // Guard SSR
    if (typeof window === "undefined") return;

    const k = keysRef?.current;
    if (!k) {
      throw new Error("Keys ref is missing: expected keysRef.current to exist.");
    }

    const required = ["up", "down", "left", "right", "jump", "reset"];
    for (const key of required) {
      if (typeof k[key] !== "boolean") {
        throw new Error(
          `Keys ref invalid: expected keysRef.current.${key} to be boolean.`
        );
      }
    }
  }, [keysRef]);
}

export default function App() {
  const keys = useKeys();
  const bodyRef = useRef(null);

  // Minimal runtime assertions to catch sandbox weirdness early.
  useDevAssertions(keys);

  const total = 10;
  const [collectedSet, setCollectedSet] = useState(() => new Set());
  const [hint, setHint] = useState("Collect all the edamame.");
  const [escaped, setEscaped] = useState(false);

  const collected = collectedSet.size;
  const exitOpen = collected >= total;
  const win = escaped;

  function onCollect(id) {
    setCollectedSet((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setHint("Nice. Keep going.");
  }

  useEffect(() => {
    if (exitOpen && !escaped) setHint("Head to the glowing exit.");
  }, [exitOpen, escaped]);

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <HUD
        collected={collected}
        total={total}
        win={win}
        hint={hint}
        escaped={escaped}
        exitOpen={exitOpen}
      />
      <RetroOverlay />

      <Canvas
        shadows
        dpr={[1, 1]}
        camera={{ position: [0, 6.5, 14], fov: 55, near: 0.1, far: 120 }}
        gl={{ antialias: false, powerPreference: "high-performance" }}
      >
        <FridgeBackdrop />
        <FridgeLighting />

        <Physics gravity={[0, -22, 0]}>
          <FridgeLevel onCollect={onCollect} collectedSet={collectedSet} />
          <ExitPortal
            open={exitOpen}
            onExit={() => {
              if (!exitOpen) return;
              setEscaped(true);
              setHint("You made it out!");
            }}
          />
          <TofuAvatar bodyRef={bodyRef} />
          <PlayerController
            bodyRef={bodyRef}
            keysRef={keys}
            onHint={(msg) => {
              if (win) return;
              if (typeof msg === "string") setHint(msg);
            }}
            onReset={() => {
              setCollectedSet(new Set());
              setEscaped(false);
              setHint("Collect all the edamame.");
            }}
          />
        </Physics>

        {/* Simple ground shadow receiver, to make depth read better */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.3, 0]}
          receiveShadow
        >
          <planeGeometry args={[80, 80]} />
          <shadowMaterial transparent opacity={0.28} />
        </mesh>
      </Canvas>
    </div>
  );
}
