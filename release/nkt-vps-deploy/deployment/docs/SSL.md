# SSL / HTTPS Setup

NKT uses nginx with Let's Encrypt certificates. Domain must point to your VPS before proceeding.

## Prerequisites

- DNS A records: `api.YOUR_DOMAIN`, `realtime.YOUR_DOMAIN`, `admin.YOUR_DOMAIN` → VPS IP
- Port 80 open (for ACME challenge)

## Install Certbot (Ubuntu/Debian)

```bash
sudo apt update
sudo apt install -y certbot
```

## Obtain Certificates (webroot)

```bash
cd /opt/nkt/nkt-vps-deploy

# Start nginx in HTTP mode first (ENABLE_SSL=false)
docker compose --env-file .env.production up -d nkt-nginx

sudo certbot certonly --webroot \
  -w deployment/nginx/certbot \
  -d api.YOUR_DOMAIN \
  -d realtime.YOUR_DOMAIN \
  -d admin.YOUR_DOMAIN \
  --agree-tos -m admin@YOUR_DOMAIN
```

## Mount Certificates

Copy or symlink certs to `deployment/nginx/ssl/live/` matching nginx SSL template paths, then:

```bash
# In .env.production
ENABLE_SSL=true
```

Re-run deploy to regenerate nginx configs with SSL templates.

## Auto-Renewal

```bash
sudo crontab -e
# Add:
0 3 * * * certbot renew --quiet --deploy-hook "cd /opt/nkt/nkt-vps-deploy && docker compose --env-file .env.production restart nkt-nginx"
```

## Before SSL (IP-only testing)

Use HTTP mode with `ENABLE_SSL=false`. Point smoke URLs to `http://API_HOST`.

> Do not use placeholder domains. Replace `YOUR_DOMAIN` with your real domain.
