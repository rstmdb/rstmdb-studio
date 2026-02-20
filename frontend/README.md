# rstmdb Studio Frontend

React-based web UI for rstmdb Studio built with TypeScript, Vite, and Tailwind CSS.

## Tech Stack

- React 19 with React Router
- TypeScript 5.9
- Vite 7
- Tailwind CSS 4
- TanStack React Query for data fetching
- Monaco Editor for JSON editing
- React Flow (@xyflow/react) for the state machine builder
- Dagre for automatic graph layout
- Lucide for icons

## Development

```bash
npm install
npm run dev
```

The dev server starts at `http://localhost:5173` and proxies `/api` requests to the backend at `http://localhost:8080`.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start Vite dev server with HMR |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build |
| `npm run lint` | Run ESLint |
| `npm run type-check` | Run TypeScript type checking |

## Structure

```
src/
├── components/
│   ├── Layout.tsx              # App shell layout
│   ├── guard-builder/          # Guard condition builder
│   └── machine-builder/        # Visual state machine editor
│       ├── canvas/             # React Flow canvas
│       ├── edges/              # Transition edge components
│       ├── hooks/              # Builder state hooks
│       ├── nodes/              # State node components
│       └── panels/             # Properties & toolbar panels
├── lib/
│   ├── api.ts                  # API client
│   └── machine-builder/        # Builder types & layout logic
└── pages/
    ├── LoginPage.tsx           # Authentication
    ├── DashboardPage.tsx       # Overview
    ├── MachinesPage.tsx        # Machine list
    ├── MachineDetailPage.tsx   # Machine versions & builder
    ├── CreateMachinePage.tsx   # New machine creation
    ├── InstancesPage.tsx       # Instance list
    ├── InstanceDetailPage.tsx  # Instance state & history
    └── WalPage.tsx             # WAL explorer
```
