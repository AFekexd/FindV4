import type { Institution, Room, Wall, Door, TransitConnector, PointOfInterest, NavNode, NavEdge, Floor, Building } from '../types';

// -------------------------------------------------------------
// 1. INTÉZMÉNY: BUDAPESTI MŰSZAKI ÉS GAZDASÁGTUDOMÁNYI EGYETEM (BME)
// -------------------------------------------------------------

// --- Földszint (0. szint) ---
const bmeF0_Rooms: Room[] = [
  {
    id: 'room-bme-f0-reception',
    floorId: 'floor-bme-f0',
    name: 'Főbejárati Információ & Porta',
    code: 'I-001',
    category: 'entrance',
    polygon: [
      { x: 380, y: 520 },
      { x: 620, y: 520 },
      { x: 620, y: 640 },
      { x: 380, y: 640 },
    ],
    doorLocation: { x: 500, y: 520 },
    navNodeId: 'node-f0-reception',
    capacity: 30,
    department: 'Biztonsági és Üzemeltetési Igazgatóság',
    occupant: 'Kovács Ferenc (Vezető portás)',
    description: 'Központi látogatói regisztráció, belépőkártya kiadás, információs terminál.',
    tags: ['Akadálymentes', 'Információs pult', 'Nyilvános'],
    colorHatch: 'rgba(26, 60, 43, 0.08)',
  },
  {
    id: 'room-bme-f0-neumann-hall',
    floorId: 'floor-bme-f0',
    name: 'Neumann János Nagyelőadó',
    code: 'I-002',
    category: 'auditorium',
    polygon: [
      { x: 100, y: 120 },
      { x: 380, y: 120 },
      { x: 380, y: 440 },
      { x: 100, y: 440 },
    ],
    doorLocation: { x: 380, y: 280 },
    navNodeId: 'node-f0-turing',
    capacity: 280,
    department: 'Irányítástechnika és Informatika Tanszék',
    occupant: 'Plenáris és konferencia előadóterem',
    description: 'Emelkedő nézőtér, duál lézeres 4K vetítőrendszer, szinkrontolmács fülke.',
    tags: ['Akadálymentes', 'Lézerprojektor', 'Akusztikus panelek', 'Mikrofonrendszer'],
    colorHatch: 'rgba(14, 116, 144, 0.08)',
  },
  {
    id: 'room-bme-f0-robotics',
    floorId: 'floor-bme-f0',
    name: 'Autonóm Rendszerek & Robotika Műhely',
    code: 'I-003',
    category: 'laboratory',
    polygon: [
      { x: 620, y: 120 },
      { x: 900, y: 120 },
      { x: 900, y: 340 },
      { x: 620, y: 340 },
    ],
    doorLocation: { x: 620, y: 230 },
    navNodeId: 'node-f0-robotics',
    capacity: 35,
    department: 'Méréstechnika és Információs Rendszerek',
    occupant: 'Dr. Szabó Péter (Egyetemi docens)',
    description: 'Drónketrec, ipari robotkarok, lidar tesztpálya és 3D nyomtató labor.',
    tags: ['Védőszemüveg kötelező', 'Ipari áram', 'Akadálymentes', '3D Nyomtatók'],
    colorHatch: 'rgba(180, 83, 9, 0.08)',
  },
  {
    id: 'room-bme-f0-cafe',
    floorId: 'floor-bme-f0',
    name: 'Turing Kávézó & Hallgatói Bisztró',
    code: 'I-004',
    category: 'cafeteria',
    polygon: [
      { x: 620, y: 370 },
      { x: 900, y: 370 },
      { x: 900, y: 580 },
      { x: 620, y: 580 },
    ],
    doorLocation: { x: 620, y: 470 },
    navNodeId: 'node-f0-cafe',
    capacity: 80,
    department: 'Hallgatói Szolgáltatások',
    occupant: 'Campus Gasztro Kft.',
    description: 'Kézműves kávé, meleg ételek, tanulószigetek konnektorokkal és gyors Wi-Fi-vel.',
    tags: ['Akadálymentes', 'Ingyenes Wi-Fi', 'Teraszkapcsolat', 'Kávézó'],
    colorHatch: 'rgba(4, 120, 87, 0.08)',
  },
  {
    id: 'room-bme-f0-lounge',
    floorId: 'floor-bme-f0',
    name: 'Központi Hallgatói Fórum & Klub',
    code: 'I-005',
    category: 'lounge',
    polygon: [
      { x: 100, y: 470 },
      { x: 350, y: 470 },
      { x: 350, y: 640 },
      { x: 100, y: 640 },
    ],
    doorLocation: { x: 350, y: 550 },
    navNodeId: 'node-f0-lounge',
    capacity: 50,
    department: 'Egyetemi Hallgatói Képviselet (EHK)',
    occupant: 'Közösségi tér',
    description: 'Moduláris kanapék, mágneses táblák, gyorstöltő állomások.',
    tags: ['Akadálymentes', 'Whiteboard', 'Pihenőzóna'],
    colorHatch: 'rgba(109, 40, 217, 0.08)',
  },
];

const bmeF0_Transit: TransitConnector[] = [
  {
    id: 'transit-bme-elev1-f0',
    floorId: 'floor-bme-f0',
    transitGroupId: 'SHAFT-BME-ELEV-1',
    type: 'elevator',
    name: 'Központi Üveglift 1',
    position: { x: 420, y: 340 },
    width: 44,
    height: 44,
    navNodeId: 'node-f0-elev1',
    isAccessible: true,
    servesFloorIds: ['floor-bme-f0', 'floor-bme-f1', 'floor-bme-f2'],
  },
  {
    id: 'transit-bme-stair1-f0',
    floorId: 'floor-bme-f0',
    transitGroupId: 'SHAFT-BME-STAIR-WEST',
    type: 'stairs',
    name: 'Nyugati Főlépcsőház',
    position: { x: 420, y: 220 },
    width: 50,
    height: 50,
    navNodeId: 'node-f0-stair-west',
    isAccessible: false,
    servesFloorIds: ['floor-bme-f0', 'floor-bme-f1', 'floor-bme-f2'],
  },
];

const bmeF0_POIs: PointOfInterest[] = [
  {
    id: 'poi-bme-f0-restroom-acc',
    floorId: 'floor-bme-f0',
    type: 'restroom_accessible',
    name: 'Akadálymentes Mosdó',
    position: { x: 570, y: 340 },
    navNodeId: 'node-f0-poi-restroom',
    description: 'Tágas akadálymentes mosdó vészjelzővel.',
  },
  {
    id: 'poi-bme-f0-aed',
    floorId: 'floor-bme-f0',
    type: 'aed',
    name: 'Automata Defibrillátor & Elsősegély',
    position: { x: 500, y: 490 },
    navNodeId: 'node-f0-main-hall-2',
    description: 'Életmentő defibrillátor és kötszerdoboz.',
  },
  {
    id: 'poi-bme-f0-water',
    floorId: 'floor-bme-f0',
    type: 'water',
    name: 'Hűtött Ivókút & Kulacstöltő',
    position: { x: 570, y: 400 },
    navNodeId: 'node-f0-main-hall-2',
    description: 'Szűrt hidegvíz automata.',
  },
];

const bmeF0_Nodes: NavNode[] = [
  { id: 'node-f0-entrance', floorId: 'floor-bme-f0', position: { x: 500, y: 670 }, type: 'corridor', label: 'Főbejárati Kapu' },
  { id: 'node-f0-reception', floorId: 'floor-bme-f0', position: { x: 500, y: 580 }, type: 'door', label: 'Porta & Regisztráció (I-001)', refId: 'room-bme-f0-reception' },
  { id: 'node-f0-main-hall-1', floorId: 'floor-bme-f0', position: { x: 500, y: 470 }, type: 'hub', label: 'Déli Aula Csomópont' },
  { id: 'node-f0-main-hall-2', floorId: 'floor-bme-f0', position: { x: 500, y: 340 }, type: 'hub', label: 'Központi Közlekedő Mag' },
  { id: 'node-f0-main-hall-3', floorId: 'floor-bme-f0', position: { x: 500, y: 220 }, type: 'corridor', label: 'Északi Folyosó' },
  { id: 'node-f0-turing', floorId: 'floor-bme-f0', position: { x: 380, y: 280 }, type: 'door', label: 'Neumann Nagyelőadó (I-002)', refId: 'room-bme-f0-neumann-hall' },
  { id: 'node-f0-robotics', floorId: 'floor-bme-f0', position: { x: 620, y: 230 }, type: 'door', label: 'Robotika Műhely (I-003)', refId: 'room-bme-f0-robotics' },
  { id: 'node-f0-cafe', floorId: 'floor-bme-f0', position: { x: 620, y: 470 }, type: 'door', label: 'Büfé Bejárat (I-004)', refId: 'room-bme-f0-cafe' },
  { id: 'node-f0-lounge', floorId: 'floor-bme-f0', position: { x: 350, y: 550 }, type: 'door', label: 'Hallgatói Fórum (I-005)', refId: 'room-bme-f0-lounge' },
  { id: 'node-f0-elev1', floorId: 'floor-bme-f0', position: { x: 442, y: 340 }, type: 'transit', label: 'Lift 1 Előtér (0. szint)', refId: 'transit-bme-elev1-f0' },
  { id: 'node-f0-stair-west', floorId: 'floor-bme-f0', position: { x: 445, y: 220 }, type: 'transit', label: 'Nyugati Lépcső (0. szint)', refId: 'transit-bme-stair1-f0' },
  { id: 'node-f0-poi-restroom', floorId: 'floor-bme-f0', position: { x: 550, y: 340 }, type: 'poi', label: 'Mosdó Blokkok', refId: 'poi-bme-f0-restroom-acc' },
];

const bmeF0_Edges: NavEdge[] = [
  { id: 'e-f0-1', fromNodeId: 'node-f0-entrance', toNodeId: 'node-f0-reception', floorId: 'floor-bme-f0', distance: 90, isAccessible: true },
  { id: 'e-f0-2', fromNodeId: 'node-f0-reception', toNodeId: 'node-f0-main-hall-1', floorId: 'floor-bme-f0', distance: 110, isAccessible: true },
  { id: 'e-f0-3', fromNodeId: 'node-f0-main-hall-1', toNodeId: 'node-f0-main-hall-2', floorId: 'floor-bme-f0', distance: 130, isAccessible: true },
  { id: 'e-f0-4', fromNodeId: 'node-f0-main-hall-2', toNodeId: 'node-f0-main-hall-3', floorId: 'floor-bme-f0', distance: 120, isAccessible: true },
  { id: 'e-f0-5', fromNodeId: 'node-f0-main-hall-2', toNodeId: 'node-f0-turing', floorId: 'floor-bme-f0', distance: 134, isAccessible: true },
  { id: 'e-f0-6', fromNodeId: 'node-f0-main-hall-3', toNodeId: 'node-f0-turing', floorId: 'floor-bme-f0', distance: 134, isAccessible: true },
  { id: 'e-f0-7', fromNodeId: 'node-f0-main-hall-3', toNodeId: 'node-f0-robotics', floorId: 'floor-bme-f0', distance: 120, isAccessible: true },
  { id: 'e-f0-8', fromNodeId: 'node-f0-main-hall-1', toNodeId: 'node-f0-cafe', floorId: 'floor-bme-f0', distance: 120, isAccessible: true },
  { id: 'e-f0-9', fromNodeId: 'node-f0-main-hall-1', toNodeId: 'node-f0-lounge', floorId: 'floor-bme-f0', distance: 170, isAccessible: true },
  { id: 'e-f0-10', fromNodeId: 'node-f0-main-hall-2', toNodeId: 'node-f0-elev1', floorId: 'floor-bme-f0', distance: 58, isAccessible: true },
  { id: 'e-f0-11', fromNodeId: 'node-f0-main-hall-3', toNodeId: 'node-f0-stair-west', floorId: 'floor-bme-f0', distance: 55, isAccessible: false },
  { id: 'e-f0-12', fromNodeId: 'node-f0-main-hall-2', toNodeId: 'node-f0-poi-restroom', floorId: 'floor-bme-f0', distance: 50, isAccessible: true },
];

const bmeF0_Walls: Wall[] = [
  { id: 'w-f0-1', floorId: 'floor-bme-f0', start: { x: 80, y: 100 }, end: { x: 920, y: 100 }, thickness: 4, isExterior: true },
  { id: 'w-f0-2', floorId: 'floor-bme-f0', start: { x: 920, y: 100 }, end: { x: 920, y: 660 }, thickness: 4, isExterior: true },
  { id: 'w-f0-3', floorId: 'floor-bme-f0', start: { x: 920, y: 660 }, end: { x: 80, y: 660 }, thickness: 4, isExterior: true },
  { id: 'w-f0-4', floorId: 'floor-bme-f0', start: { x: 80, y: 660 }, end: { x: 80, y: 100 }, thickness: 4, isExterior: true },
  { id: 'w-f0-5', floorId: 'floor-bme-f0', start: { x: 380, y: 100 }, end: { x: 380, y: 450 }, thickness: 3 },
  { id: 'w-f0-6', floorId: 'floor-bme-f0', start: { x: 80, y: 450 }, end: { x: 380, y: 450 }, thickness: 3 },
  { id: 'w-f0-7', floorId: 'floor-bme-f0', start: { x: 620, y: 100 }, end: { x: 620, y: 350 }, thickness: 3 },
  { id: 'w-f0-8', floorId: 'floor-bme-f0', start: { x: 620, y: 350 }, end: { x: 920, y: 350 }, thickness: 3 },
  { id: 'w-f0-9', floorId: 'floor-bme-f0', start: { x: 620, y: 370 }, end: { x: 920, y: 370 }, thickness: 3 },
  { id: 'w-f0-10', floorId: 'floor-bme-f0', start: { x: 620, y: 370 }, end: { x: 620, y: 590 }, thickness: 3 },
  { id: 'w-f0-11', floorId: 'floor-bme-f0', start: { x: 620, y: 590 }, end: { x: 920, y: 590 }, thickness: 3 },
  { id: 'w-f0-12', floorId: 'floor-bme-f0', start: { x: 370, y: 520 }, end: { x: 630, y: 520 }, thickness: 2 },
];

const bmeF0_Doors: Door[] = [
  { id: 'd-f0-1', floorId: 'floor-bme-f0', start: { x: 380, y: 270 }, end: { x: 380, y: 290 }, type: 'double' },
  { id: 'd-f0-2', floorId: 'floor-bme-f0', start: { x: 620, y: 220 }, end: { x: 620, y: 240 }, type: 'single' },
  { id: 'd-f0-3', floorId: 'floor-bme-f0', start: { x: 620, y: 460 }, end: { x: 620, y: 480 }, type: 'double' },
  { id: 'd-f0-4', floorId: 'floor-bme-f0', start: { x: 480, y: 660 }, end: { x: 520, y: 660 }, type: 'sliding' },
];

// --- 1. Emelet ---
const bmeF1_Rooms: Room[] = [
  {
    id: 'room-bme-f1-cloud-lab',
    floorId: 'floor-bme-f1',
    name: 'Felhő Architektúrák & Szerver Laboratórium',
    code: 'I-101',
    category: 'laboratory',
    polygon: [
      { x: 100, y: 120 },
      { x: 380, y: 120 },
      { x: 380, y: 360 },
      { x: 100, y: 360 },
    ],
    doorLocation: { x: 380, y: 240 },
    navNodeId: 'node-f1-cloud',
    capacity: 40,
    department: 'Számítástudományi és Információelméleti Tanszék',
    occupant: 'Dr. Varga Zoltán (Tanszékvezető)',
    description: 'Blade szerverszekrények, 10Gbps optikai hálózati tesztpad, GPU klaszter.',
    tags: ['Akadálymentes', 'Gigabit Ethernet', 'Szerverpark'],
    colorHatch: 'rgba(14, 116, 144, 0.08)',
  },
  {
    id: 'room-bme-f1-cyber-security',
    floorId: 'floor-bme-f1',
    name: 'Kiberbiztonsági & Kriptográfiai Hadiszoba',
    code: 'I-102',
    category: 'laboratory',
    polygon: [
      { x: 100, y: 390 },
      { x: 380, y: 390 },
      { x: 380, y: 630 },
      { x: 100, y: 630 },
    ],
    doorLocation: { x: 380, y: 510 },
    navNodeId: 'node-f1-cyber',
    capacity: 25,
    department: 'Hálózati Rendszerek és Szolgáltatások Tanszék',
    occupant: 'Dr. Nemes Attila',
    description: 'Légmentesen elzárt etikus hacker szimulációs labor, hálózati monitorfal.',
    tags: ['Kiemelt biztonság', 'Belépőkártyás', 'Izolált hálózat'],
    colorHatch: 'rgba(185, 28, 28, 0.08)',
    isRestricted: true,
  },
  {
    id: 'room-bme-f1-seminar',
    floorId: 'floor-bme-f1',
    name: 'Kari Szemináriumi Terem 1A',
    code: 'I-103',
    category: 'classroom',
    polygon: [
      { x: 620, y: 120 },
      { x: 900, y: 120 },
      { x: 900, y: 360 },
      { x: 620, y: 360 },
    ],
    doorLocation: { x: 620, y: 240 },
    navNodeId: 'node-f1-seminar',
    capacity: 65,
    department: 'Villamosmérnöki és Informatikai Kar',
    occupant: 'MSc és PhD kurzusok',
    description: 'Interaktív okostáblák, vezeték nélküli prezentáció, hibrid oktatási kamerák.',
    tags: ['Akadálymentes', 'Okostábla', 'Hibrid közvetítés'],
    colorHatch: 'rgba(4, 120, 87, 0.08)',
  },
  {
    id: 'room-bme-f1-faculty-offices',
    floorId: 'floor-bme-f1',
    name: 'Dékáni Hivatal & Professzori Irodák',
    code: 'I-104',
    category: 'office',
    polygon: [
      { x: 620, y: 390 },
      { x: 900, y: 390 },
      { x: 900, y: 630 },
      { x: 620, y: 630 },
    ],
    doorLocation: { x: 620, y: 510 },
    navNodeId: 'node-f1-faculty',
    capacity: 20,
    department: 'Kari Vezetés',
    occupant: 'Prof. Dr. Charaf Hassan (Dékán)',
    description: 'Oktatói fogadóórák, dékáni tanácskozóterem, tanulmányi egyeztető.',
    tags: ['Akadálymentes', 'Csendes zóna', 'Előzetes egyeztetés'],
    colorHatch: 'rgba(26, 60, 43, 0.08)',
  },
];

const bmeF1_Transit: TransitConnector[] = [
  {
    id: 'transit-bme-elev1-f1',
    floorId: 'floor-bme-f1',
    transitGroupId: 'SHAFT-BME-ELEV-1',
    type: 'elevator',
    name: 'Központi Üveglift 1',
    position: { x: 420, y: 340 },
    width: 44,
    height: 44,
    navNodeId: 'node-f1-elev1',
    isAccessible: true,
    servesFloorIds: ['floor-bme-f0', 'floor-bme-f1', 'floor-bme-f2'],
  },
  {
    id: 'transit-bme-stair1-f1',
    floorId: 'floor-bme-f1',
    transitGroupId: 'SHAFT-BME-STAIR-WEST',
    type: 'stairs',
    name: 'Nyugati Főlépcsőház',
    position: { x: 420, y: 220 },
    width: 50,
    height: 50,
    navNodeId: 'node-f1-stair-west',
    isAccessible: false,
    servesFloorIds: ['floor-bme-f0', 'floor-bme-f1', 'floor-bme-f2'],
  },
];

const bmeF1_POIs: PointOfInterest[] = [
  {
    id: 'poi-bme-f1-restroom',
    floorId: 'floor-bme-f1',
    type: 'restroom_accessible',
    name: 'Emeleti Mosdó & Baba-Mama Szoba',
    position: { x: 570, y: 340 },
    navNodeId: 'node-f1-main-hall-2',
    description: 'Akadálymentes vizesblokk.',
  },
  {
    id: 'poi-bme-f1-coffee',
    floorId: 'floor-bme-f1',
    type: 'coffee',
    name: 'Oktatói Kávésarok',
    position: { x: 500, y: 480 },
    navNodeId: 'node-f1-main-hall-1',
    description: 'Szemes kávégép és teaválaszték.',
  },
];

const bmeF1_Nodes: NavNode[] = [
  { id: 'node-f1-main-hall-1', floorId: 'floor-bme-f1', position: { x: 500, y: 510 }, type: 'hub', label: 'Déli Galéria (1. emelet)' },
  { id: 'node-f1-main-hall-2', floorId: 'floor-bme-f1', position: { x: 500, y: 340 }, type: 'hub', label: 'Emeleti Lift Előtér' },
  { id: 'node-f1-main-hall-3', floorId: 'floor-bme-f1', position: { x: 500, y: 220 }, type: 'corridor', label: 'Északi Galéria (1. emelet)' },
  { id: 'node-f1-cloud', floorId: 'floor-bme-f1', position: { x: 380, y: 240 }, type: 'door', label: 'Felhő Labor (I-101)', refId: 'room-bme-f1-cloud-lab' },
  { id: 'node-f1-cyber', floorId: 'floor-bme-f1', position: { x: 380, y: 510 }, type: 'door', label: 'Kiberbiztonság (I-102)', refId: 'room-bme-f1-cyber-security' },
  { id: 'node-f1-seminar', floorId: 'floor-bme-f1', position: { x: 620, y: 240 }, type: 'door', label: 'Szemináriumi Terem (I-103)', refId: 'room-bme-f1-seminar' },
  { id: 'node-f1-faculty', floorId: 'floor-bme-f1', position: { x: 620, y: 510 }, type: 'door', label: 'Dékáni Hivatal (I-104)', refId: 'room-bme-f1-faculty-offices' },
  { id: 'node-f1-elev1', floorId: 'floor-bme-f1', position: { x: 442, y: 340 }, type: 'transit', label: 'Lift 1 Előtér (1. emelet)', refId: 'transit-bme-elev1-f1' },
  { id: 'node-f1-stair-west', floorId: 'floor-bme-f1', position: { x: 445, y: 220 }, type: 'transit', label: 'Nyugati Lépcső (1. emelet)', refId: 'transit-bme-stair1-f1' },
];

const bmeF1_Edges: NavEdge[] = [
  { id: 'e-f1-1', fromNodeId: 'node-f1-main-hall-1', toNodeId: 'node-f1-main-hall-2', floorId: 'floor-bme-f1', distance: 170, isAccessible: true },
  { id: 'e-f1-2', fromNodeId: 'node-f1-main-hall-2', toNodeId: 'node-f1-main-hall-3', floorId: 'floor-bme-f1', distance: 120, isAccessible: true },
  { id: 'e-f1-3', fromNodeId: 'node-f1-main-hall-3', toNodeId: 'node-f1-cloud', floorId: 'floor-bme-f1', distance: 120, isAccessible: true },
  { id: 'e-f1-4', fromNodeId: 'node-f1-main-hall-1', toNodeId: 'node-f1-cyber', floorId: 'floor-bme-f1', distance: 120, isAccessible: true },
  { id: 'e-f1-5', fromNodeId: 'node-f1-main-hall-3', toNodeId: 'node-f1-seminar', floorId: 'floor-bme-f1', distance: 120, isAccessible: true },
  { id: 'e-f1-6', fromNodeId: 'node-f1-main-hall-1', toNodeId: 'node-f1-faculty', floorId: 'floor-bme-f1', distance: 120, isAccessible: true },
  { id: 'e-f1-7', fromNodeId: 'node-f1-main-hall-2', toNodeId: 'node-f1-elev1', floorId: 'floor-bme-f1', distance: 58, isAccessible: true },
  { id: 'e-f1-8', fromNodeId: 'node-f1-main-hall-3', toNodeId: 'node-f1-stair-west', floorId: 'floor-bme-f1', distance: 55, isAccessible: false },
];

const bmeF1_Walls: Wall[] = [
  { id: 'w-f1-1', floorId: 'floor-bme-f1', start: { x: 80, y: 100 }, end: { x: 920, y: 100 }, thickness: 4, isExterior: true },
  { id: 'w-f1-2', floorId: 'floor-bme-f1', start: { x: 920, y: 100 }, end: { x: 920, y: 650 }, thickness: 4, isExterior: true },
  { id: 'w-f1-3', floorId: 'floor-bme-f1', start: { x: 920, y: 650 }, end: { x: 80, y: 650 }, thickness: 4, isExterior: true },
  { id: 'w-f1-4', floorId: 'floor-bme-f1', start: { x: 80, y: 650 }, end: { x: 80, y: 100 }, thickness: 4, isExterior: true },
  { id: 'w-f1-5', floorId: 'floor-bme-f1', start: { x: 380, y: 100 }, end: { x: 380, y: 650 }, thickness: 3 },
  { id: 'w-f1-6', floorId: 'floor-bme-f1', start: { x: 80, y: 375 }, end: { x: 380, y: 375 }, thickness: 3 },
  { id: 'w-f1-7', floorId: 'floor-bme-f1', start: { x: 620, y: 100 }, end: { x: 620, y: 650 }, thickness: 3 },
  { id: 'w-f1-8', floorId: 'floor-bme-f1', start: { x: 620, y: 375 }, end: { x: 920, y: 375 }, thickness: 3 },
];

const bmeF1_Doors: Door[] = [
  { id: 'd-f1-1', floorId: 'floor-bme-f1', start: { x: 380, y: 230 }, end: { x: 380, y: 250 }, type: 'single' },
  { id: 'd-f1-2', floorId: 'floor-bme-f1', start: { x: 380, y: 500 }, end: { x: 380, y: 520 }, type: 'security' },
  { id: 'd-f1-3', floorId: 'floor-bme-f1', start: { x: 620, y: 230 }, end: { x: 620, y: 250 }, type: 'single' },
  { id: 'd-f1-4', floorId: 'floor-bme-f1', start: { x: 620, y: 500 }, end: { x: 620, y: 520 }, type: 'single' },
];

// --- 2. Emelet ---
const bmeF2_Rooms: Room[] = [
  {
    id: 'room-bme-f2-quantum',
    floorId: 'floor-bme-f2',
    name: 'Kvantuminformatikai & Félvezető Tiszta Tér Labor',
    code: 'I-201',
    category: 'laboratory',
    polygon: [
      { x: 100, y: 120 },
      { x: 420, y: 120 },
      { x: 420, y: 420 },
      { x: 100, y: 420 },
    ],
    doorLocation: { x: 420, y: 280 },
    navNodeId: 'node-f2-quantum',
    capacity: 15,
    department: 'Atomfizika és Fotonika Tanszék',
    occupant: 'Dr. Asbóth János (Kutatóprofesszor)',
    description: 'ISO Class 5 tiszta tér kriogenikus hűtőrendszerrel (15 millikelvin).',
    tags: ['Tiszta tér', 'Kriogenika', 'Speciális védőruha kötelező'],
    colorHatch: 'rgba(14, 116, 144, 0.12)',
    isRestricted: true,
  },
  {
    id: 'room-bme-f2-neural',
    floorId: 'floor-bme-f2',
    name: 'Neurális Interfészek & Mesterséges Intelligencia Stúdió',
    code: 'I-202',
    category: 'laboratory',
    polygon: [
      { x: 100, y: 450 },
      { x: 420, y: 450 },
      { x: 420, y: 640 },
      { x: 100, y: 640 },
    ],
    doorLocation: { x: 420, y: 530 },
    navNodeId: 'node-f2-neural',
    capacity: 22,
    department: 'Irányítástechnika és Informatika Tanszék',
    occupant: 'Dr. Horváth Gábor',
    description: 'Faraday-kalitkás EEG mérőkamra és neurális jelfeldolgozó munkaállomások.',
    tags: ['Faraday árnyékolt', 'Akadálymentes', 'Szenzoros mérések'],
    colorHatch: 'rgba(109, 40, 217, 0.08)',
  },
  {
    id: 'room-bme-f2-boardroom',
    floorId: 'floor-bme-f2',
    name: 'Kari Tanácsterem & Panoráma Galéria',
    code: 'I-203',
    category: 'auditorium',
    polygon: [
      { x: 600, y: 120 },
      { x: 900, y: 120 },
      { x: 900, y: 380 },
      { x: 600, y: 380 },
    ],
    doorLocation: { x: 600, y: 260 },
    navNodeId: 'node-f2-boardroom',
    capacity: 35,
    department: 'Kari Vezetés és Professzori Tanács',
    occupant: 'Kari Tanács',
    description: 'Panorámás díszterem beépített konferenciatechnikával és tolmácsrendszerrel.',
    tags: ['Akadálymentes', 'VIP Terem', 'Videókonferencia'],
    colorHatch: 'rgba(26, 60, 43, 0.12)',
  },
  {
    id: 'room-bme-f2-postdoc',
    floorId: 'floor-bme-f2',
    name: 'Kutatói Közösségi Iroda & Think Tank',
    code: 'I-204',
    category: 'office',
    polygon: [
      { x: 600, y: 410 },
      { x: 900, y: 410 },
      { x: 900, y: 640 },
      { x: 600, y: 640 },
    ],
    doorLocation: { x: 600, y: 510 },
    navNodeId: 'node-f2-postdoc',
    capacity: 30,
    department: 'MTA-BME Lendület Kutatócsoportok',
    occupant: 'Posztdoktori kutatók',
    description: 'Nyitott kooperatív állóasztalok, ötletelő sarkok, espresso állomás.',
    tags: ['Akadálymentes', 'Állóasztalok', 'Csendes munka'],
    colorHatch: 'rgba(180, 83, 9, 0.08)',
  },
];

const bmeF2_Transit: TransitConnector[] = [
  {
    id: 'transit-bme-elev1-f2',
    floorId: 'floor-bme-f2',
    transitGroupId: 'SHAFT-BME-ELEV-1',
    type: 'elevator',
    name: 'Központi Üveglift 1',
    position: { x: 450, y: 340 },
    width: 44,
    height: 44,
    navNodeId: 'node-f2-elev1',
    isAccessible: true,
    servesFloorIds: ['floor-bme-f0', 'floor-bme-f1', 'floor-bme-f2'],
  },
  {
    id: 'transit-bme-stair1-f2',
    floorId: 'floor-bme-f2',
    transitGroupId: 'SHAFT-BME-STAIR-WEST',
    type: 'stairs',
    name: 'Nyugati Főlépcsőház',
    position: { x: 450, y: 220 },
    width: 50,
    height: 50,
    navNodeId: 'node-f2-stair-west',
    isAccessible: false,
    servesFloorIds: ['floor-bme-f0', 'floor-bme-f1', 'floor-bme-f2'],
  },
];

const bmeF2_POIs: PointOfInterest[] = [
  {
    id: 'poi-bme-f2-water',
    floorId: 'floor-bme-f2',
    type: 'water',
    name: 'Szódavíz & Ásványvíz Automata',
    position: { x: 550, y: 340 },
    navNodeId: 'node-f2-main-hall-2',
    description: 'Szűrt hideg és szénsavas víz automata.',
  },
  {
    id: 'poi-bme-f2-firstaid',
    floorId: 'floor-bme-f2',
    type: 'first_aid',
    name: 'Vészhelyzeti Szemmosó & Zuhany',
    position: { x: 440, y: 440 },
    navNodeId: 'node-f2-main-hall-1',
    description: 'Kémiai laboratóriumi biztonsági állomás.',
  },
];

const bmeF2_Nodes: NavNode[] = [
  { id: 'node-f2-main-hall-1', floorId: 'floor-bme-f2', position: { x: 510, y: 520 }, type: 'hub', label: 'Déli Folyosó (2. emelet)' },
  { id: 'node-f2-main-hall-2', floorId: 'floor-bme-f2', position: { x: 510, y: 340 }, type: 'hub', label: '2. Emeleti Lift Csomópont' },
  { id: 'node-f2-main-hall-3', floorId: 'floor-bme-f2', position: { x: 510, y: 220 }, type: 'corridor', label: 'Északi Folyosó (2. emelet)' },
  { id: 'node-f2-quantum', floorId: 'floor-bme-f2', position: { x: 420, y: 280 }, type: 'door', label: 'Kvantum Labor Zsilip (I-201)', refId: 'room-bme-f2-quantum' },
  { id: 'node-f2-neural', floorId: 'floor-bme-f2', position: { x: 420, y: 530 }, type: 'door', label: 'Neurális AI Stúdió (I-202)', refId: 'room-bme-f2-neural' },
  { id: 'node-f2-boardroom', floorId: 'floor-bme-f2', position: { x: 600, y: 260 }, type: 'door', label: 'Kari Tanácsterem (I-203)', refId: 'room-bme-f2-boardroom' },
  { id: 'node-f2-postdoc', floorId: 'floor-bme-f2', position: { x: 600, y: 510 }, type: 'door', label: 'Kutatói Think Tank (I-204)', refId: 'room-bme-f2-postdoc' },
  { id: 'node-f2-elev1', floorId: 'floor-bme-f2', position: { x: 472, y: 340 }, type: 'transit', label: 'Lift 1 Előtér (2. emelet)', refId: 'transit-bme-elev1-f2' },
  { id: 'node-f2-stair-west', floorId: 'floor-bme-f2', position: { x: 475, y: 220 }, type: 'transit', label: 'Nyugati Lépcső (2. emelet)', refId: 'transit-bme-stair1-f2' },
];

const bmeF2_Edges: NavEdge[] = [
  { id: 'e-f2-1', fromNodeId: 'node-f2-main-hall-1', toNodeId: 'node-f2-main-hall-2', floorId: 'floor-bme-f2', distance: 180, isAccessible: true },
  { id: 'e-f2-2', fromNodeId: 'node-f2-main-hall-2', toNodeId: 'node-f2-main-hall-3', floorId: 'floor-bme-f2', distance: 120, isAccessible: true },
  { id: 'e-f2-3', fromNodeId: 'node-f2-main-hall-3', toNodeId: 'node-f2-quantum', floorId: 'floor-bme-f2', distance: 108, isAccessible: true },
  { id: 'e-f2-4', fromNodeId: 'node-f2-main-hall-1', toNodeId: 'node-f2-neural', floorId: 'floor-bme-f2', distance: 90, isAccessible: true },
  { id: 'e-f2-5', fromNodeId: 'node-f2-main-hall-3', toNodeId: 'node-f2-boardroom', floorId: 'floor-bme-f2', distance: 98, isAccessible: true },
  { id: 'e-f2-6', fromNodeId: 'node-f2-main-hall-1', toNodeId: 'node-f2-postdoc', floorId: 'floor-bme-f2', distance: 90, isAccessible: true },
  { id: 'e-f2-7', fromNodeId: 'node-f2-main-hall-2', toNodeId: 'node-f2-elev1', floorId: 'floor-bme-f2', distance: 38, isAccessible: true },
  { id: 'e-f2-8', fromNodeId: 'node-f2-main-hall-3', toNodeId: 'node-f2-stair-west', floorId: 'floor-bme-f2', distance: 35, isAccessible: false },
];

const bmeF2_Walls: Wall[] = [
  { id: 'w-f2-1', floorId: 'floor-bme-f2', start: { x: 80, y: 100 }, end: { x: 920, y: 100 }, thickness: 4, isExterior: true },
  { id: 'w-f2-2', floorId: 'floor-bme-f2', start: { x: 920, y: 100 }, end: { x: 920, y: 660 }, thickness: 4, isExterior: true },
  { id: 'w-f2-3', floorId: 'floor-bme-f2', start: { x: 920, y: 660 }, end: { x: 80, y: 660 }, thickness: 4, isExterior: true },
  { id: 'w-f2-4', floorId: 'floor-bme-f2', start: { x: 80, y: 660 }, end: { x: 80, y: 100 }, thickness: 4, isExterior: true },
  { id: 'w-f2-5', floorId: 'floor-bme-f2', start: { x: 420, y: 100 }, end: { x: 420, y: 660 }, thickness: 3 },
  { id: 'w-f2-6', floorId: 'floor-bme-f2', start: { x: 80, y: 435 }, end: { x: 420, y: 435 }, thickness: 3 },
  { id: 'w-f2-7', floorId: 'floor-bme-f2', start: { x: 600, y: 100 }, end: { x: 600, y: 660 }, thickness: 3 },
  { id: 'w-f2-8', floorId: 'floor-bme-f2', start: { x: 600, y: 395 }, end: { x: 920, y: 395 }, thickness: 3 },
];

const bmeF2_Doors: Door[] = [
  { id: 'd-f2-1', floorId: 'floor-bme-f2', start: { x: 420, y: 270 }, end: { x: 420, y: 290 }, type: 'security' },
  { id: 'd-f2-2', floorId: 'floor-bme-f2', start: { x: 420, y: 520 }, end: { x: 420, y: 540 }, type: 'single' },
  { id: 'd-f2-3', floorId: 'floor-bme-f2', start: { x: 600, y: 250 }, end: { x: 600, y: 270 }, type: 'double' },
  { id: 'd-f2-4', floorId: 'floor-bme-f2', start: { x: 600, y: 500 }, end: { x: 600, y: 520 }, type: 'single' },
];

const bmeBuildingI: Building = {
  id: 'bld-bme-i',
  institutionId: 'inst-bme-budapest',
  name: 'Informatikai és Villamosmérnöki Kar (I Épület)',
  code: 'BME-I',
  address: '1117 Budapest, Magyar tudósok körútja 2.',
  colorAccent: '#1A3C2B',
  floors: [
    {
      id: 'floor-bme-f0',
      buildingId: 'bld-bme-i',
      level: 0,
      name: 'Földszint (0. szint)',
      shortCode: 'FSZ',
      elevationMeters: 0.0,
      width: 1000,
      height: 720,
      rooms: bmeF0_Rooms,
      walls: bmeF0_Walls,
      doors: bmeF0_Doors,
      transitConnectors: bmeF0_Transit,
      pois: bmeF0_POIs,
      navNodes: bmeF0_Nodes,
      navEdges: bmeF0_Edges,
    },
    {
      id: 'floor-bme-f1',
      buildingId: 'bld-bme-i',
      level: 1,
      name: '1. Emelet (Szoftver & Hálózati Laborok)',
      shortCode: '1.EM',
      elevationMeters: 3.8,
      width: 1000,
      height: 720,
      rooms: bmeF1_Rooms,
      walls: bmeF1_Walls,
      doors: bmeF1_Doors,
      transitConnectors: bmeF1_Transit,
      pois: bmeF1_POIs,
      navNodes: bmeF1_Nodes,
      navEdges: bmeF1_Edges,
    },
    {
      id: 'floor-bme-f2',
      buildingId: 'bld-bme-i',
      level: 2,
      name: '2. Emelet (Kvantum & MI Központ)',
      shortCode: '2.EM',
      elevationMeters: 7.6,
      width: 1000,
      height: 720,
      rooms: bmeF2_Rooms,
      walls: bmeF2_Walls,
      doors: bmeF2_Doors,
      transitConnectors: bmeF2_Transit,
      pois: bmeF2_POIs,
      navNodes: bmeF2_Nodes,
      navEdges: bmeF2_Edges,
    },
  ],
};

// -------------------------------------------------------------
// 2. INTÉZMÉNY: SEMMELWEIS EGYETEM (BUDAPEST)
// -------------------------------------------------------------

const semmelweisF0_Rooms: Room[] = [
  {
    id: 'room-sote-f0-er',
    floorId: 'floor-sote-f0',
    name: 'Sürgősségi Betegellátó & Triázs Egység (SBO)',
    code: 'SBO-001',
    category: 'clinic',
    polygon: [
      { x: 100, y: 120 },
      { x: 420, y: 120 },
      { x: 420, y: 400 },
      { x: 100, y: 400 },
    ],
    doorLocation: { x: 420, y: 260 },
    navNodeId: 'node-sj-f0-er',
    capacity: 45,
    department: 'Sürgősségi Orvostani Klinika',
    occupant: 'Dr. Takács László (Ügyeletvezető főorvos)',
    description: 'Sokk-talanító, azonnali újraélesztő helyiség, triázs felvevőpult.',
    tags: ['24/7 Sürgősségi', 'Akadálymentes', 'Defibrillátorral felszerelt'],
    colorHatch: 'rgba(185, 28, 28, 0.08)',
  },
  {
    id: 'room-sote-f0-pharmacy',
    floorId: 'floor-sote-f0',
    name: 'Központi Intézeti és Vényforgalmi Gyógyszertár',
    code: 'GYOGY-002',
    category: 'utility',
    polygon: [
      { x: 100, y: 430 },
      { x: 420, y: 430 },
      { x: 420, y: 640 },
      { x: 100, y: 640 },
    ],
    doorLocation: { x: 420, y: 530 },
    navNodeId: 'node-sj-f0-pharmacy',
    capacity: 20,
    department: 'Egyetemi Gyógyszertár Intézet',
    occupant: 'Dr. Molnár Katalin (Főgyógyszerész)',
    description: 'Robotizált gyógyszerkiadó automatika és betegtájékoztató fülkék.',
    tags: ['Akadálymentes', 'Gyógyszerkiadás', 'Automatizált raktár'],
    colorHatch: 'rgba(4, 120, 87, 0.08)',
  },
  {
    id: 'room-sote-f0-admissions',
    floorId: 'floor-sote-f0',
    name: 'Központi Betegfelvétel & Várakozó Aula',
    code: 'AULA-003',
    category: 'entrance',
    polygon: [
      { x: 600, y: 120 },
      { x: 900, y: 120 },
      { x: 900, y: 640 },
      { x: 600, y: 640 },
    ],
    doorLocation: { x: 600, y: 380 },
    navNodeId: 'node-sj-f0-admissions',
    capacity: 60,
    department: 'Betegfelvételi és Tájékoztatási Igazgatóság',
    occupant: 'Betegirányító Csoport',
    description: 'Elektronikus sorszámhúzás, kerekesszék kölcsönző, kényelmes pihenőszékek.',
    tags: ['Akadálymentes', 'Kerekesszék kölcsönzés', 'Betegirányítás'],
    colorHatch: 'rgba(26, 60, 43, 0.08)',
  },
];

const semmelweisF0_Transit: TransitConnector[] = [
  {
    id: 'transit-sote-elev1-f0',
    floorId: 'floor-sote-f0',
    transitGroupId: 'SHAFT-SOTE-MED-ELEV',
    type: 'elevator',
    name: 'Betegszállító & Klinikai Lift M1',
    position: { x: 460, y: 220 },
    width: 50,
    height: 50,
    navNodeId: 'node-sj-f0-elev',
    isAccessible: true,
    servesFloorIds: ['floor-sote-f0', 'floor-sote-f1'],
  },
  {
    id: 'transit-sote-stair1-f0',
    floorId: 'floor-sote-f0',
    transitGroupId: 'SHAFT-SOTE-STAIR-EAST',
    type: 'stairs',
    name: 'Keleti Klinikai Lépcsőház',
    position: { x: 460, y: 480 },
    width: 48,
    height: 48,
    navNodeId: 'node-sj-f0-stair',
    isAccessible: false,
    servesFloorIds: ['floor-sote-f0', 'floor-sote-f1'],
  },
];

const semmelweisF0_POIs: PointOfInterest[] = [
  {
    id: 'poi-sote-f0-aed',
    floorId: 'floor-sote-f0',
    type: 'aed',
    name: 'Klinikai Újraélesztő Defibrillátor',
    position: { x: 510, y: 340 },
    navNodeId: 'node-sj-f0-center',
    description: 'Sürgősségi életmentő állomás.',
  },
  {
    id: 'poi-sote-f0-restroom',
    floorId: 'floor-sote-f0',
    type: 'restroom_accessible',
    name: 'Akadálymentes Betegmosdó',
    position: { x: 560, y: 530 },
    navNodeId: 'node-sj-f0-center',
    description: 'Teljesen akadálymentesített vizesblokk.',
  },
];

const semmelweisF0_Nodes: NavNode[] = [
  { id: 'node-sj-f0-entrance', floorId: 'floor-sote-f0', position: { x: 510, y: 670 }, type: 'corridor', label: 'Mentőbeálló & Főbejárat' },
  { id: 'node-sj-f0-center', floorId: 'floor-sote-f0', position: { x: 510, y: 380 }, type: 'hub', label: 'Földszinti Klinikai Főtengely' },
  { id: 'node-sj-f0-er', floorId: 'floor-sote-f0', position: { x: 420, y: 260 }, type: 'door', label: 'Sürgősségi Triázs (SBO-001)', refId: 'room-sote-f0-er' },
  { id: 'node-sj-f0-pharmacy', floorId: 'floor-sote-f0', position: { x: 420, y: 530 }, type: 'door', label: 'Gyógyszertár (GYOGY-002)', refId: 'room-sote-f0-pharmacy' },
  { id: 'node-sj-f0-admissions', floorId: 'floor-sote-f0', position: { x: 600, y: 380 }, type: 'door', label: 'Betegfelvétel (AULA-003)', refId: 'room-sote-f0-admissions' },
  { id: 'node-sj-f0-elev', floorId: 'floor-sote-f0', position: { x: 485, y: 220 }, type: 'transit', label: 'Klinikai Lift M1 (Földszint)', refId: 'transit-sote-elev1-f0' },
  { id: 'node-sj-f0-stair', floorId: 'floor-sote-f0', position: { x: 484, y: 480 }, type: 'transit', label: 'Keleti Lépcsőház (Földszint)', refId: 'transit-sote-stair1-f0' },
];

const semmelweisF0_Edges: NavEdge[] = [
  { id: 'e-sj0-1', fromNodeId: 'node-sj-f0-entrance', toNodeId: 'node-sj-f0-center', floorId: 'floor-sote-f0', distance: 290, isAccessible: true },
  { id: 'e-sj0-2', fromNodeId: 'node-sj-f0-center', toNodeId: 'node-sj-f0-er', floorId: 'floor-sote-f0', distance: 150, isAccessible: true },
  { id: 'e-sj0-3', fromNodeId: 'node-sj-f0-center', toNodeId: 'node-sj-f0-pharmacy', floorId: 'floor-sote-f0', distance: 174, isAccessible: true },
  { id: 'e-sj0-4', fromNodeId: 'node-sj-f0-center', toNodeId: 'node-sj-f0-admissions', floorId: 'floor-sote-f0', distance: 90, isAccessible: true },
  { id: 'e-sj0-5', fromNodeId: 'node-sj-f0-center', toNodeId: 'node-sj-f0-elev', floorId: 'floor-sote-f0', distance: 161, isAccessible: true },
  { id: 'e-sj0-6', fromNodeId: 'node-sj-f0-center', toNodeId: 'node-sj-f0-stair', floorId: 'floor-sote-f0', distance: 103, isAccessible: false },
];

const semmelweisF0_Walls: Wall[] = [
  { id: 'w-sj0-1', floorId: 'floor-sote-f0', start: { x: 80, y: 100 }, end: { x: 920, y: 100 }, thickness: 4, isExterior: true },
  { id: 'w-sj0-2', floorId: 'floor-sote-f0', start: { x: 920, y: 100 }, end: { x: 920, y: 660 }, thickness: 4, isExterior: true },
  { id: 'w-sj0-3', floorId: 'floor-sote-f0', start: { x: 920, y: 660 }, end: { x: 80, y: 660 }, thickness: 4, isExterior: true },
  { id: 'w-sj0-4', floorId: 'floor-sote-f0', start: { x: 80, y: 660 }, end: { x: 80, y: 100 }, thickness: 4, isExterior: true },
  { id: 'w-sj0-5', floorId: 'floor-sote-f0', start: { x: 420, y: 100 }, end: { x: 420, y: 660 }, thickness: 3 },
  { id: 'w-sj0-6', floorId: 'floor-sote-f0', start: { x: 80, y: 415 }, end: { x: 420, y: 415 }, thickness: 3 },
  { id: 'w-sj0-7', floorId: 'floor-sote-f0', start: { x: 600, y: 100 }, end: { x: 600, y: 660 }, thickness: 3 },
];

const semmelweisF0_Doors: Door[] = [
  { id: 'd-sj0-1', floorId: 'floor-sote-f0', start: { x: 420, y: 250 }, end: { x: 420, y: 270 }, type: 'double' },
  { id: 'd-sj0-2', floorId: 'floor-sote-f0', start: { x: 420, y: 520 }, end: { x: 420, y: 540 }, type: 'single' },
  { id: 'd-sj0-3', floorId: 'floor-sote-f0', start: { x: 600, y: 370 }, end: { x: 600, y: 390 }, type: 'double' },
];

// Semmelweis 1. Emelet
const semmelweisF1_Rooms: Room[] = [
  {
    id: 'room-sote-f1-imaging',
    floorId: 'floor-sote-f1',
    name: '3 Tesla MRI & CT Képalkotó Diagnosztikai Központ',
    code: 'DIAG-101',
    category: 'laboratory',
    polygon: [
      { x: 100, y: 120 },
      { x: 420, y: 120 },
      { x: 420, y: 400 },
      { x: 100, y: 400 },
    ],
    doorLocation: { x: 420, y: 260 },
    navNodeId: 'node-sj-f1-imaging',
    capacity: 15,
    department: 'Orvosi Képalkotó Klinika',
    occupant: 'Dr. Balogh Zsófia (Radiológus főorvos)',
    description: '3 Tesla mágneses terű MR készülék és 128 szeletes alacsony dózisú CT.',
    tags: ['Erős mágneses mező', 'Akadálymentes', 'Sugárvédett'],
    colorHatch: 'rgba(14, 116, 144, 0.08)',
  },
  {
    id: 'room-sote-f1-icu',
    floorId: 'floor-sote-f1',
    name: 'Sebészeti Műtőblokk & Intenzív Terápiás Osztály (ITO)',
    code: 'ITO-102',
    category: 'clinic',
    polygon: [
      { x: 600, y: 120 },
      { x: 900, y: 120 },
      { x: 900, y: 640 },
      { x: 600, y: 640 },
    ],
    doorLocation: { x: 600, y: 380 },
    navNodeId: 'node-sj-f1-icu',
    capacity: 20,
    department: 'Aneszteziológiai és Intenzív Terápiás Klinika',
    occupant: 'Intenzív Terápiás Főnővéri Állomás',
    description: 'Steril műtők, központi telemetriás betegőrző ágyak és HEPA szűrt túlnyomásos légtechnika.',
    tags: ['Steril zóna', 'Akadálymentes', 'Korlátozott látogatás'],
    colorHatch: 'rgba(185, 28, 28, 0.08)',
  },
];

const semmelweisF1_Transit: TransitConnector[] = [
  {
    id: 'transit-sote-elev1-f1',
    floorId: 'floor-sote-f1',
    transitGroupId: 'SHAFT-SOTE-MED-ELEV',
    type: 'elevator',
    name: 'Betegszállító & Klinikai Lift M1',
    position: { x: 460, y: 220 },
    width: 50,
    height: 50,
    navNodeId: 'node-sj-f1-elev',
    isAccessible: true,
    servesFloorIds: ['floor-sote-f0', 'floor-sote-f1'],
  },
  {
    id: 'transit-sote-stair1-f1',
    floorId: 'floor-sote-f1',
    transitGroupId: 'SHAFT-SOTE-STAIR-EAST',
    type: 'stairs',
    name: 'Keleti Klinikai Lépcsőház',
    position: { x: 460, y: 480 },
    width: 48,
    height: 48,
    navNodeId: 'node-sj-f1-stair',
    isAccessible: false,
    servesFloorIds: ['floor-sote-f0', 'floor-sote-f1'],
  },
];

const semmelweisF1_POIs: PointOfInterest[] = [
  {
    id: 'poi-sote-f1-scrub',
    floorId: 'floor-sote-f1',
    type: 'water',
    name: 'Műtéti Sebészi Bemosakodó Állomás',
    position: { x: 530, y: 320 },
    navNodeId: 'node-sj-f1-center',
    description: 'Érintésmentes fertőtlenítő és sebészi mosdó.',
  },
];

const semmelweisF1_Nodes: NavNode[] = [
  { id: 'node-sj-f1-center', floorId: 'floor-sote-f1', position: { x: 510, y: 380 }, type: 'hub', label: '1. Emeleti Diagnosztikai Folyosó' },
  { id: 'node-sj-f1-imaging', floorId: 'floor-sote-f1', position: { x: 420, y: 260 }, type: 'door', label: 'MRI Központ (DIAG-101)', refId: 'room-sote-f1-imaging' },
  { id: 'node-sj-f1-icu', floorId: 'floor-sote-f1', position: { x: 600, y: 380 }, type: 'door', label: 'Sebészet & ITO Zsilip (ITO-102)', refId: 'room-sote-f1-icu' },
  { id: 'node-sj-f1-elev', floorId: 'floor-sote-f1', position: { x: 485, y: 220 }, type: 'transit', label: 'Klinikai Lift M1 (1. emelet)', refId: 'transit-sote-elev1-f1' },
  { id: 'node-sj-f1-stair', floorId: 'floor-sote-f1', position: { x: 484, y: 480 }, type: 'transit', label: 'Keleti Lépcsőház (1. emelet)', refId: 'transit-sote-stair1-f1' },
];

const semmelweisF1_Edges: NavEdge[] = [
  { id: 'e-sj1-1', fromNodeId: 'node-sj-f1-center', toNodeId: 'node-sj-f1-imaging', floorId: 'floor-sote-f1', distance: 150, isAccessible: true },
  { id: 'e-sj1-2', fromNodeId: 'node-sj-f1-center', toNodeId: 'node-sj-f1-icu', floorId: 'floor-sote-f1', distance: 90, isAccessible: true },
  { id: 'e-sj1-3', fromNodeId: 'node-sj-f1-center', toNodeId: 'node-sj-f1-elev', floorId: 'floor-sote-f1', distance: 161, isAccessible: true },
  { id: 'e-sj1-4', fromNodeId: 'node-sj-f1-center', toNodeId: 'node-sj-f1-stair', floorId: 'floor-sote-f1', distance: 103, isAccessible: false },
];

const semmelweisF1_Walls: Wall[] = [
  { id: 'w-sj1-1', floorId: 'floor-sote-f1', start: { x: 80, y: 100 }, end: { x: 920, y: 100 }, thickness: 4, isExterior: true },
  { id: 'w-sj1-2', floorId: 'floor-sote-f1', start: { x: 920, y: 100 }, end: { x: 920, y: 660 }, thickness: 4, isExterior: true },
  { id: 'w-sj1-3', floorId: 'floor-sote-f1', start: { x: 920, y: 660 }, end: { x: 80, y: 660 }, thickness: 4, isExterior: true },
  { id: 'w-sj1-4', floorId: 'floor-sote-f1', start: { x: 80, y: 660 }, end: { x: 80, y: 100 }, thickness: 4, isExterior: true },
  { id: 'w-sj1-5', floorId: 'floor-sote-f1', start: { x: 420, y: 100 }, end: { x: 420, y: 660 }, thickness: 3 },
  { id: 'w-sj1-6', floorId: 'floor-sote-f1', start: { x: 600, y: 100 }, end: { x: 600, y: 660 }, thickness: 3 },
];

const semmelweisF1_Doors: Door[] = [
  { id: 'd-sj1-1', floorId: 'floor-sote-f1', start: { x: 420, y: 250 }, end: { x: 420, y: 270 }, type: 'double' },
  { id: 'd-sj1-2', floorId: 'floor-sote-f1', start: { x: 600, y: 370 }, end: { x: 600, y: 390 }, type: 'double' },
];

const semmelweisBuilding: Building = {
  id: 'bld-sote-main',
  institutionId: 'inst-semmelweis-bp',
  name: 'Klinikai Diagnosztikai & Sürgősségi Pavilon',
  code: 'SEMMELWEIS-KLINIKA',
  address: '1082 Budapest, Üllői út 78.',
  colorAccent: '#B91C1C',
  floors: [
    {
      id: 'floor-sote-f0',
      buildingId: 'bld-sote-main',
      level: 0,
      name: 'Földszint (Sürgősségi & Betegfelvétel)',
      shortCode: 'FSZ',
      elevationMeters: 0.0,
      width: 1000,
      height: 720,
      rooms: semmelweisF0_Rooms,
      walls: semmelweisF0_Walls,
      doors: semmelweisF0_Doors,
      transitConnectors: semmelweisF0_Transit,
      pois: semmelweisF0_POIs,
      navNodes: semmelweisF0_Nodes,
      navEdges: semmelweisF0_Edges,
    },
    {
      id: 'floor-sote-f1',
      buildingId: 'bld-sote-main',
      level: 1,
      name: '1. Emelet (Képalkotó Diagnosztika & ITO)',
      shortCode: '1.EM',
      elevationMeters: 4.2,
      width: 1000,
      height: 720,
      rooms: semmelweisF1_Rooms,
      walls: semmelweisF1_Walls,
      doors: semmelweisF1_Doors,
      transitConnectors: semmelweisF1_Transit,
      pois: semmelweisF1_POIs,
      navNodes: semmelweisF1_Nodes,
      navEdges: semmelweisF1_Edges,
    },
  ],
};

// -------------------------------------------------------------
// 3. INTÉZMÉNY: SZEGEDI TUDOMÁNYEGYETEM (SZEGED)
// -------------------------------------------------------------

const szteF0_Rooms: Room[] = [
  {
    id: 'room-szte-f0-admin',
    floorId: 'floor-szte-f0',
    name: 'Dékáni Hivatal & Tanulmányi Osztály',
    code: 'SZTE-001',
    category: 'office',
    polygon: [
      { x: 100, y: 120 },
      { x: 420, y: 120 },
      { x: 420, y: 380 },
      { x: 100, y: 380 },
    ],
    doorLocation: { x: 420, y: 250 },
    navNodeId: 'node-ny-f0-admin',
    capacity: 25,
    department: 'Természettudományi és Informatikai Kar',
    occupant: 'Dr. Horváth Dezső (Dékán)',
    description: 'Hallgatói ügyintézés, felvételi és ösztöndíj tanácsadás.',
    tags: ['Akadálymentes', 'Ügyfélszolgálat'],
    colorHatch: 'rgba(26, 60, 43, 0.08)',
  },
  {
    id: 'room-szte-f0-chem',
    floorId: 'floor-szte-f0',
    name: 'Szent-Györgyi Albert Analitikai Kémia Laboratórium',
    code: 'SZTE-002',
    category: 'laboratory',
    polygon: [
      { x: 600, y: 120 },
      { x: 900, y: 120 },
      { x: 900, y: 640 },
      { x: 600, y: 640 },
    ],
    doorLocation: { x: 600, y: 380 },
    navNodeId: 'node-ny-f0-chem',
    capacity: 32,
    department: 'Szervetlen és Analitikai Kémiai Tanszék',
    occupant: 'Prof. Dr. Tóth Ágota',
    description: 'Vegyifülkék, kromatográfok, spektrofotométerek és biztonsági szemmosó.',
    tags: ['Vegyifülkék', 'Szemmosó állomás', 'Akadálymentes'],
    colorHatch: 'rgba(14, 116, 144, 0.08)',
  },
  {
    id: 'room-szte-f0-dining',
    floorId: 'floor-szte-f0',
    name: 'Bolyai Egyetemi Menza & Hallgatói Étkező',
    code: 'SZTE-003',
    category: 'cafeteria',
    polygon: [
      { x: 100, y: 410 },
      { x: 420, y: 410 },
      { x: 420, y: 640 },
      { x: 100, y: 640 },
    ],
    doorLocation: { x: 420, y: 520 },
    navNodeId: 'node-ny-f0-dining',
    capacity: 120,
    department: 'Egyetemi Szolgáltató Központ',
    occupant: 'Menza Üzemeltetés',
    description: 'Meleg étkeztetés, salátabár, diákmenü.',
    tags: ['Akadálymentes', 'Ivókút', 'Svédasztalos étkező'],
    colorHatch: 'rgba(4, 120, 87, 0.08)',
  },
];

const szteF0_Transit: TransitConnector[] = [
  {
    id: 'transit-szte-elev-f0',
    floorId: 'floor-szte-f0',
    transitGroupId: 'SHAFT-SZTE-ELEV-1',
    type: 'elevator',
    name: 'Központi Campus Lift',
    position: { x: 510, y: 220 },
    width: 44,
    height: 44,
    navNodeId: 'node-ny-f0-elev',
    isAccessible: true,
    servesFloorIds: ['floor-szte-f0', 'floor-szte-f1'],
  },
  {
    id: 'transit-szte-stair-f0',
    floorId: 'floor-szte-f0',
    transitGroupId: 'SHAFT-SZTE-STAIR-1',
    type: 'stairs',
    name: 'Főlépcsőház',
    position: { x: 510, y: 480 },
    width: 48,
    height: 48,
    navNodeId: 'node-ny-f0-stair',
    isAccessible: false,
    servesFloorIds: ['floor-szte-f0', 'floor-szte-f1'],
  },
];

const szteF0_Nodes: NavNode[] = [
  { id: 'node-ny-f0-entrance', floorId: 'floor-szte-f0', position: { x: 510, y: 670 }, type: 'corridor', label: 'Bolyai Épület Főbejárat' },
  { id: 'node-ny-f0-spine', floorId: 'floor-szte-f0', position: { x: 510, y: 380 }, type: 'hub', label: 'Földszinti Központi Aula' },
  { id: 'node-ny-f0-admin', floorId: 'floor-szte-f0', position: { x: 420, y: 250 }, type: 'door', label: 'Dékáni Hivatal (SZTE-001)', refId: 'room-szte-f0-admin' },
  { id: 'node-ny-f0-dining', floorId: 'floor-szte-f0', position: { x: 420, y: 520 }, type: 'door', label: 'Egyetemi Menza (SZTE-003)', refId: 'room-szte-f0-dining' },
  { id: 'node-ny-f0-chem', floorId: 'floor-szte-f0', position: { x: 600, y: 380 }, type: 'door', label: 'Kémia Laboratórium (SZTE-002)', refId: 'room-szte-f0-chem' },
  { id: 'node-ny-f0-elev', floorId: 'floor-szte-f0', position: { x: 510, y: 242 }, type: 'transit', label: 'Lift (Földszint)', refId: 'transit-szte-elev-f0' },
  { id: 'node-ny-f0-stair', floorId: 'floor-szte-f0', position: { x: 510, y: 480 }, type: 'transit', label: 'Főlépcső (Földszint)', refId: 'transit-szte-stair-f0' },
];

const szteF0_Edges: NavEdge[] = [
  { id: 'e-ny0-1', fromNodeId: 'node-ny-f0-entrance', toNodeId: 'node-ny-f0-spine', floorId: 'floor-szte-f0', distance: 290, isAccessible: true },
  { id: 'e-ny0-2', fromNodeId: 'node-ny-f0-spine', toNodeId: 'node-ny-f0-admin', floorId: 'floor-szte-f0', distance: 158, isAccessible: true },
  { id: 'e-ny0-3', fromNodeId: 'node-ny-f0-spine', toNodeId: 'node-ny-f0-dining', floorId: 'floor-szte-f0', distance: 166, isAccessible: true },
  { id: 'e-ny0-4', fromNodeId: 'node-ny-f0-spine', toNodeId: 'node-ny-f0-chem', floorId: 'floor-szte-f0', distance: 90, isAccessible: true },
  { id: 'e-ny0-5', fromNodeId: 'node-ny-f0-spine', toNodeId: 'node-ny-f0-elev', floorId: 'floor-szte-f0', distance: 138, isAccessible: true },
  { id: 'e-ny0-6', fromNodeId: 'node-ny-f0-spine', toNodeId: 'node-ny-f0-stair', floorId: 'floor-szte-f0', distance: 100, isAccessible: false },
];

const szteF0_Walls: Wall[] = [
  { id: 'w-ny0-1', floorId: 'floor-szte-f0', start: { x: 80, y: 100 }, end: { x: 920, y: 100 }, thickness: 4, isExterior: true },
  { id: 'w-ny0-2', floorId: 'floor-szte-f0', start: { x: 920, y: 100 }, end: { x: 920, y: 660 }, thickness: 4, isExterior: true },
  { id: 'w-ny0-3', floorId: 'floor-szte-f0', start: { x: 920, y: 660 }, end: { x: 80, y: 660 }, thickness: 4, isExterior: true },
  { id: 'w-ny0-4', floorId: 'floor-szte-f0', start: { x: 80, y: 660 }, end: { x: 80, y: 100 }, thickness: 4, isExterior: true },
  { id: 'w-ny0-5', floorId: 'floor-szte-f0', start: { x: 420, y: 100 }, end: { x: 420, y: 660 }, thickness: 3 },
  { id: 'w-ny0-6', floorId: 'floor-szte-f0', start: { x: 80, y: 395 }, end: { x: 420, y: 395 }, thickness: 3 },
  { id: 'w-ny0-7', floorId: 'floor-szte-f0', start: { x: 600, y: 100 }, end: { x: 600, y: 660 }, thickness: 3 },
];

const szteF0_Doors: Door[] = [
  { id: 'd-ny0-1', floorId: 'floor-szte-f0', start: { x: 420, y: 240 }, end: { x: 420, y: 260 }, type: 'single' },
  { id: 'd-ny0-2', floorId: 'floor-szte-f0', start: { x: 420, y: 510 }, end: { x: 420, y: 530 }, type: 'double' },
  { id: 'd-ny0-3', floorId: 'floor-szte-f0', start: { x: 600, y: 370 }, end: { x: 600, y: 390 }, type: 'double' },
];

// Szegedi Tudományegyetem 1. Emelet
const szteF1_Rooms: Room[] = [
  {
    id: 'room-szte-f1-art',
    floorId: 'floor-szte-f1',
    name: 'Digitális Média & Grafikai Műhely',
    code: 'SZTE-101',
    category: 'classroom',
    polygon: [
      { x: 100, y: 120 },
      { x: 420, y: 120 },
      { x: 420, y: 640 },
      { x: 100, y: 640 },
    ],
    doorLocation: { x: 420, y: 380 },
    navNodeId: 'node-ny-f1-art',
    capacity: 40,
    department: 'Média és Kommunikáció Tanszék',
    occupant: 'Varga Bence (Mesteroktató)',
    description: 'Digitális rajztáblák, professzionális nyomtatók, VR tesztszigetek.',
    tags: ['Digitális rajztáblák', 'Akadálymentes', 'Fotó és videó stúdió'],
    colorHatch: 'rgba(180, 83, 9, 0.08)',
  },
  {
    id: 'room-szte-f1-conservatory',
    floorId: 'floor-szte-f1',
    name: 'Kari Díszaula & Hangversenyterem',
    code: 'SZTE-102',
    category: 'auditorium',
    polygon: [
      { x: 600, y: 120 },
      { x: 900, y: 120 },
      { x: 900, y: 640 },
      { x: 600, y: 640 },
    ],
    doorLocation: { x: 600, y: 380 },
    navNodeId: 'node-ny-f1-music',
    capacity: 100,
    department: 'Kari Díszterem',
    occupant: 'Kari Ünnepségek & Konferenciák',
    description: 'Kiváló akusztikájú díszaula, Steinway hangversenyzongorával.',
    tags: ['Kiemelkedő akusztika', 'Hangversenyzongora', 'Akadálymentes'],
    colorHatch: 'rgba(109, 40, 217, 0.08)',
  },
];

const szteF1_Transit: TransitConnector[] = [
  {
    id: 'transit-szte-elev-f1',
    floorId: 'floor-szte-f1',
    transitGroupId: 'SHAFT-SZTE-ELEV-1',
    type: 'elevator',
    name: 'Központi Campus Lift',
    position: { x: 510, y: 220 },
    width: 44,
    height: 44,
    navNodeId: 'node-ny-f1-elev',
    isAccessible: true,
    servesFloorIds: ['floor-szte-f0', 'floor-szte-f1'],
  },
  {
    id: 'transit-szte-stair-f1',
    floorId: 'floor-szte-f1',
    transitGroupId: 'SHAFT-SZTE-STAIR-1',
    type: 'stairs',
    name: 'Főlépcsőház',
    position: { x: 510, y: 480 },
    width: 48,
    height: 48,
    navNodeId: 'node-ny-f1-stair',
    isAccessible: false,
    servesFloorIds: ['floor-szte-f0', 'floor-szte-f1'],
  },
];

const szteF1_Nodes: NavNode[] = [
  { id: 'node-ny-f1-spine', floorId: 'floor-szte-f1', position: { x: 510, y: 380 }, type: 'hub', label: '1. Emeleti Folyosó' },
  { id: 'node-ny-f1-art', floorId: 'floor-szte-f1', position: { x: 420, y: 380 }, type: 'door', label: 'Média Stúdió (SZTE-101)', refId: 'room-szte-f1-art' },
  { id: 'node-ny-f1-music', floorId: 'floor-szte-f1', position: { x: 600, y: 380 }, type: 'door', label: 'Kari Díszaula (SZTE-102)', refId: 'room-szte-f1-conservatory' },
  { id: 'node-ny-f1-elev', floorId: 'floor-szte-f1', position: { x: 510, y: 242 }, type: 'transit', label: 'Lift (1. emelet)', refId: 'transit-szte-elev-f1' },
  { id: 'node-ny-f1-stair', floorId: 'floor-szte-f1', position: { x: 510, y: 480 }, type: 'transit', label: 'Főlépcső (1. emelet)', refId: 'transit-szte-stair-f1' },
];

const szteF1_Edges: NavEdge[] = [
  { id: 'e-ny1-1', fromNodeId: 'node-ny-f1-spine', toNodeId: 'node-ny-f1-art', floorId: 'floor-szte-f1', distance: 90, isAccessible: true },
  { id: 'e-ny1-2', fromNodeId: 'node-ny-f1-spine', toNodeId: 'node-ny-f1-music', floorId: 'floor-szte-f1', distance: 90, isAccessible: true },
  { id: 'e-ny1-3', fromNodeId: 'node-ny-f1-spine', toNodeId: 'node-ny-f1-elev', floorId: 'floor-szte-f1', distance: 138, isAccessible: true },
  { id: 'e-ny1-4', fromNodeId: 'node-ny-f1-spine', toNodeId: 'node-ny-f1-stair', floorId: 'floor-szte-f1', distance: 100, isAccessible: false },
];

const szteF1_Walls: Wall[] = [
  { id: 'w-ny1-1', floorId: 'floor-szte-f1', start: { x: 80, y: 100 }, end: { x: 920, y: 100 }, thickness: 4, isExterior: true },
  { id: 'w-ny1-2', floorId: 'floor-szte-f1', start: { x: 920, y: 100 }, end: { x: 920, y: 660 }, thickness: 4, isExterior: true },
  { id: 'w-ny1-3', floorId: 'floor-szte-f1', start: { x: 920, y: 660 }, end: { x: 80, y: 660 }, thickness: 4, isExterior: true },
  { id: 'w-ny1-4', floorId: 'floor-szte-f1', start: { x: 80, y: 660 }, end: { x: 80, y: 100 }, thickness: 4, isExterior: true },
  { id: 'w-ny1-5', floorId: 'floor-szte-f1', start: { x: 420, y: 100 }, end: { x: 420, y: 660 }, thickness: 3 },
  { id: 'w-ny1-6', floorId: 'floor-szte-f1', start: { x: 600, y: 100 }, end: { x: 600, y: 660 }, thickness: 3 },
];

const szteF1_Doors: Door[] = [
  { id: 'd-ny1-1', floorId: 'floor-szte-f1', start: { x: 420, y: 370 }, end: { x: 420, y: 390 }, type: 'double' },
  { id: 'd-ny1-2', floorId: 'floor-szte-f1', start: { x: 600, y: 370 }, end: { x: 600, y: 390 }, type: 'double' },
];

const szteBuilding: Building = {
  id: 'bld-szte-bolyai',
  institutionId: 'inst-szte-szeged',
  name: 'Bolyai Természettudományi Központ',
  code: 'SZTE-BOLYAI',
  address: '6720 Szeged, Aradi vértanúk tere 1.',
  colorAccent: '#0E7490',
  floors: [
    {
      id: 'floor-szte-f0',
      buildingId: 'bld-szte-bolyai',
      level: 0,
      name: 'Földszint (Dékáni Hivatal & Kémia)',
      shortCode: 'FSZ',
      elevationMeters: 0.0,
      width: 1000,
      height: 720,
      rooms: szteF0_Rooms,
      walls: szteF0_Walls,
      doors: szteF0_Doors,
      transitConnectors: szteF0_Transit,
      pois: [],
      navNodes: szteF0_Nodes,
      navEdges: szteF0_Edges,
    },
    {
      id: 'floor-szte-f1',
      buildingId: 'bld-szte-bolyai',
      level: 1,
      name: '1. Emelet (Média Stúdió & Díszaula)',
      shortCode: '1.EM',
      elevationMeters: 4.5,
      width: 1000,
      height: 720,
      rooms: szteF1_Rooms,
      walls: szteF1_Walls,
      doors: szteF1_Doors,
      transitConnectors: szteF1_Transit,
      pois: [],
      navNodes: szteF1_Nodes,
      navEdges: szteF1_Edges,
    },
  ],
};

// -------------------------------------------------------------
// ÖSSZES ALAPÉRTELMEZETT INTÉZMÉNY
// -------------------------------------------------------------

export const DEFAULT_INSTITUTIONS: Institution[] = [
  {
    id: 'inst-bme-budapest',
    name: 'BME - Budapesti Műszaki és Gazdaságtudományi Egyetem',
    type: 'university',
    city: 'Budapest',
    country: 'Magyarország',
    address: '1117 Budapest, Magyar tudósok körútja 2.',
    coordinates: {
      lat: 47.4729,
      lng: 19.0598,
    },
    description: 'Magyarország vezető műszaki felsőoktatási intézménye, modern informatikai és robotikai kutatóközponttal.',
    buildings: [bmeBuildingI],
  },
  {
    id: 'inst-semmelweis-bp',
    name: 'Semmelweis Egyetem - Klinikai Központ',
    type: 'hospital',
    city: 'Budapest',
    country: 'Magyarország',
    address: '1082 Budapest, Üllői út 78.',
    coordinates: {
      lat: 47.4875,
      lng: 19.0783,
    },
    description: 'Közép-Európa kiemelkedő orvos- és egészségtudományi egyetemi klinikája modern sürgősségi és diagnosztikai pavilonnal.',
    buildings: [semmelweisBuilding],
  },
  {
    id: 'inst-szte-szeged',
    name: 'Szegedi Tudományegyetem - TTIK',
    type: 'school',
    city: 'Szeged',
    country: 'Magyarország',
    address: '6720 Szeged, Aradi vértanúk tere 1.',
    coordinates: {
      lat: 46.2483,
      lng: 20.1472,
    },
    description: 'Nobel-díjas tradíciókkal rendelkező egyetemi campus modern analitikai kémiai és média műhelyekkel.',
    buildings: [szteBuilding],
  },
];
