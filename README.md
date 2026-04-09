# The Atelier

The Atelier is a Vite + React measurement reference app for managing family clothing measurements. It lets you create profiles, switch between front and back body views, select measurement points on a technical diagram, and edit values with an integrated ruler and local profile storage.

## Features

- Create, edit, and delete family profiles
- Store height, sex, and measurement data per profile
- Switch between front and back measurement views
- Edit measurements in `cm` or `in`
- Save data locally in the browser

## Run locally

```bash
pnpm install
pnpm dev
```

The dev server runs on `http://localhost:3000`.

## Available scripts

```bash
pnpm dev
pnpm build
pnpm preview
pnpm lint
```

## Notes

- Profile data is stored in browser local storage
- There is currently no `test` script in `package.json`
