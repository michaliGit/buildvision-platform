// Typed client for docs/api-contract.md (round 1).
// All data comes from the backend; nothing is computed or invented here.

export type Kind = 'file' | 'computed' | 'manual' | 'display_assumption' | 'missing';

export interface Fact<T = number | string | string[] | boolean | null> {
  value: T | null;
  kind: Kind;
  unit?: string | null;
  formula?: string | null;
  src?: string | null;
  note?: string | null;
}

export type Role = 'client' | 'contractor' | 'developer';

export interface User {
  username: string;
  role: Role;
  display_name: string;
}

export interface Me extends User {
  permissions: { boq: boolean; costs: boolean };
}

export interface LoginResponse {
  token: string;
  user: User;
}

export type XY = [number, number];

export interface Plan {
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  display_wall_height_cm: { value: number; kind: Kind; note?: string };
  levels: Fact;
  rooms: { id: string; names: string[]; poly: XY[]; holes?: XY[][] }[];
  walls: { id: string; pts: XY[] }[];
  partitions: { id: string; bb: [XY, XY]; gyps: boolean }[];
  windows: { id: string; bb: [XY, XY] }[];
  doors: { id: string; a: XY; b: XY; hinge?: XY | null; open?: XY | null }[];
  entrance: { id: string; a: XY; b: XY }[];
  furniture: { id: string; poly: XY[] }[];
  elec: { id: string; p: XY }[];
  syslines: { id: string; pts: XY[] }[];
  columns: { id: string; c: XY; r: number }[];
  posts: { id: string; bb: [XY, XY] }[];
  labels: { t: string; c: XY; room?: string | null }[];
}

export interface RoomSummary {
  id: string;
  names: string[];
  area: Fact<number>;
  perim: Fact<number>;
}

export interface CountFact extends Fact<number> {
  ids: string[];
}

export interface RoomDetails {
  id: string;
  names: Fact<string[]>;
  area: Fact<number>;
  perim: Fact<number>;
  height_notes: { t: string; src?: string | null; kind: Kind }[];
  ceiling_height: Fact;
  level: Fact;
  contents: {
    furniture: CountFact;
    elec_total?: CountFact;
    elec_by_desc: { desc: string | null; count: Fact<number>; ids: string[] }[];
    windows: CountFact;
    doors: CountFact;
  };
}

export interface ElementDetails {
  id: string;
  type: string;
  type_he: string;
  src?: string | null;
  fields: { label: string; fact: Fact }[];
}

export interface BoqRow {
  discipline: string;
  discipline_he: string;
  item: string;
  quantity: Fact<number>;
  elements: { id: string; value: number | null; src?: string | null }[];
  secondary: Fact<number> | null;
}

export interface Boq {
  rows: BoqRow[];
  notes: { discipline: string | null; text: string; kind: Kind }[];
  costs?: { status: string };
}

export interface ChatReply {
  intent: string;
  confidence: number;
  answer: string;
  facts: Fact[];
  element_ids: string[];
  status: 'ok' | 'unknown' | 'forbidden' | 'missing';
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const TOKEN_KEY = 'bv_token';
let token: string | null = null;
try {
  token = sessionStorage.getItem(TOKEN_KEY);
} catch {
  token = null;
}

let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

export function getToken() {
  return token;
}

export function setToken(t: string | null) {
  token = t;
  try {
    if (t) sessionStorage.setItem(TOKEN_KEY, t);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable: keep in memory only */
  }
}

async function request<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (init.body) headers['Content-Type'] = 'application/json';
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, 'השרת לא זמין');
  }
  if (!res.ok) {
    let detail = `שגיאה ${res.status}`;
    try {
      const body = await res.json();
      if (body && typeof body.detail === 'string') detail = body.detail;
    } catch {
      /* ignore */
    }
    if (res.status === 401 && auth) {
      setToken(null);
      onUnauthorized();
    }
    throw new ApiError(res.status, detail);
  }
  return (await res.json()) as T;
}

export const api = {
  health: () => request<{ ok: boolean }>('/health', {}, false),
  login: (username: string, password: string) =>
    request<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }, false),
  me: () => request<Me>('/me'),
  plan: () => request<Plan>('/plan'),
  rooms: () => request<RoomSummary[]>('/rooms'),
  room: (id: string) => request<RoomDetails>(`/rooms/${encodeURIComponent(id)}`),
  element: (id: string) => request<ElementDetails>(`/elements/${encodeURIComponent(id)}`),
  boq: (discipline?: string, room?: string) => {
    const q = new URLSearchParams();
    if (discipline) q.set('discipline', discipline);
    if (room) q.set('room', room);
    const qs = q.toString();
    return request<Boq>(`/boq${qs ? `?${qs}` : ''}`);
  },
  chat: (message: string) => request<ChatReply>('/chat', { method: 'POST', body: JSON.stringify({ message }) }),
};

export const ROLE_HE: Record<Role, string> = { client: 'לקוח', contractor: 'קבלן', developer: 'יזם' };
