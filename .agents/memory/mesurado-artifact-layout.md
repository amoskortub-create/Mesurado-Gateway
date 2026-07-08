---
name: Mesurado artifact layout
description: Where each service lives, ports, and artifact IDs after the Vercel-to-Replit port.
---

## Frontend
- Path: `artifacts/mesurado-dashboard/`
- Artifact ID: `artifacts/mesurado-dashboard`
- Port: 22802, previewPath: `/`
- Workflow: `artifacts/mesurado-dashboard: web`
- Stack: Vite + React 19, wouter routing, TailwindCSS v4, shadcn/ui, Recharts

## API Server
- Path: `artifacts/api-server/`
- Artifact ID: `3B4_FFSkEVBkAeYMFRJ2e`
- Port: 8080, paths: `/api`, `/v1`
- Workflow: `artifacts/api-server: API Server`
- Stack: Express 5, Appwrite (auth + DB), esbuild bundle

## Canvas / Mockup Sandbox
- Path: `artifacts/mockup-sandbox/`
- Artifact ID: `XegfDyZt7HqfW2Bb8Ghoy`
- Port: 8081, previewPath: `/__mockup`
- Workflow: `artifacts/mockup-sandbox: Component Preview Server`

## Stale duplicates (do not start)
- `.migration-backup/artifacts/*` — original Vercel export; workflows registered but NOT_STARTED by design.

**Why:** During the Vercel→Replit port, createArtifact picked up artifact.toml files from .migration-backup/ and registered duplicate workflows. The real services are the ones in `artifacts/` above.

**How to apply:** If a workflow for .migration-backup/* appears in the workflow list, ignore it — only start workflows under `artifacts/`.
