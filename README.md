# ARCHIPATH // Technical Blueprint Floorplan & Multi-Campus Wayfinding Studio

**ARCHIPATH** is a high-performance, web-only architectural CAD and wayfinding route planning platform designed for multi-floor educational institutions, university campuses, research facilities, and medical complexes across multiple cities.

Built around a technical blueprint design system featuring a minimalist mosaic grid, forest green (`#1A3C2B`) and light-gray paper-textured (`#F7F7F5`) palette, editorial typography with **Space Grotesk** and **JetBrains Mono**, bento grid telemetry HUDs, and 2D flat wireframe aesthetics with zero shadows.

---

## Key Features

### 1. Multi-Campus & Multi-Floor Spatial Hierarchy
- **Institutions in Different / Same Cities**:
  - *Nexus Institute of Technology* (Zürich, Switzerland)
  - *St. Jude Metropolitan Health Institute* (London, UK)
  - *Kensington Global Academy* (New York, USA)
- **Hierarchical Navigation**: Institution ➔ Building ➔ Level (Elevation in meters, gross floor area, room density).
- **Interactive Elevation Stack**: 2D vertical building cutaway selector showing real-time route elevation transitions.

### 2. Multi-Floor A* Pathfinding & Route Planner
- **Multi-Level Wayfinding**: Calculates shortest obstacle-free paths across corridors and vertical transit shafts (elevators, stairs, ramps).
- **Accessibility Modes**:
  - *Step-Free / Wheelchair Accessible* (enforces elevator-only routing).
  - *Elevator Priority* (prefers lifts over stairwells).
  - *Fastest Path*.
- **Turn-by-Turn Guidance**: Distance (meters), floor changes (`Take Elevator UP to Level 2`), directional turns, and walking time estimates.
- **Walkthrough Simulation Player (`▶ SIMULATE`)**: Real-time 2D animated avatar moving along the route with automatic floor level transitions.
- **Shareable Routes & QR Code Dispatch**: Deep-link URL parameters (`?inst=...&bld=...&start=...&dest=...`) and QR code modal for mobile visitors.
- **Lobby Touchscreen Kiosk Mode**: Immersive full-screen terminal interface for visitors and students.

### 3. CAD Studio & Floorplan Architect
- **Vector Architectural Canvas**:
  - Pan & Zoom (mouse wheel, touch pinch, mini-map navigator, 1:100 scale bar, true north compass rose).
  - Layer toggles (Walls, Rooms, Doors, Transit Shafts, POIs, Walkable Nav Mesh, Coordinate Dimensions, Grid).
- **Design Tools**:
  - *Room Box Tool*: Rectangular space builder with live square-meter calculation.
  - *Wall Tool*: Structural and partition walls.
  - *Door Placement*: Single, double, sliding, security airlocks.
  - *Vertical Transit Hubs*: Place elevators & stairwells with shared Shaft IDs to automatically link multi-floor navigation graphs.
  - *Amenities & POIs*: Accessible restrooms, water fountains, defibrillators (AED), first aid stations, coffee spots, reception.
  - *Auto-Generate Nav Mesh*: Instantly builds walkable corridor networks connecting all doors and transit shafts.
  - *Tape Measure Tool*: Interactive distance dimension tool with millimeter CAD precision.

### 4. Campus Spatial Directory
- Searchable index matrix (⌘K / Ctrl+K) filtering by room category, department, faculty occupant, amenities, and keywords with 1-click "Navigate Here" or "Start Here".

---

## Design System Specifications
- **Primary Forest Green**: `#1A3C2B`
- **Paper Background**: `#F7F7F5`
- **Subtle Wireframe Borders**: `#D0D0C7` / `#1A3C2B`
- **Accent Palette**: Deep Cyan (`#0E7490`), Crimson (`#B91C1C`), Emerald (`#047857`), Amber (`#B45309`)
- **Typography**:
  - Display / Headings / Room Titles: *Space Grotesk*
  - Technical Labels / Elevation / Codes / Coordinates: *JetBrains Mono*
- **Zero Shadows**: Crisp 1px vector line work and flat 2D bounding boxes.

---

## Getting Started

```bash
# Install dependencies
npm install

# Start Vite development server
npm run dev

# Build production bundle
npm run build

# Preview production build
npm run preview
```
