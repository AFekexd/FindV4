export type Point = {
  x: number;
  y: number;
};

export type RoomCategory =
  | 'classroom'
  | 'laboratory'
  | 'auditorium'
  | 'office'
  | 'library'
  | 'cafeteria'
  | 'restroom'
  | 'lounge'
  | 'clinic'
  | 'utility'
  | 'entrance';

export type TransitType = 'stairs' | 'elevator' | 'escalator' | 'ramp';

export type POIType =
  | 'entrance'
  | 'exit'
  | 'fire_exit'
  | 'accessible_entrance'
  | 'restroom_all'
  | 'restroom_men'
  | 'restroom_women'
  | 'restroom_accessible'
  | 'water'
  | 'first_aid'
  | 'aed'
  | 'coffee'
  | 'reception'
  | 'vending'
  | 'printer';

export type ZoneType =
  | 'atrium'
  | 'corridor'
  | 'lounge'
  | 'courtyard'
  | 'exhibition'
  | 'dining'
  | 'security'
  | 'custom';

export interface Zone {
  id: string;
  floorId: string;
  name: string;
  code?: string;
  type: ZoneType;
  polygon: Point[];
  color?: string;
  opacity?: number;
  description?: string;
  tags: string[];
}

export interface Room {
  id: string;
  floorId: string;
  name: string;
  code: string;
  category: RoomCategory;
  polygon: Point[];
  doorLocation?: Point;
  navNodeId?: string;
  capacity?: number;
  department?: string;
  occupant?: string;
  description?: string;
  tags: string[];
  colorHatch?: string;
  isRestricted?: boolean;
}

export interface Wall {
  id: string;
  floorId: string;
  start: Point;
  end: Point;
  thickness: number;
  isExterior?: boolean;
}

export type DoorType =
  | 'single'
  | 'double'
  | 'sliding'
  | 'security'
  | 'entrance'
  | 'exit'
  | 'fire_exit'
  | 'accessible_entrance';

export interface Door {
  id: string;
  floorId: string;
  start: Point;
  end: Point;
  type: DoorType;
  name?: string;
  isOpen?: boolean;
  isExterior?: boolean;
}

export interface TransitConnector {
  id: string;
  floorId: string;
  transitGroupId: string;
  type: TransitType;
  name: string;
  position: Point;
  width: number;
  height: number;
  navNodeId: string;
  isAccessible: boolean;
  servesFloorIds: string[];
}

export interface PointOfInterest {
  id: string;
  floorId: string;
  type: POIType;
  name: string;
  position: Point;
  navNodeId?: string;
  description?: string;
}

export interface NavNode {
  id: string;
  floorId: string;
  position: Point;
  type: 'corridor' | 'door' | 'transit' | 'poi' | 'hub';
  refId?: string;
  label?: string;
}

export interface NavEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  floorId: string;
  distance: number;
  isAccessible: boolean;
}

export interface FloorUnderlay {
  url: string;
  name?: string;
  opacity: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  rotation: number;
  visible: boolean;
  locked: boolean;
}

export interface Floor {
  id: string;
  buildingId: string;
  level: number;
  name: string;
  shortCode: string;
  elevationMeters: number;
  width: number;
  height: number;
  rooms: Room[];
  zones?: Zone[];
  walls: Wall[];
  doors: Door[];
  transitConnectors: TransitConnector[];
  pois: PointOfInterest[];
  navNodes: NavNode[];
  navEdges: NavEdge[];
  underlay?: FloorUnderlay;
}

export interface Building {
  id: string;
  institutionId: string;
  name: string;
  code: string;
  address?: string;
  floors: Floor[];
  colorAccent?: string;
}

export interface Institution {
  id: string;
  name: string;
  type: 'university' | 'school' | 'hospital' | 'corporate' | 'institute';
  city: string;
  country: string;
  address: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  description: string;
  buildings: Building[];
}

export type EditorTool =
  | 'select'
  | 'room'
  | 'zone'
  | 'wall'
  | 'door'
  | 'transit'
  | 'poi'
  | 'nav_node'
  | 'nav_edge'
  | 'measure'
  | 'eraser'
  | 'underlay';

export type AppMode = 'wayfinder' | 'studio' | '3d' | 'kiosk' | 'directory' | 'mobile';

export interface RouteStep {
  stepIndex: number;
  instruction: string;
  detail: string;
  floorId: string;
  floorName: string;
  floorShortCode: string;
  buildingName: string;
  nodeId: string;
  coordinates: Point;
  distanceMeters: number;
  isFloorChange?: boolean;
  transitType?: TransitType;
  transitName?: string;
  toFloorName?: string;
  iconType: 'start' | 'straight' | 'turn_left' | 'turn_right' | 'transit' | 'door' | 'end';
}

export interface RouteResult {
  pathNodes: {
    nodeId: string;
    floorId: string;
    position: Point;
    floorLevel: number;
  }[];
  steps: RouteStep[];
  totalDistanceMeters: number;
  estimatedTimeMinutes: number;
  floorsTraversed: string[];
  isAccessible: boolean;
}

export interface RoutePreference {
  accessibilityOnly: boolean;
  prioritizeElevators: boolean;
  prioritizeStairs?: boolean;
  fastestRoute: boolean;
}

export interface ViewportTransform {
  x: number;
  y: number;
  zoom: number;
}

// Runtime constants & guard objects for safe module binding
export const ROOM_CATEGORIES: RoomCategory[] = [
  'classroom',
  'laboratory',
  'auditorium',
  'office',
  'library',
  'cafeteria',
  'restroom',
  'lounge',
  'clinic',
  'utility',
  'entrance',
];

export const ROOM_CATEGORY_NAMES_HU: Record<RoomCategory, string> = {
  classroom: 'Tanterem',
  laboratory: 'Laboratórium',
  auditorium: 'Előadóterem / Aula',
  office: 'Iroda / Tanszék',
  library: 'Könyvtár / Olvasó',
  cafeteria: 'Büfé / Étkező',
  restroom: 'Mosdó / WC',
  lounge: 'Közösségi tér',
  clinic: 'Orvosi szoba / Klinika',
  utility: 'Üzemeltetés / Raktár',
  entrance: 'Főbejárat / Porta',
};

export const TRANSIT_TYPES: TransitType[] = ['stairs', 'elevator', 'escalator', 'ramp'];

export const TRANSIT_NAMES_HU: Record<TransitType, string> = {
  elevator: 'Lift / Felvonó',
  stairs: 'Lépcsőház',
  escalator: 'Mozgólépcső',
  ramp: 'Akadálymentes Rámpa',
};

export const DOOR_TYPES: DoorType[] = [
  'entrance',
  'fire_exit',
  'accessible_entrance',
  'exit',
  'single',
  'double',
  'sliding',
  'security',
];

export const DOOR_NAMES_HU: Record<DoorType, string> = {
  entrance: 'Főbejárat / Épületbejárat',
  fire_exit: 'Vészkijárat / Menekülési ajtó',
  accessible_entrance: 'Akadálymentes Bejárat',
  exit: 'Épület Kijárat',
  single: 'Egyszárnyú Ajtó',
  double: 'Kétszárnyú Ajtó',
  sliding: 'Tolóajtó / Automata',
  security: 'Beléptetős / Biztonsági Ajtó',
};

export const POI_NAMES_HU: Record<POIType, string> = {
  entrance: 'Főbejárat / Épületbejárat',
  exit: 'Kijárat',
  fire_exit: 'Vészkijárat / Menekülés',
  accessible_entrance: 'Akadálymentes bejárat',
  restroom_all: 'Mosdó (Unisex)',
  restroom_men: 'Férfi Mosdó',
  restroom_women: 'Női Mosdó',
  restroom_accessible: 'Akadálymentes Mosdó',
  water: 'Ivókút / Vízautomata',
  first_aid: 'Elsősegély állomás',
  aed: 'Automata Defibrillátor (AED)',
  coffee: 'Kávéautomata / Büfé',
  reception: 'Porta / Információs pult',
  vending: 'Ital- és Ételautomata',
  printer: 'Nyomtató / Fénymásoló',
};

export const ZONE_TYPES: ZoneType[] = [
  'atrium',
  'corridor',
  'lounge',
  'courtyard',
  'exhibition',
  'dining',
  'security',
  'custom',
];

export const ZONE_TYPE_NAMES_HU: Record<ZoneType, string> = {
  atrium: 'Aula / Központi Átrium',
  corridor: 'Közlekedő Folyosó / Passzázs',
  lounge: 'Közösségi & Tanuló Zóna',
  courtyard: 'Belső Udvar / Terasz',
  exhibition: 'Kiállítótér / Rendezvénytér',
  dining: 'Étkező & Büfé Zóna',
  security: 'Biztonsági & Beléptető Zóna',
  custom: 'Egyedi Zóna',
};

export const ZONE_TYPE_COLORS: Record<
  ZoneType,
  { fill: string; stroke: string; badge: string; text: string }
> = {
  atrium: {
    fill: 'rgba(217, 119, 6, 0.12)',
    stroke: '#D97706',
    badge: '#D97706',
    text: '#92400E',
  },
  corridor: {
    fill: 'rgba(100, 116, 139, 0.10)',
    stroke: '#64748B',
    badge: '#64748B',
    text: '#334155',
  },
  lounge: {
    fill: 'rgba(16, 185, 129, 0.12)',
    stroke: '#10B981',
    badge: '#059669',
    text: '#065F46',
  },
  courtyard: {
    fill: 'rgba(34, 197, 94, 0.14)',
    stroke: '#22C55E',
    badge: '#16A34A',
    text: '#14532D',
  },
  exhibition: {
    fill: 'rgba(139, 92, 246, 0.12)',
    stroke: '#8B5CF6',
    badge: '#7C3AED',
    text: '#5B21B6',
  },
  dining: {
    fill: 'rgba(244, 63, 94, 0.12)',
    stroke: '#F43F5E',
    badge: '#E11D48',
    text: '#9F1239',
  },
  security: {
    fill: 'rgba(239, 68, 68, 0.14)',
    stroke: '#EF4444',
    badge: '#DC2626',
    text: '#991B1B',
  },
  custom: {
    fill: 'rgba(59, 130, 246, 0.12)',
    stroke: '#3B82F6',
    badge: '#2563EB',
    text: '#1E40AF',
  },
};


