"use client";

import { Edges, Text } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import {
  findActiveSpanIndex,
  type AudiobookAlignmentManifest,
} from "@/lib/audiobookAlignment";

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

const WORDS_PER_BOOK_PAGE = 72;

const PW = 1.5;
const PH = 2.02;
const PD = 0.04;

const TEXT_MARGIN_X = 0.14;
const TEXT_MARGIN_TOP = 0.24;
const TEXT_MARGIN_BOTTOM = 0.16;
const TEXT_FONT_SIZE = 0.046;
const TEXT_LINE_HEIGHT = 1.7;

const UNIT_PLANE_ARGS: [number, number] = [1, 1];

type SpreadRef = {
  pdfPage: number;
  spread: number;
};

function spreadOrder(s: SpreadRef) {
  return s.pdfPage * 10000 + s.spread;
}

type WordRange = { start: number; end: number };

function buildWordRanges(words: string[]): {
  fullText: string;
  ranges: WordRange[];
} {
  const ranges: WordRange[] = [];
  let s = "";
  words.forEach((w, i) => {
    if (i > 0) s += " ";
    const start = s.length;
    s += w;
    ranges.push({ start, end: s.length });
  });
  return { fullText: s, ranges };
}

function PageContent({
  title,
  folio,
  words,
  highlightIdx,
  highlightHex,
  textColor,
}: {
  title?: string | null;
  folio: string | number;
  words: string[];
  highlightIdx: number;
  highlightHex: string;
  textColor: string;
}) {
  const { fullText, ranges } = useMemo(() => buildWordRanges(words), [words]);

  const textRef = useRef<THREE.Mesh | null>(null);
  const lastSyncTextRef = useRef<string>("");
  const [syncToken, setSyncToken] = useState(0);
  const handleSync = useCallback(() => {
    const info = (textRef.current as unknown as {
      textRenderInfo?: { caretPositions?: Float32Array };
    } | null)?.textRenderInfo;
    if (!info?.caretPositions) return;
    if (lastSyncTextRef.current === fullText) return;
    lastSyncTextRef.current = fullText;
    setSyncToken((v) => (v + 1) & 0xffff);
  }, [fullText]);

  const activeBounds = useMemo(() => {
    void syncToken;
    if (highlightIdx < 0 || highlightIdx >= ranges.length) return null;
    const info = (textRef.current as unknown as {
      textRenderInfo?: { caretPositions?: Float32Array };
    } | null)?.textRenderInfo;
    if (!info?.caretPositions) return null;
    const r = ranges[highlightIdx];
    if (r.end <= r.start) return null;
    const cp = info.caretPositions;
    const firstIdx = r.start * 4;
    const lastIdx = (r.end - 1) * 4;
    if (lastIdx + 3 >= cp.length || firstIdx < 0) return null;
    const x1 = cp[firstIdx]!;
    const bottomFirst = cp[firstIdx + 2]!;
    const topFirst = cp[firstIdx + 3]!;
    const x2 = cp[lastIdx + 1]!;
    const topLast = cp[lastIdx + 3]!;
    if (Math.abs(topFirst - topLast) > 0.001) return null;
    const width = x2 - x1;
    const height = topFirst - bottomFirst;
    if (!isFinite(width) || !isFinite(height) || width <= 0 || height <= 0) {
      return null;
    }
    return {
      x: (x1 + x2) / 2,
      y: (topFirst + bottomFirst) / 2,
      w: width,
      h: height,
    };
  }, [highlightIdx, ranges, syncToken]);

  const surfaceZ = PD / 2 + 0.002;
  const bodyMaxWidth = PW - TEXT_MARGIN_X * 2;
  const xLeft = -PW / 2 + TEXT_MARGIN_X;
  const xRight = PW / 2 - TEXT_MARGIN_X;
  const yTop = PH / 2 - TEXT_MARGIN_TOP;
  const yBottom = -PH / 2 + TEXT_MARGIN_BOTTOM;

  return (
    <group>
      {title != null ? (
        <Text
          anchorX="left"
          anchorY="top"
          position={[xLeft, PH / 2 - 0.1, surfaceZ]}
          color={textColor}
          fontSize={0.044}
          letterSpacing={0.04}
          sdfGlyphSize={64}
          outlineWidth={0}
          strokeWidth={0}
          fillOpacity={4}
        >
          {title.toUpperCase()}
        </Text>
      ) : null}

      <group position={[xLeft, yTop, surfaceZ]}>
        <Text
          ref={textRef as unknown as React.Ref<THREE.Mesh>}
          anchorX="left"
          anchorY="top"
          fontSize={TEXT_FONT_SIZE}
          maxWidth={bodyMaxWidth}
          lineHeight={TEXT_LINE_HEIGHT}
          textAlign="justify"
          color={textColor}
          sdfGlyphSize={64}
          letterSpacing={0}
          outlineWidth={0}
          strokeWidth={0}
          fillOpacity={1}
          overflowWrap="break-word"
          renderOrder={2}
          onSync={handleSync}
        >
          {fullText}
        </Text>
        {activeBounds ? (
          <mesh
            position={[activeBounds.x, activeBounds.y, -0.0015]}
            scale={[activeBounds.w + 0.018, activeBounds.h * 0.95, 1]}
            renderOrder={1}
          >
            <planeGeometry args={UNIT_PLANE_ARGS} />
            <meshBasicMaterial
              color={highlightHex}
              transparent
              opacity={0.85}
              depthWrite={false}
              depthTest={false}
              toneMapped={false}
            />
          </mesh>
        ) : null}
      </group>

      <Text
        anchorX="right"
        anchorY="middle"
        position={[xRight, yBottom, surfaceZ]}
        color={textColor}
        fontSize={0.038}
        sdfGlyphSize={64}
        outlineWidth={0}
        strokeWidth={0}
        fillOpacity={1}
      >
        {String(folio)}
      </Text>
    </group>
  );
}

function InkedBox({
  args,
  color,
  position,
  rotation,
  edgeOpacity = 0.18,
}: {
  args: [number, number, number];
  color: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  edgeOpacity?: number;
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={args} />
      <meshStandardMaterial color={color} roughness={0.85} metalness={0} />
      <Edges color={`rgba(70, 70, 70, ${Math.min(edgeOpacity, 0.3)})`} />
    </mesh>
  );
}

type BookSceneProps = {
  alignment: AudiobookAlignmentManifest;
  timeMs: number;
  highlightHex: string;
  textColor: string;
  pageColor: string;
  zoomScale: number;
  isMobile: boolean;
};

function BookScene({
  alignment,
  timeMs,
  highlightHex,
  textColor,
  pageColor,
  zoomScale,
  isMobile,
}: BookSceneProps) {
  const rootRef = useRef<THREE.Group>(null);
  const rightPivotRef = useRef<THREE.Group>(null);
  const leftPivotRef = useRef<THREE.Group>(null);

  const wordsPerSpread = WORDS_PER_BOOK_PAGE * (isMobile ? 1 : 2);

  const activeSpanIndex = useMemo(() => {
    if (!alignment.spans.length) return -1;
    return findActiveSpanIndex(alignment.spans, timeMs);
  }, [alignment, timeMs]);

  const activePdfPage = useMemo(() => {
    const s = alignment.spans[activeSpanIndex];
    return s ? s.page : -1;
  }, [alignment, activeSpanIndex]);

  const activeIdx = useMemo(() => {
    const s = alignment.spans[activeSpanIndex];
    return s ? s.idx : -1;
  }, [alignment, activeSpanIndex]);

  const activeSpread = useMemo(() => {
    if (activeIdx < 0) return -1;
    return Math.floor(activeIdx / wordsPerSpread);
  }, [activeIdx, wordsPerSpread]);

  const [displayedSpread, setDisplayedSpread] = useState<SpreadRef | null>(null);

  const flipRef = useRef(0);
  const flipDirRef = useRef<1 | -1>(1);
  const flipTargetRef = useRef<SpreadRef | null>(null);
  const swappedMidRef = useRef(false);

  const display = useMemo(() => {
    if (!displayedSpread) {
      return {
        leftWords: [] as string[],
        rightWords: [] as string[],
        leftStart: 0,
        rightStart: 0,
        leftFolio: "—" as string | number,
        rightFolio: "—" as string | number,
      };
    }
    const words = alignment.pages[String(displayedSpread.pdfPage)]?.words ?? [];
    const start = displayedSpread.spread * wordsPerSpread;
    const leftStart = start;
    const rightStart = start + WORDS_PER_BOOK_PAGE;
    const left = words.slice(leftStart, rightStart);
    const right = isMobile
      ? []
      : words.slice(rightStart, rightStart + WORDS_PER_BOOK_PAGE);
    return {
      leftWords: left,
      rightWords: right,
      leftStart,
      rightStart,
      leftFolio: isMobile ? displayedSpread.spread + 1 : displayedSpread.spread * 2 + 1,
      rightFolio: displayedSpread.spread * 2 + 2,
    };
  }, [alignment, displayedSpread, isMobile, wordsPerSpread]);

  const { leftHi, rightHi } = useMemo(() => {
    if (
      !displayedSpread ||
      activePdfPage !== displayedSpread.pdfPage ||
      activeSpread !== displayedSpread.spread
    ) {
      return { leftHi: -1, rightHi: -1 };
    }
    const { leftStart, rightStart } = display;
    const lHi =
      activeIdx >= leftStart && activeIdx < rightStart
        ? activeIdx - leftStart
        : -1;
    const rHi =
      activeIdx >= rightStart && activeIdx < rightStart + WORDS_PER_BOOK_PAGE
        ? activeIdx - rightStart
        : -1;
    return { leftHi: lHi, rightHi: rHi };
  }, [activeIdx, activePdfPage, activeSpread, displayedSpread, display]);

  const { leftWords, rightWords, leftFolio, rightFolio } = display;

  useEffect(() => {
    if (activePdfPage < 0 || activeSpread < 0) return;

    if (!displayedSpread) {
      setDisplayedSpread({ pdfPage: activePdfPage, spread: activeSpread });
      return;
    }

    const next: SpreadRef = { pdfPage: activePdfPage, spread: activeSpread };
    const displayedOrder = spreadOrder(displayedSpread);
    const nextOrder = spreadOrder(next);

    if (nextOrder === displayedOrder) return;

    const resetPivots = () => {
      if (rightPivotRef.current) rightPivotRef.current.rotation.y = 0;
      if (leftPivotRef.current) leftPivotRef.current.rotation.y = 0;
    };

    if (nextOrder < displayedOrder - 1 || nextOrder > displayedOrder + 1) {
      setDisplayedSpread(next);
      flipRef.current = 0;
      swappedMidRef.current = false;
      flipTargetRef.current = null;
      resetPivots();
      return;
    }

    if (flipRef.current === 0) {
      flipRef.current = 0.001;
      flipDirRef.current = nextOrder > displayedOrder ? 1 : -1;
      flipTargetRef.current = next;
      swappedMidRef.current = false;
    }
  }, [activePdfPage, activeSpread, displayedSpread]);

  useFrame((_, dt) => {
    if (rootRef.current) {
      rootRef.current.rotation.y = THREE.MathUtils.lerp(
        rootRef.current.rotation.y,
        -0.08,
        0.06,
      );
    }

    if (flipRef.current > 0 && flipRef.current < 1) {
      flipRef.current = Math.min(1, flipRef.current + dt * 1.05);
      const t = easeInOutCubic(flipRef.current);
      const angle = t * Math.PI * 0.92;
      const dir = flipDirRef.current;

      if (dir === 1) {
        if (rightPivotRef.current) rightPivotRef.current.rotation.y = -angle;
        if (leftPivotRef.current) leftPivotRef.current.rotation.y = 0;
      } else {
        if (leftPivotRef.current) leftPivotRef.current.rotation.y = angle;
        if (rightPivotRef.current) rightPivotRef.current.rotation.y = 0;
      }

      if (flipRef.current >= 0.48 && !swappedMidRef.current && flipTargetRef.current != null) {
        swappedMidRef.current = true;
        setDisplayedSpread(flipTargetRef.current);
      }

      if (flipRef.current >= 1) {
        flipRef.current = 0;
        if (rightPivotRef.current) rightPivotRef.current.rotation.y = 0;
        if (leftPivotRef.current) leftPivotRef.current.rotation.y = 0;
        swappedMidRef.current = false;
        flipTargetRef.current = null;
      }
    }
  });

  const pageLayers = [0, 1, 2, 3];

  if (isMobile) {
    return (
      <group
        ref={rootRef}
        position={[0, 0.03, 0]}
        rotation={[0.04, 0, -0.004]}
        scale={zoomScale}
      >
        <InkedBox
          args={[1.72, 2.28, 0.12]}
          color="#b83b3f"
          position={[0.02, -0.02, -0.18]}
          rotation={[0, 0, -0.012]}
          edgeOpacity={0.85}
        />
        {pageLayers.map((i) => (
          <InkedBox
            key={`mobile-layer-${i}`}
            args={[PW + 0.14 - i * 0.018, PH + 0.12 - i * 0.018, 0.018]}
            color={pageColor}
            position={[0.02 + i * 0.014, -0.02 + i * 0.012, -0.075 + i * 0.024]}
            rotation={[0, -0.025 - i * 0.005, -0.025 + i * 0.01]}
            edgeOpacity={0.64}
          />
        ))}
        <group ref={rightPivotRef} position={[-PW / 2, 0.04, 0.05]}>
          <group position={[PW / 2, 0, 0]} rotation={[0, -0.04, -0.006]}>
            <InkedBox
              args={[PW, PH, PD]}
              color={pageColor}
              position={[0, 0, 0]}
              edgeOpacity={0.9}
            />
            <PageContent
              title={displayedSpread ? `Page ${displayedSpread.pdfPage}` : "—"}
              folio={leftFolio}
              words={leftWords}
              highlightIdx={leftHi}
              highlightHex={highlightHex}
              textColor={textColor}
            />
          </group>
        </group>
      </group>
    );
  }

  return (
    <group
      ref={rootRef}
      position={[0, 0.04, 0]}
      rotation={[0.06, 0, -0.005]}
      scale={zoomScale}
    >
      <InkedBox
        args={[3.35, 0.12, 0.24]}
        color="#7d4d35"
        position={[0, -PH / 2 - 0.24, -0.34]}
        rotation={[0, 0, 0]}
        edgeOpacity={0.7}
      />
      <InkedBox
        args={[0.12, 1.42, 0.16]}
        color="#7d4d35"
        position={[-1.24, -0.3, -0.43]}
        rotation={[0.34, 0, -0.2]}
        edgeOpacity={0.55}
      />
      <InkedBox
        args={[0.12, 1.42, 0.16]}
        color="#7d4d35"
        position={[1.24, -0.3, -0.43]}
        rotation={[0.34, 0, 0.2]}
        edgeOpacity={0.55}
      />

      <InkedBox
        args={[3.18, 2.28, 0.12]}
        color="#b83b3f"
        position={[0.02, -0.02, -0.18]}
        rotation={[0, 0, -0.012]}
        edgeOpacity={0.85}
      />

      <InkedBox
        args={[3.0, 2.12, 0.055]}
        color={pageColor}
        position={[0, -0.005, -0.105]}
        rotation={[0, 0, 0.018]}
        edgeOpacity={0.62}
      />

      {pageLayers.map((i) => (
        <group key={`layer-${i}`} position={[0, 0, -0.075 + i * 0.024]}>
          <InkedBox
            args={[PW + 0.16 - i * 0.018, PH + 0.12 - i * 0.018, 0.018]}
            color={pageColor}
            position={[-PW / 2 - 0.03 - i * 0.018, -0.02 + i * 0.012, 0]}
            rotation={[0, 0.025 + i * 0.005, 0.035 - i * 0.012]}
            edgeOpacity={0.64}
          />
          <InkedBox
            args={[PW + 0.16 - i * 0.018, PH + 0.12 - i * 0.018, 0.018]}
            color={pageColor}
            position={[PW / 2 + 0.03 + i * 0.018, -0.02 + i * 0.012, 0]}
            rotation={[0, -0.025 - i * 0.005, -0.035 + i * 0.012]}
            edgeOpacity={0.64}
          />
        </group>
      ))}

      <InkedBox
        args={[0.16, 0.16, 0.06]}
        color="#b83b3f"
        position={[0, PH / 2 + 0.11, 0.03]}
        rotation={[0, 0, 0]}
        edgeOpacity={0.75}
      />
      <InkedBox
        args={[0.16, 0.16, 0.06]}
        color="#b83b3f"
        position={[0, -PH / 2 - 0.11, 0.03]}
        rotation={[0, 0, 0]}
        edgeOpacity={0.75}
      />

      <group ref={leftPivotRef} position={[0, 0.04, 0.05]}>
        <group position={[-PW / 2 + 0.02, 0, 0]} rotation={[0, 0.08, 0.01]}>
          <InkedBox
            args={[PW, PH, PD]}
            color={pageColor}
            position={[0, 0, 0]}
            edgeOpacity={0.9}
          />
          <PageContent
            title={displayedSpread ? `Page ${displayedSpread.pdfPage}` : "—"}
            folio={leftFolio}
            words={leftWords}
            highlightIdx={leftHi}
            highlightHex={highlightHex}
            textColor={textColor}
          />
        </group>
      </group>

      <InkedBox
        args={[0.07, PH * 1.02, 0.075]}
        color="#b8b0a3"
        position={[0, 0.04, 0.055]}
        edgeOpacity={0.7}
      />

      <group ref={rightPivotRef} position={[0, 0.04, 0.05]}>
        <group position={[PW / 2 - 0.02, 0, 0]} rotation={[0, -0.08, -0.01]}>
          <InkedBox
            args={[PW, PH, PD]}
            color={pageColor}
            position={[0, 0, 0]}
            edgeOpacity={0.9}
          />
          <PageContent
            title={displayedSpread ? undefined : "—"}
            folio={rightFolio}
            words={rightWords}
            highlightIdx={rightHi}
            highlightHex={highlightHex}
            textColor={textColor}
          />
        </group>
      </group>
    </group>
  );
}

type Props = {
  alignment: AudiobookAlignmentManifest;
  timeMs: number;
  highlightHex: string;
  textColor: string;
  pageColor: string;
  roomBgColor: string;
  zoomScale: number;
};

function readIsMobile() {
  return typeof window !== "undefined"
    ? window.matchMedia("(max-width: 1023px)").matches
    : false;
}

export function AudiobookBook3D({
  alignment,
  timeMs,
  highlightHex,
  textColor,
  pageColor,
  roomBgColor,
  zoomScale,
}: Props) {
  const [isMobile, setIsMobile] = useState(readIsMobile);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const [canvasKey, setCanvasKey] = useState(0);

  const onCreated = useCallback(({ gl }: { gl: THREE.WebGLRenderer }) => {
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFShadowMap;

    const canvas = gl.domElement;
    let restoreTimer: number | null = null;

    const onLost = (e: Event) => {
      e.preventDefault();
      console.warn("[AudiobookBook3D] WebGL context lost — awaiting restore");
      restoreTimer = window.setTimeout(() => {
        console.warn("[AudiobookBook3D] context not restored — remounting");
        setCanvasKey((k) => k + 1);
      }, 1500);
    };
    const onRestored = () => {
      if (restoreTimer != null) {
        window.clearTimeout(restoreTimer);
        restoreTimer = null;
      }
      console.warn("[AudiobookBook3D] WebGL context restored");
    };
    canvas.addEventListener("webglcontextlost", onLost as EventListener, false);
    canvas.addEventListener(
      "webglcontextrestored",
      onRestored as EventListener,
      false,
    );
  }, []);

  return (
    <div
      className="h-full min-h-0 w-full overflow-hidden"
      style={{ backgroundColor: roomBgColor }}
    >
      <Canvas
        key={canvasKey}
        className="block h-full w-full"
        camera={{ position: [0, 0.42, 3.66], fov: 32, near: 0.4, far: 24 }}
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: "default",
          stencil: false,
          depth: true,
          preserveDrawingBuffer: false,
        }}
        dpr={[1, 1.5]}
        shadows
        onCreated={onCreated}
      >
        <color attach="background" args={[roomBgColor]} />
        <fog attach="fog" args={[roomBgColor, 40, 80]} />

        <ambientLight intensity={1.15} />
        <directionalLight
          castShadow
          position={[3.8, 7.5, 4.5]}
          intensity={1.05}
          color="#ffffff"
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-far={20}
          shadow-camera-left={-4}
          shadow-camera-right={4}
          shadow-camera-top={4}
          shadow-camera-bottom={-4}
          shadow-bias={-0.00025}
        />
        <directionalLight position={[-3, 4, -2]} intensity={0.35} color="#ffffff" />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.98, 0]} receiveShadow>
          <planeGeometry args={[24, 24]} />
          <meshStandardMaterial color={roomBgColor} roughness={1} metalness={0} />
        </mesh>

        <BookScene
          alignment={alignment}
          timeMs={timeMs}
          highlightHex={highlightHex}
          textColor={textColor}
          pageColor={pageColor}
          zoomScale={zoomScale}
          isMobile={isMobile}
        />
      </Canvas>
    </div>
  );
}
