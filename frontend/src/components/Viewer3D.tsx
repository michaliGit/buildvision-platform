import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Plan, XY } from '../api';
import { KindBadge } from './KindBadge';

export type Discipline = 'architecture' | 'electrical' | 'systems' | 'furniture' | 'structure';

export const DISCIPLINES: { key: Discipline; he: string; color: string }[] = [
  { key: 'architecture', he: 'אדריכלות', color: '#9fb3c8' },
  { key: 'electrical', he: 'חשמל ותקשורת', color: '#fde047' },
  { key: 'systems', he: 'מערכות', color: '#f472b6' },
  { key: 'furniture', he: 'ריהוט', color: '#a78bfa' },
  { key: 'structure', he: 'קונסטרוקציה', color: '#94a3b8' },
];

// vertical order when exploding (index * gap)
const EXPLODE_ORDER: Record<Discipline, number> = { structure: 0, architecture: 1, furniture: 2, electrical: 3, systems: 4 };

const DEFAULT_ACCENT = '#22d3ee';
const ROOM_TINTS = ['#3b4a6b', '#3d5a5a', '#4a3f66', '#5a4a3a', '#3a5a46', '#5a3a4f', '#3a4f5a', '#4f5a3a'];
const C = {
  wall: '#a9bbd0',
  gyps: '#b9a6f5',
  partition: '#64748b',
  window: '#67e8f9',
  door: '#fbbf24',
  entrance: '#34d399',
  column: '#94a3b8',
  furniture: '#7c6fb0',
  elec: '#fde047',
  sys: '#f472b6',
};

interface Mapper {
  /** plan (x, y) cm → three (X, Z) m, centered on bounds; Y up in plan → -Z in three */
  x: (x: number) => number;
  z: (y: number) => number;
  v: (p: XY, h?: number) => THREE.Vector3;
}

function makeMapper(plan: Plan): Mapper {
  const cx = (plan.bounds.minX + plan.bounds.maxX) / 2;
  const cy = (plan.bounds.minY + plan.bounds.maxY) / 2;
  const x = (px: number) => (px - cx) / 100;
  const z = (py: number) => -(py - cy) / 100;
  return { x, z, v: (p, h = 0) => new THREE.Vector3(x(p[0]), h, z(p[1])) };
}

/** Shape in "shape space" (sx, sy) = (X, -Z); rotate -90° about X to lay it on the floor. */
function toShape(m: Mapper, poly: XY[], holes?: XY[][]): THREE.Shape {
  const s = new THREE.Shape(poly.map((p) => new THREE.Vector2(m.x(p[0]), -m.z(p[1]))));
  for (const h of holes ?? []) {
    if (h.length >= 3) s.holes.push(new THREE.Path(h.map((p) => new THREE.Vector2(m.x(p[0]), -m.z(p[1])))));
  }
  return s;
}

function polyArea(pts: XY[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    const [x2, y2] = pts[(i + 1) % pts.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a / 2);
}

function makeLine(points: THREE.Vector3[], color: string, opacity = 1): THREE.Line {
  const g = new THREE.BufferGeometry().setFromPoints(points);
  const mat = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
  return new THREE.Line(g, mat);
}

interface SceneProps {
  plan: Plan;
  wallH: number; // meters, display assumption
  explode: number; // 0..1
  visible: Record<Discipline, boolean>;
  showLabels: boolean;
  selectedRoom: string | null;
  selectedElement: string | null;
  highlight: Set<string>;
  onRoom: (id: string) => void;
  onElement: (id: string) => void;
  labelRefs: MutableRefObject<Map<string, HTMLDivElement>>;
  labelAnchors: { key: string; pos: THREE.Vector3 }[];
  accent: string;
}

function Controls() {
  const { camera, gl } = useThree();
  const ref = useRef<OrbitControls | null>(null);
  useEffect(() => {
    const c = new OrbitControls(camera, gl.domElement);
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.maxPolarAngle = Math.PI / 2 - 0.02;
    c.minDistance = 3;
    c.maxDistance = 120;
    c.screenSpacePanning = true;
    ref.current = c;
    return () => c.dispose();
  }, [camera, gl]);
  useFrame(() => ref.current?.update());
  return null;
}

function LabelProjector({ anchors, refs, yOffset }: { anchors: SceneProps['labelAnchors']; refs: SceneProps['labelRefs']; yOffset: number }) {
  const { camera, size } = useThree();
  const tmp = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    for (const a of anchors) {
      const el = refs.current.get(a.key);
      if (!el) continue;
      tmp.copy(a.pos);
      tmp.y += yOffset;
      tmp.project(camera);
      const behind = tmp.z > 1;
      const sx = (tmp.x * 0.5 + 0.5) * size.width;
      const sy = (-tmp.y * 0.5 + 0.5) * size.height;
      el.style.transform = `translate(-50%, -50%) translate(${sx}px, ${sy}px)`;
      el.style.left = '0px';
      el.style.display = behind ? 'none' : 'block';
    }
  });
  return null;
}

function Scene(p: SceneProps) {
  const ACCENT = p.accent;
  const m = useMemo(() => makeMapper(p.plan), [p.plan]);
  const { plan, wallH, highlight } = p;
  const gap = 4 * p.explode;
  const off = (d: Discipline) => EXPLODE_ORDER[d] * gap;
  const [hover, setHover] = useState<string | null>(null);
  const isHi = (id: string) => highlight.has(id) || p.selectedElement === id;

  const click = (fn: () => void) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 6) return; // drag, not click
    fn();
  };
  const hoverProps = (id: string) => ({
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      setHover(id);
      document.body.style.cursor = 'pointer';
    },
    onPointerOut: () => {
      setHover((h) => (h === id ? null : h));
      document.body.style.cursor = '';
    },
  });
  useEffect(() => () => void (document.body.style.cursor = ''), []);

  // ---------- geometry (memoized on plan) ----------
  const roomGeoms = useMemo(
    () => plan.rooms.map((r) => ({ id: r.id, geo: new THREE.ShapeGeometry(toShape(m, r.poly, r.holes)) })),
    [plan, m],
  );

  const wallGeoms = useMemo(
    () =>
      plan.walls.map((w) => {
        if (w.pts.length >= 3 && polyArea(w.pts) > 1) {
          const geo = new THREE.ExtrudeGeometry(toShape(m, w.pts), { depth: 1, bevelEnabled: false });
          return { id: w.id, geo, kind: 'extrude' as const };
        }
        // fallback: polyline → boxes 15cm thick
        const segs: { pos: THREE.Vector3; len: number; rot: number }[] = [];
        for (let i = 0; i + 1 < w.pts.length; i++) {
          const a = m.v(w.pts[i]);
          const b = m.v(w.pts[i + 1]);
          segs.push({ pos: a.clone().add(b).multiplyScalar(0.5), len: a.distanceTo(b), rot: -Math.atan2(b.z - a.z, b.x - a.x) });
        }
        return { id: w.id, segs, kind: 'segs' as const };
      }),
    [plan, m],
  );

  const furnGeoms = useMemo(
    () =>
      plan.furniture
        .filter((f) => f.poly && f.poly.length >= 3)
        .map((f) => ({ id: f.id, geo: new THREE.ExtrudeGeometry(toShape(m, f.poly), { depth: 0.45, bevelEnabled: false }) })),
    [plan, m],
  );

  const doorLines = useMemo(
    () =>
      [
        ...plan.doors.map((d) => ({ id: d.id, a: d.a, b: d.b, hinge: d.hinge, open: d.open, color: C.door })),
        ...plan.entrance.map((d) => ({ id: d.id, a: d.a, b: d.b, hinge: null as XY | null | undefined, open: null as XY | null | undefined, color: C.entrance })),
      ].map((d) => {
        const a = m.v(d.a, 0.03);
        const b = m.v(d.b, 0.03);
        const hi = highlight.has(d.id) || p.selectedElement === d.id;
        const color = hi ? ACCENT : d.color;
        const opening = makeLine([a, b], color, 0.6);
        const leaf = d.hinge && d.open ? makeLine([m.v(d.hinge, 0.04), m.v(d.open, 0.04)], color) : null;
        return { id: d.id, a, b, opening, leaf, color };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan, m, highlight, p.selectedElement, ACCENT],
  );

  const sysLines = useMemo(
    () =>
      plan.syslines
        .filter((s) => s.pts && s.pts.length >= 2)
        .map((s) => ({ id: s.id, line: makeLine(s.pts.map((q) => m.v(q, wallH + 0.15)), isHi(s.id) ? ACCENT : C.sys) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [plan, m, wallH, highlight, p.selectedElement, ACCENT],
  );

  const bbBox = (bb: [XY, XY], y0: number, h: number) => {
    const x0 = Math.min(bb[0][0], bb[1][0]);
    const x1 = Math.max(bb[0][0], bb[1][0]);
    const y0p = Math.min(bb[0][1], bb[1][1]);
    const y1p = Math.max(bb[0][1], bb[1][1]);
    const w = Math.max((x1 - x0) / 100, 0.02);
    const d = Math.max((y1p - y0p) / 100, 0.02);
    return { pos: [m.x((x0 + x1) / 2), y0 + h / 2, m.z((y0p + y1p) / 2)] as [number, number, number], size: [w, h, d] as [number, number, number] };
  };

  const mat = (color: string, id: string, opts: { opacity?: number } = {}) => {
    const hi = isHi(id);
    const hov = hover === id;
    const op = opts.opacity ?? 1;
    return (
      <meshStandardMaterial
        color={hi ? ACCENT : color}
        emissive={hi ? ACCENT : hov ? '#ffffff' : '#000000'}
        emissiveIntensity={hi ? 0.45 : hov ? 0.12 : 0}
        transparent={op < 1}
        opacity={op}
        roughness={0.8}
        metalness={0.05}
      />
    );
  };

  return (
    <>
      <color attach="background" args={['#0B0F17']} />
      <ambientLight intensity={0.55} />
      <hemisphereLight args={['#cfe8ff', '#0b0f17', 0.35]} />
      <directionalLight position={[15, 30, 12]} intensity={1.1} />
      <directionalLight position={[-20, 15, -10]} intensity={0.3} />
      <gridHelper args={[80, 80, '#1e293b', '#141b2a']} position={[0, -0.02, 0]} />
      <Controls />
      <LabelProjector anchors={p.labelAnchors} refs={p.labelRefs} yOffset={off('architecture') + 0.2} />

      {/* ---------- architecture ---------- */}
      {p.visible.architecture && (
        <group position={[0, off('architecture'), 0]}>
          {roomGeoms.map((r, i) => {
            const sel = p.selectedRoom === r.id;
            const hov = hover === r.id;
            const hi = highlight.has(r.id);
            return (
              <mesh
                key={r.id}
                geometry={r.geo}
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, 0.005, 0]}
                onClick={click(() => p.onRoom(r.id))}
                {...hoverProps(r.id)}
              >
                <meshStandardMaterial
                  color={sel || hi ? ACCENT : ROOM_TINTS[i % ROOM_TINTS.length]}
                  emissive={sel || hi ? ACCENT : hov ? '#ffffff' : '#000000'}
                  emissiveIntensity={sel || hi ? 0.35 : hov ? 0.08 : 0}
                  transparent
                  opacity={sel || hi ? 0.7 : 0.55}
                  side={THREE.DoubleSide}
                  depthWrite={false}
                />
              </mesh>
            );
          })}

          {wallGeoms.map((w) =>
            w.kind === 'extrude' ? (
              <mesh key={w.id} geometry={w.geo} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 1, wallH]} onClick={click(() => p.onElement(w.id))} {...hoverProps(w.id)}>
                {mat(C.wall, w.id)}
              </mesh>
            ) : (
              <group key={w.id}>
                {w.segs.map((s, i) => (
                  <mesh key={i} position={[s.pos.x, wallH / 2, s.pos.z]} rotation={[0, s.rot, 0]} onClick={click(() => p.onElement(w.id))} {...hoverProps(w.id)}>
                    <boxGeometry args={[s.len, wallH, 0.15]} />
                    {mat(C.wall, w.id)}
                  </mesh>
                ))}
              </group>
            ),
          )}

          {plan.partitions.map((pt) => {
            const b = bbBox(pt.bb, 0, wallH);
            return (
              <mesh key={pt.id} position={b.pos} onClick={click(() => p.onElement(pt.id))} {...hoverProps(pt.id)}>
                <boxGeometry args={b.size} />
                {mat(pt.gyps ? C.gyps : C.partition, pt.id)}
              </mesh>
            );
          })}

          {plan.windows.map((w) => {
            const b = bbBox(w.bb, wallH * 0.3, wallH * 0.5);
            b.size[0] = Math.max(b.size[0], 0.08);
            b.size[2] = Math.max(b.size[2], 0.08);
            return (
              <mesh key={w.id} position={b.pos} onClick={click(() => p.onElement(w.id))} {...hoverProps(w.id)}>
                <boxGeometry args={b.size} />
                {mat(C.window, w.id, { opacity: 0.55 })}
              </mesh>
            );
          })}

          {doorLines.map((d) => {
            const mid = d.a.clone().add(d.b).multiplyScalar(0.5);
            const len = Math.max(d.a.distanceTo(d.b), 0.1);
            const rot = -Math.atan2(d.b.z - d.a.z, d.b.x - d.a.x);
            return (
              <group key={d.id}>
                <primitive object={d.opening} />
                {d.leaf && <primitive object={d.leaf} />}
                {/* low hit/visual slab along the opening */}
                <mesh position={[mid.x, 0.05, mid.z]} rotation={[0, rot, 0]} onClick={click(() => p.onElement(d.id))} {...hoverProps(d.id)}>
                  <boxGeometry args={[len, 0.1, 0.25]} />
                  {mat(d.color, d.id, { opacity: 0.6 })}
                </mesh>
              </group>
            );
          })}
        </group>
      )}

      {/* ---------- structure ---------- */}
      {p.visible.structure && (
        <group position={[0, off('structure'), 0]}>
          {plan.columns.map((c) => (
            <mesh key={c.id} position={[m.x(c.c[0]), wallH / 2, m.z(c.c[1])]}>
              <cylinderGeometry args={[Math.max(c.r / 100, 0.05), Math.max(c.r / 100, 0.05), wallH, 24]} />
              {mat(C.column, c.id)}
            </mesh>
          ))}
          {plan.posts.map((ps) => {
            const b = bbBox(ps.bb, 0, wallH);
            return (
              <mesh key={ps.id} position={b.pos}>
                <boxGeometry args={b.size} />
                {mat(C.column, ps.id)}
              </mesh>
            );
          })}
        </group>
      )}

      {/* ---------- furniture ---------- */}
      {p.visible.furniture && (
        <group position={[0, off('furniture'), 0]}>
          {furnGeoms.map((f) => (
            <mesh key={f.id} geometry={f.geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} onClick={click(() => p.onElement(f.id))} {...hoverProps(f.id)}>
              {mat(C.furniture, f.id, { opacity: 0.9 })}
            </mesh>
          ))}
        </group>
      )}

      {/* ---------- electrical ---------- */}
      {p.visible.electrical && (
        <group position={[0, off('electrical'), 0]}>
          {plan.elec.map((e) => (
            <mesh key={e.id} position={[m.x(e.p[0]), 1, m.z(e.p[1])]} onClick={click(() => p.onElement(e.id))} {...hoverProps(e.id)}>
              <sphereGeometry args={[isHi(e.id) ? 0.2 : 0.13, 16, 12]} />
              {mat(C.elec, e.id)}
            </mesh>
          ))}
        </group>
      )}

      {/* ---------- systems ---------- */}
      {p.visible.systems && (
        <group position={[0, off('systems'), 0]}>
          {sysLines.map((s) => (
            <primitive key={s.id} object={s.line} />
          ))}
        </group>
      )}
    </>
  );
}

export interface ViewerProps {
  plan: Plan;
  selectedRoom: string | null;
  selectedElement: string | null;
  highlight: Set<string>;
  onRoom: (id: string | null) => void;
  onElement: (id: string) => void;
  accent?: string;
}

export function Viewer3D(props: ViewerProps) {
  const { plan } = props;
  const wallHcm = plan.display_wall_height_cm?.value;
  const wallH = typeof wallHcm === 'number' && wallHcm > 0 ? wallHcm / 100 : 3;
  const [explode, setExplode] = useState(0);
  const [visible, setVisible] = useState<Record<Discipline, boolean>>({
    architecture: true,
    electrical: true,
    systems: true,
    furniture: true,
    structure: true,
  });
  const [showLabels, setShowLabels] = useState(true);
  const [layersOpen, setLayersOpen] = useState(true);
  const labelRefs = useRef(new Map<string, HTMLDivElement>());
  const downPos = useRef<{ x: number; y: number } | null>(null);

  const m = useMemo(() => makeMapper(plan), [plan]);
  const roomLabels = useMemo(
    () =>
      plan.rooms.map((r) => {
        const lab = plan.labels.find((l) => l.room === r.id);
        let pos: THREE.Vector3;
        if (lab) pos = m.v(lab.c);
        else {
          const xs = r.poly.map((q) => q[0]);
          const ys = r.poly.map((q) => q[1]);
          pos = m.v([(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]);
        }
        return { key: r.id, pos, text: `${r.id} · ${r.names.length ? r.names.join(' · ') : 'ללא שם בקובץ'}` };
      }),
    [plan, m],
  );
  const labelsOn = showLabels && visible.architecture;

  return (
    <div
      className="viewer-wrap"
      onPointerDown={(e) => (downPos.current = { x: e.clientX, y: e.clientY })}
    >
      <Canvas
        camera={{ position: [0, 26, 26], fov: 45, near: 0.1, far: 500 }}
        dpr={[1, 2]}
        onPointerMissed={(e) => {
          const d = downPos.current;
          if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6) return;
          props.onRoom(null);
        }}
      >
        <Scene
          plan={plan}
          wallH={wallH}
          explode={explode}
          visible={visible}
          showLabels={labelsOn}
          selectedRoom={props.selectedRoom}
          selectedElement={props.selectedElement}
          highlight={props.highlight}
          onRoom={(id) => props.onRoom(id)}
          onElement={props.onElement}
          labelRefs={labelRefs}
          labelAnchors={labelsOn ? roomLabels : []}
          accent={props.accent ?? DEFAULT_ACCENT}
        />
      </Canvas>

      {labelsOn && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          {roomLabels.map((l) => (
            <div
              key={l.key}
              ref={(el) => {
                if (el) labelRefs.current.set(l.key, el);
                else labelRefs.current.delete(l.key);
              }}
              className={`room-label${props.selectedRoom === l.key ? ' sel' : ''}`}
              style={{ position: 'absolute', top: 0, left: 0, display: 'none' }}
            >
              {l.text}
            </div>
          ))}
        </div>
      )}

      <div className="overlay layers">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h4 style={{ margin: 0 }}>שכבות</h4>
          <button className="linklike" type="button" onClick={() => setLayersOpen((o) => !o)} aria-expanded={layersOpen}>
            {layersOpen ? 'הסתר' : 'הצג'}
          </button>
        </div>
        {layersOpen && (
          <div style={{ marginTop: 6 }}>
            <label style={{ flexDirection: 'column', alignItems: 'stretch', gap: 2 }}>
              <span>פירוק לשכבות</span>
              <input type="range" min={0} max={1} step={0.01} value={explode} onChange={(e) => setExplode(Number(e.target.value))} aria-label="פירוק לשכבות" />
            </label>
            {DISCIPLINES.map((d) => (
              <label key={d.key}>
                <input type="checkbox" checked={visible[d.key]} onChange={(e) => setVisible((v) => ({ ...v, [d.key]: e.target.checked }))} />
                <span className="swatch" style={{ background: d.color }} />
                {d.he}
              </label>
            ))}
            <label>
              <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />
              <span className="swatch" style={{ background: '#e6eaf2' }} />
              שמות חדרים
            </label>
          </div>
        )}
      </div>

      <div className="overlay badge" title={plan.display_wall_height_cm?.note ?? undefined}>
        <span>
          גובה קירות: <bdi className="num">{wallH.toFixed(2)} מ׳</bdi> · הנחה לתצוגה — לא נכנס לחישוב
        </span>
        <KindBadge kind="display_assumption" title={plan.display_wall_height_cm?.note} />
      </div>
    </div>
  );
}
