# Firewall Configuration

## Allow

| Port | Service |
|------|---------|
| 22 | SSH |
| 80 | HTTP (nginx / ACME) |
| 443 | HTTPS (nginx) |

## Block (public)

| Port | Reason |
|------|--------|
| 5432 | PostgreSQL — internal only |
| 6379 | Redis — internal only |
| 3000-3002 | App services — internal only |

## UFW Example (Ubuntu)

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

## Verify NKT Does Not Expose DB/Redis

```bash
docker compose --env-file .env.production ps
ss -tlnp | grep -E '5432|6379|3000|3001|3002'
```

Only nginx ports (80/443 or custom) should be publicly reachable.
