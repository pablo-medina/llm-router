# HTTP API reference

`llm-router` exposes a small JSON API. All agent routes are mounted under **`/api`**.

- **Request bodies:** `Content-Type: application/json` (JSON object).
- **JSON size limit:** 10 MB (large base64 images count toward this limit).

## Privacy and client-facing data

Responses **do not** include:

- Provider API keys or headers
- Driver base URLs or internal driver identifiers
- The raw upstream provider payload (`raw` is stripped before responding)

The **list agents** endpoint only returns each agent’s `name` and `description`. Chat responses return normalized assistant text, optional `usage` token counts, and provider `id` / `model` fields when present—never credentials.

---

## Service endpoints (not under `/api`)

### `GET /health`

Liveness check for load balancers and monitors.

**Response** `200` — body:

```json
{
  "status": "ok",
  "service": "llm-router",
  "version": "0.1.0"
}
```

### `GET /`

Minimal service metadata.

**Response** `200` — body:

```json
{
  "service": "llm-router",
  "version": "0.1.0"
}
```

---

## Agent API (`/api`)

Replace `BASE` with your server URL (default listen port from config: **9400**), e.g. `http://127.0.0.1:9400`.

Replace `AGENT` with a configured agent name (e.g. `default` from `config/default.yaml`).

### `GET /api/agents`

Returns all configured agents. Names must match the `:agentName` path parameter on chat routes.

**Response** `200` — body:

| Field | Type | Description |
|-------|------|-------------|
| `agents` | `array` | Ordered list of agents. |

Each element:

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Unique agent name. |
| `description` | `string` | Human-readable description. |

**Example**

```bash
curl -s "${BASE}/api/agents"
```

---

### `POST /api/agents/:agentName/chat`

Runs a chat completion for the given agent. The router forwards the request to the provider configured for that agent (e.g. OpenAI-compatible API).

You must supply **either**:

- **`prompt`** — non-empty string (shorthand for a single user message), or  
- **`messages`** — non-empty array of chat messages (see [Message structure](#message-structure)).

Do **not** send both as conflicting sources of truth; if `messages` is present, `prompt` is ignored.

**Optional body fields**

| Field | Type | Description |
|-------|------|-------------|
| `model` | `string` | Overrides the driver default model for this request. |
| `temperature` | `number` | Sampling temperature. |
| `maxTokens` | `number` | Max tokens for the completion (sent as `max_tokens` upstream). |

**Response** `200` — [Chat completion response](#chat-completion-response).

**Errors**

| Status | Body | When |
|--------|------|------|
| `400` | `{ "error": "..." }` | Invalid JSON, missing `prompt`/`messages`, or invalid message shape. |
| `404` | `{ "error": "..." }` | Unknown `agentName`. |
| `502` | `{ "error": "..." }` | Upstream provider error or network failure (message is sanitized—no secrets). |

#### Simple prompt (curl)

```bash
curl -s -X POST "${BASE}/api/agents/${AGENT}/chat" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Say hello in one short sentence."}'
```

#### Messages with roles

```bash
curl -s -X POST "${BASE}/api/agents/${AGENT}/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      { "role": "system", "content": "You reply in one sentence." },
      { "role": "user", "content": "What is 2+2?" }
    ],
    "temperature": 0.3
  }'
```

#### Multimodal user message (text + image URL or data URL)

Useful when your model supports vision. `content` may be a string or an array of [content parts](#content-parts).

```bash
curl -s -X POST "${BASE}/api/agents/${AGENT}/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": [
          { "type": "text", "text": "What is in this image?" },
          { "type": "image_url", "image_url": { "url": "https://example.com/image.jpg" } }
        ]
      }
    ]
  }'
```

Data URL (base64) example—keep payloads small or use a file (see [Large JSON and Windows](#large-json-and-windows)):

```bash
curl -s -X POST "${BASE}/api/agents/${AGENT}/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "user",
        "content": [
          { "type": "text", "text": "Describe the image." },
          { "type": "image_url", "image_url": { "url": "data:image/png;base64,iVBORw0KGgo..." } }
        ]
      }
    ]
  }'
```

---

### `POST /api/agents/:agentName/analyze-images`

Convenience endpoint for vision: builds a single **user** message from a text prompt plus one or more images. Equivalent to calling **`/chat`** with a multimodal `messages` array.

**Body fields**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `prompt` | `string` | No | User instruction; default if omitted: `"Describe the image(s)."` |
| `images` | `array` | Yes | Non-empty list of image descriptors (see below). |
| `model` | `string` | No | Same as chat. |
| `temperature` | `number` | No | Same as chat. |
| `maxTokens` | `number` | No | Same as chat. |

Each **`images[]`** element must include **either**:

- **`url`** — non-empty string (`http(s)://...` or an already-formed `data:image/...;base64,...` URL), or  
- **`base64`** — raw base64 payload (no `data:` prefix). With `base64`, you may set **`mimeType`** (default `image/jpeg`).

**Response** `200` — same as [Chat completion response](#chat-completion-response).

**Errors** — same pattern as chat (`400`, `404`, `502`).

**Example (base64)**

```bash
curl -s -X POST "${BASE}/api/agents/${AGENT}/analyze-images" \
  -H "Content-Type: application/json" \
  -d "{\"prompt\":\"What is in this image?\",\"images\":[{\"base64\":\"YOUR_BASE64\",\"mimeType\":\"image/png\"}]}"
```

**Example (image URL)**

```bash
curl -s -X POST "${BASE}/api/agents/${AGENT}/analyze-images" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Describe the scene.","images":[{"url":"https://example.com/photo.jpg"}]}'
```

---

## Data structures

### Message structure

Each message object:

| Field | Type | Description |
|-------|------|-------------|
| `role` | `string` | One of: `system`, `user`, `assistant`. |
| `content` | `string` or `array` | Plain text, or an array of [content parts](#content-parts) for multimodal messages. |

### Content parts

Used when `content` is an array (OpenAI-compatible shape).

**Text part**

```json
{ "type": "text", "text": "Your text here." }
```

**Image part**

```json
{
  "type": "image_url",
  "image_url": {
    "url": "https://... or data:image/png;base64,...",
    "detail": "low"
  }
}
```

`detail` is optional; when present it must be one of: `low`, `high`, `auto`.

### Chat completion response

Returned by **`POST .../chat`** and **`POST .../analyze-images`** on success:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Optional provider completion id. |
| `model` | `string` | Model id used by the provider. |
| `choices` | `array` | One or more choices (typically one). |
| `usage` | `object` | Optional token usage (see below). |

Each **`choices[]`** element:

| Field | Type | Description |
|-------|------|-------------|
| `index` | `number` | Choice index. |
| `message` | `object` | `{ "role": "assistant", "content": "<string>" }` — assistant text only in the public API. |
| `finishReason` | `string` or `null` | Provider stop reason when available. |

**`usage`** (when provided by the provider):

| Field | Type |
|-------|------|
| `promptTokens` | `number` (optional) |
| `completionTokens` | `number` (optional) |
| `totalTokens` | `number` (optional) |

---

## Large JSON and Windows

Long one-line JSON is awkward in **cmd.exe** because of escaping rules. Prefer a payload file:

**`payload.json`**

```json
{
  "prompt": "Hello",
  "temperature": 0.5
}
```

```bash
curl -s -X POST "${BASE}/api/agents/${AGENT}/chat" \
  -H "Content-Type: application/json" \
  --data-binary @payload.json
```

On **Windows**, if `curl` is aliased to PowerShell’s `Invoke-WebRequest`, call the real binary explicitly:

```text
curl.exe -s -X POST ...
```

---

## Example session

```bash
export BASE=http://127.0.0.1:9400
export AGENT=default

curl -s "${BASE}/health"
curl -s "${BASE}/api/agents"
curl -s -X POST "${BASE}/api/agents/${AGENT}/chat" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Reply with the word pong."}'
```

Ensure your provider (e.g. LM Studio) is running and that `config/default.yaml` defines at least one agent if you expect **`/api/agents`** to be non-empty and chat to succeed.
