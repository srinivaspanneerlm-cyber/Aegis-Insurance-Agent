# NGINX edge — Aegis AI

The single public entry point for the production stack. Terminates HTTP(S),
reverse-proxies to the frontend and backend, compresses responses, rate-limits
per IP, sets security headers, and keeps the **advisor SSE stream** and
**socket.io** paths working (no buffering / WebSocket upgrade).

## Files
| File | Role |
|---|---|
| `nginx.conf` | Main config: gzip, rate-limit zones, upstreams, WS-upgrade map |
| `conf.d/aegis.conf` | Active `:80` server — reverse proxy + ACME challenge + `/healthz` |
| `conf.d/tls.conf.disabled` | HTTPS `:443` server — enable after certs exist |

## Routing
| Path | Upstream | Notes |
|---|---|---|
| `/` | `frontend:3000` | Next.js standalone |
| `/_next/static/` | `frontend:3000` | `Cache-Control: immutable` |
| `/api/` | `backend:5000` | rate-limited (`api` zone) |
| `/api/chat/stream` | `backend:5000` | **SSE — proxy_buffering off**, 1h read timeout |
| `/socket.io/` | `backend:5000` | WebSocket upgrade + long-polling |
| `/.well-known/acme-challenge/` | `/var/www/certbot` | cert issuance/renewal |
| `/healthz` | nginx | edge liveness (compose healthcheck) |

Behind this proxy the browser is same-origin, so the frontend is built with
`NEXT_PUBLIC_API_URL=/api` (relative).

## Enabling HTTPS (Let's Encrypt / certbot)

1. Point DNS at the host and publish `80` (already) and `443`.
2. Issue a cert with the webroot challenge:
   ```bash
   docker run --rm \
     -v aegis_certbot_www:/var/www/certbot \
     -v aegis_letsencrypt:/etc/letsencrypt \
     certbot/certbot certonly --webroot -w /var/www/certbot \
     -d app.example.com -m ops@example.com --agree-tos --no-eff-email
   ```
   (mount the same volumes nginx uses; see `docker-compose.prod.yml`).
3. In `conf.d/tls.conf.disabled`: set `DOMAIN`, then `mv tls.conf.disabled tls.conf`.
4. In `conf.d/aegis.conf`: change the `:80` `location /` to
   `return 301 https://$host$request_uri;` (keep the ACME location on `:80`).
5. Publish `443:443` for the `nginx` service, then `docker compose ... exec nginx nginx -s reload`.
6. Renewal: run certbot `renew` on a timer and reload nginx.

## Hardening notes
- The container runs the stock `nginx:alpine` (workers drop to the `nginx`
  user). For a fully non-root edge, switch to `nginxinc/nginx-unprivileged`.
- Consider a stricter `Content-Security-Policy` once the asset origins are
  finalized (helmet already sets a baseline CSP on API responses).
