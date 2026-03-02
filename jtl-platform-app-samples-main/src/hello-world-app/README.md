# ![JTL logo](https://avatars.githubusercontent.com/u/31404730?s=25&v=4) JTL-Platform Sample Hello World App

## ⚡️ Prerequisites

- Build the `js-core` package in `src/sdk/js-core` with `yarn build`. This is the `@jtl-software/cloud-apps-core` package
- Run `yarn install` on repository root to dependencies

## 🛠️ Development

- Run `yarn dev` to start the monorepo

## 🔌 Ports

This is a mono-repo, both backend and frontend is expected to start from one machine

| Port  | Protocol | Service   |
| ----- | -------- | --------- |
| 50143 | HTTP     | API Main  |
| 50142 | HTTPS    | React App |

## Environment specific Secrets & Variables

These are the environment variables that have to be added in the `packages/backend` for the project to start.

| Name              | Description                                        | Type       |
| ----------------- | -------------------------------------------------- | ---------- |
| `CLIENT_ID`       | The ClientID of the Sample App                     | `Variable` |
| `CLIENT_SECRET`   | The Client Scret of the Sample App                 | `Secret`   |
| `API_ENVIRONMENT` | The enviroment of the API (defaults to production) | `Variable` |
