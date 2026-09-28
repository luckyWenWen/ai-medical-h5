# HTTP/HTTPS mode

This project supports both HTTP and HTTPS entry points.

## Local development

HTTP:

```bash
npm run dev:http
```

Default URL:

```text
http://localhost:5183
http://<LAN-IP>:5183
```

HTTPS:

```bash
npm run dev:https
```

Default URL:

```text
https://localhost:5184
https://<LAN-IP>:5184
```

The HTTPS server reads:

```env
VITE_DEV_HTTPS_KEY=.certs/dev-key.pem
VITE_DEV_HTTPS_CERT=.certs/dev-cert.pem
```

## API and ASR proxy

The browser uses same-origin paths:

```env
VITE_API_BASE_URL=/api
VITE_ASR_WS_URL=/ws/asr
```

Vite proxies them to the real services:

```env
VITE_API_PROXY_TARGET=http://192.168.1.88:9120/
VITE_ASR_PROXY_TARGET=ws://192.168.2.43:8000
```

This keeps HTTPS pages from opening mixed-content `ws://` connections directly.

## Microphone rule

Browsers only allow microphone access in a secure context:

- `https://...`
- `http://localhost`
- `http://127.0.0.1`

`http://<LAN-IP>` can still open the app, but recording will be blocked by the browser.

## Production

Build once and serve the same `dist` from both port 80 and port 443 if both modes must remain available. See `deploy/nginx-http-https.conf` for an example with `/api` and `/ws` proxy rules.

Local HTTPS preview uses:

```bash
npm run preview:https
```

Default URL:

```text
https://localhost:4174
```
