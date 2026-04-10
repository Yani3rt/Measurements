# The Atelier

The Atelier is a Vite + React measurement reference app for managing family clothing measurements. It lets you create profiles, switch between front and back body views, select measurement points on a technical diagram, and edit values with an integrated ruler and a local SQLite-backed data service.

## Features

- Create, edit, and delete family profiles
- Store height, sex, and measurement data per profile
- Switch between front and back measurement views
- Edit measurements in `cm` or `in`
- Persist data in a local SQLite database

## Run locally

```bash
pnpm install
pnpm dev
```

`pnpm dev` starts both the Vite app and the local Express + SQLite data service.

- App: `http://localhost:3000`
- API: `http://localhost:3101`

The SQLite file is created automatically at `data/the-atelier.sqlite`.

## Available scripts

```bash
pnpm dev
pnpm dev:client
pnpm dev:server
pnpm server
pnpm build
pnpm preview
pnpm lint
```

## Notes

- The local data service is required; the UI will block if the API is offline
- There is currently no `test` script in `package.json`
