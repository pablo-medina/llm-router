# llm-router

A Node.js service that routes LLM traffic to configured providers (OpenAI-compatible APIs) per **agent**. Clients talk to a small HTTP API; API keys and provider URLs stay on the server.

## Documentation

- **[HTTP API reference](docs/API.md)** — endpoints, request/response shapes, `curl` examples, privacy notes, and tips for large payloads / Windows.

## Requirements

- **Node.js** ≥ 24.14.1 (see `package.json`).

## Install and run

```bash
npm install
npm run build
npm start
```

Development with auto-reload:

```bash
npm run dev
```

## Configuration

- Default config file: **`config/default.yaml`** (repository default targets local [LM Studio](https://lmstudio.ai/) at `http://127.0.0.1:1234/v1`).
- Override path: environment variable **`LLM_ROUTER_CONFIG`** pointing to another YAML file.
- Listen port: **`server.port`** in YAML, or **`PORT`** in the environment (wins over YAML).

See comments inside `config/default.yaml` for driver and agent fields.

## Quick API smoke test

With the server listening on port **9400** and agent **`default`** defined in config:

```bash
curl -s http://127.0.0.1:9400/health
curl -s http://127.0.0.1:9400/api/agents
curl -s -X POST http://127.0.0.1:9400/api/agents/default/chat \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Say hi in one short sentence."}'
```

More examples (multimodal chat, image analysis, error codes) are in **[docs/API.md](docs/API.md)**.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Compile TypeScript to `dist/`. |
| `npm start` | Run `node dist/index.js`. |
| `npm run dev` | Run `tsx watch src/index.ts`. |
| `npm run test:driver` | CLI smoke test against env-configured OpenAI-compatible base URL (see `src/cli/test-driver.ts`). |

## License

MIT
