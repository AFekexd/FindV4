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
  | 'printer'
  | 'fire_exit';

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

export interface Door {
  id: string;
  floorId: string;
  start: Point;
  end: Point;
  type: 'single' | 'double' | 'sliding' | 'security';
  isOpen?: boolean;
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
