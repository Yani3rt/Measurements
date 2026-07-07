# The Atelier

The Atelier is a locally hosted Vite + React measurement reference app for managing family clothing measurements. It lets you create profiles, switch between front and back body views, select measurement points on a technical diagram, and edit values with an integrated ruler.

The app runs entirely from your machine. The React frontend talks to a small local Node data service, and that service stores profile data in a local SQLite file.

## Features

- Create, edit, and delete family profiles
- Store height, sex, and measurement data per profile
- Track historical changes for profile heights and saved measurements in SQLite
- Review a profile-wide fitting timeline with latest measurement deltas
- Switch between front and back measurement views
- Edit measurements in `cm` or `in`
- Run the frontend and local data service with one command

## Local data storage

The local database file is created automatically at:

```text
data/the-atelier.sqlite
```

The `data/` folder is ignored by Git, so local measurements stay on your machine and are not committed to the public repository.

## Run locally

Install dependencies once:

```bash
pnpm install
```

Copy the local environment template if you do not already have a `.env` file:

```bash
cp .env.example .env
```

Start the app:

```bash
pnpm dev
```

`pnpm dev` starts both services:

- App: `http://localhost:3000`
- Local data service: `http://127.0.0.1:3101`

Open the app in your browser at:

```text
http://localhost:3000/
```

## Environment

The only environment value is the local API port:

```env
DATA_SERVICE_PORT=3101
```

You usually do not need to change it. If you do change it, restart `pnpm dev`.

## Available scripts

```bash
pnpm dev          # run Vite and the local data service together
pnpm dev:client   # run only the Vite frontend
pnpm dev:server   # run only the local data service in watch mode
pnpm server       # run only the local data service
pnpm build        # create a production frontend build
pnpm preview      # preview the production frontend build
pnpm lint         # run TypeScript checks
pnpm test         # run the Node/TypeScript test suite
```

## Notes

- This version is designed for one local user.
- The app stores data in the local SQLite file listed above.
- No hosted services or secrets are needed to run the app.
