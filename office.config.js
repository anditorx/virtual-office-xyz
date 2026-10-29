// ============================================================================
// VIRTUAL OFFICE CONFIGURATION
// Edit this file to customize your virtual office!
// No coding knowledge needed — just change the values below.
// ============================================================================

export default {

  // ── Branding ──────────────────────────────────────────────────────────────
  title: "VIRTUAL OFFICE",
  subtitle: "Interactive 3D Office Tour",
  tip: "Press Tab to open phone. All features accessible from your phone without walking.",

  // ── Room Layout ───────────────────────────────────────────────────────────
  // Room is centered at (0,0). X = left/right, Z = front/back.
  room: {
    width: 26,          // total width (meters)
    depth: 18,          // total depth (meters)
    wallHeight: 2.7,
    wallColor: "#d6b68c",
    accentWallColor: "#e6c349",   // right wall accent
    floorColor: "#43454a",
  },

  // ── Windows (back wall) ───────────────────────────────────────────────────
  windows: [
    { from: -12.8, to: 8.3, sillHeight: 0.45, headHeight: 2.45 },
  ],

  // ── Doors ─────────────────────────────────────────────────────────────────
  doors: [
    { wall: "front", x: 6.2, width: 1.6 },
  ],

  // ── Desk Rows (long shared tables) ────────────────────────────────────────
  // Each row has seats on both sides (Left/Right). Seats numbered 0-4 per side.
  deskRows: [
    { id: "T1", x: -9.0,  z: -1.7, length: 10.6 },
    { id: "T2", x: -4.2,  z: -1.7, length: 10.6 },
    { id: "T3", x:  0.6,  z: -1.7, length: 10.6 },
    { id: "T4", x:  5.1,  z: -1.7, length: 10.6 },
    { id: "T5", x:  9.8,  z: -1.7, length: 10.6 },
  ],

  // ── Head Desks (individual desks along back wall) ─────────────────────────
  headDesks: [
    { id: "H1", label: "Desk 1", x:  6.2, z: 7.25, width: 3 },
    { id: "H2", label: "Desk 2", x:  1.6, z: 7.25, width: 3 },
    { id: "H3", label: "Desk 3", x: -3.6, z: 7.25, width: 3 },
    { id: "H4", label: "Desk 4", x: -8.3, z: 7.25 },
    { id: "H5", label: "Desk 5", x: -10.9, z: 7.25 },
  ],

  // ── Furniture ─────────────────────────────────────────────────────────────
  furniture: {
    locker:       { x: -12.55, z: -2.4, label: "Locker" },
    bookshelf:    { x: -12.6,  z:  2.7, label: "Bookshelf" },
    serverRack:   { x: -12.55, z:  5.6, label: "Server Rack" },
    coffeeStation:{ x:  12.4,  z: -8.45, label: "Coffee Station" },
    shoeRack:     { x:  12.75, z: -1.65, label: "Shoe Rack" },
    printer:      { x:  12.6,  z:  3.75, label: "Printer" },
    roundTable:   { x:  11.3,  z:  6.7, label: "Meeting Area" },
    guitars:      { x:  13.7,  z:  7.8, label: "Guitars" },
  },

  // ── TVs (mounted on front wall) ───────────────────────────────────────────
  tvs: [
    { id: "tv0", x: -9.5, label: "TV 1 — Dashboard",   content: "dashboard" },
    { id: "tv1", x: -4.7, label: "TV 2 — Status",      content: "status" },
    { id: "tv2", x: -0.3, label: "TV 3 — Monitoring",  content: "monitoring" },
    { id: "tv3", x:  3.7, label: "TV 4 — Alerts",      content: "alerts" },
  ],

  // ── Whiteboards (below TVs) ───────────────────────────────────────────────
  whiteboards: [
    { id: "wb0", x: -4.7, title: "REQUIREMENTS",  notes: ["Feature A", "Feature B", "Bugfix", "Refactor"] },
    { id: "wb1", x: -0.3, title: "SPRINT BOARD",  notes: ["Todo", "In Progress", "Review", "Done"] },
    { id: "wb2", x:  3.7, title: "QA CHECKLIST",  notes: ["Module 1 ✓", "Module 2 ✓", "Module 3…", "Module 4…"] },
  ],

  // ── People (NPCs) ────────────────────────────────────────────────────────
  // Seat format: "T1.R0" = Table 1, Right side, seat 0
  //              "H1"    = Head desk 1
  people: [
    { name: "Alice Chen",     role: "Lead Engineer",      seat: "H1", shirt: "#b0476a", status: "📊 Analyzing data" },
    { name: "Bob Martinez",   role: "Tech Lead",          seat: "H2", shirt: "#6d4c3a", status: "📂 Reviewing PRs" },
    { name: "Carol Park",     role: "Division Head",      seat: "H3", shirt: "#20242c", status: "📈 Reading reports", hair: "#555" },
    { name: "David Kim",      role: "Delivery Lead",      seat: "H4", shirt: "#e9e4d8", status: "🧩 Release prep", pants: "#1f2330" },
    { name: "Eve Tanaka",     role: "Operations Lead",    seat: "H5", shirt: "#3d5a80", status: "🛠 Monitoring ops" },
    { name: "Frank",          role: "Software Engineer",  seat: "T5.R0", shirt: "#3f7cc4", status: "🔨 Feature branch" },
    { name: "Grace",          role: "Software Engineer",  seat: "T5.R1", shirt: "#c4573f", status: "🔨 Bug fix" },
    { name: "Hank",           role: "Senior Engineer",    seat: "T5.R2", shirt: "#2f3e46", status: "👀 Code review" },
    { name: "Iris",           role: "Security Engineer",  seat: "T5.R3", shirt: "#1f1f24", status: "🛡 Security scan" },
    { name: "Jake",           role: "DevOps Engineer",    seat: "T5.R4", shirt: "#4a5468", status: "🚀 Deploying" },
    { name: "Kara",           role: "Technical Writer",   seat: "T5.L0", shirt: "#8a6fb0", status: "📝 Documentation", hijab: "#e9d7c0" },
    { name: "Leo",            role: "Software Engineer",  seat: "T5.L1", shirt: "#2aa3a0", status: "🔨 Frontend work" },
    { name: "Mia",            role: "Senior Engineer",    seat: "T5.L2", shirt: "#5a9e5a", status: "👀 Review MR" },
    { name: "Nick",           role: "Software Engineer",  seat: "T4.R0", shirt: "#d08a2a", status: "🔨 API work" },
    { name: "Olivia",         role: "QA Lead",            seat: "T3.L0", shirt: "#6b8f3a", status: "🧪 Testing" },
    { name: "Pat",            role: "Project Manager",    seat: "T1.L2", shirt: "#c98a3c", status: "📅 Sprint planning", hijab: "#3d5a80" },
  ],

  // ── Player (you) ──────────────────────────────────────────────────────────
  player: {
    name: "Visitor",
    shirt: "#2a7a5a",
    pants: "#2b2f3a",
    seat: "T5.R3",    // your assigned desk (golden ring marker)
    start: [6.2, -8], // [x, z] spawn position (near the door)
  },

  // ── Panels (what shows when interacting with objects) ─────────────────────
  // You can add custom HTML content for each interactive object.
  // Built-in panel types: "info", "chat", "list", "custom"
  panels: {
    locker:        { title: "Locker",         body: "Personal storage. Configure integrations and tokens here." },
    bookshelf:     { title: "Documentation",  body: "Team documentation and knowledge base." },
    serverRack:    { title: "Infrastructure",  body: "Server status and system health." },
    coffeeStation: { title: "Coffee Corner",  body: "Take a break! ☕" },
    printer:       { title: "Printer",        body: "Print reports and export logs." },
    roundTable:    { title: "Meeting Room",   body: "Team discussions and standups." },
    guitars:       { title: "Guitars",        body: "Easter egg! Press E to play 🎸" },
    shoeRack:      { title: "Appearance",     body: "Customize your character." },
  },

  // ── Dance NPCs (who can JJ/dance with you) ───────────────────────────────
  dancers: ["Kara", "Leo"],

  // ── Advanced ──────────────────────────────────────────────────────────────
  // Day/night cycle follows your real clock. Override with T key in-game.
  // Fire extinguisher (APAR) and incident fire are included by default.
  enableFire: true,
  enableDayNight: true,
  enableCityscape: true,
  enableGuitarEasterEgg: true,
}
