# American Coin - VPS Deployment Guide

This is a self-contained version of the American Coin wallet application configured to use SQLite instead of PostgreSQL for easier VPS deployment.

## Requirements

- Node.js 18+ (recommended: Node.js 20)
- npm or yarn

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Build the Application

```bash
npm run build
```

This will:
- Build the frontend with Vite
- Bundle the server with esbuild

### 3. Start the Application

```bash
npm start
```

The application will be available at `http://localhost:5000`

## Configuration

### Environment Variables

Create a `.env` file or set these environment variables:

```env
PORT=5000
SESSION_SECRET=your-secure-session-secret-here
NODE_ENV=production

# Push Notifications (optional)
# Generate VAPID keys with: npx web-push generate-vapid-keys
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_SUBJECT=mailto:admin@yourdomain.com
```

### Admin Access

Default admin credentials:
- Password: `admin123`

**IMPORTANT:** Change this password in `server/routes.ts` before deploying to production!

## Database

This version uses SQLite for data storage. The database file is automatically created at `data/wallet.db` when the application starts.

### Backup

To backup your database, simply copy the `data/wallet.db` file.

## Directory Structure

```
vpsdeploy/
├── client/           # Frontend React application
│   ├── src/
│   └── index.html
├── server/           # Backend Express server
│   ├── index.ts
│   ├── routes.ts
│   ├── storage.ts    # SQLite storage implementation
│   └── static.ts
├── shared/           # Shared types and schema
│   └── schema.ts     # SQLite Drizzle schema
├── data/             # Database directory (created automatically)
│   └── wallet.db
├── dist/             # Build output (created after build)
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Running with PM2 (Recommended for Production)

### Install PM2

```bash
npm install -g pm2
```

### Start with PM2

```bash
pm2 start dist/server.js --name "american-coin"
```

### PM2 Commands

```bash
pm2 status              # Check status
pm2 logs american-coin  # View logs
pm2 restart american-coin  # Restart app
pm2 stop american-coin  # Stop app
pm2 save               # Save PM2 process list
pm2 startup            # Generate startup script
```

## Running with systemd

Create a service file at `/etc/systemd/system/american-coin.service`:

```ini
[Unit]
Description=American Coin Wallet Application
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/vpsdeploy
ExecStart=/usr/bin/node dist/server.js
Restart=on-failure
Environment=NODE_ENV=production
Environment=PORT=5000
Environment=SESSION_SECRET=your-secret-here

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable american-coin
sudo systemctl start american-coin
```

## Nginx Reverse Proxy (Optional)

If you want to use Nginx as a reverse proxy:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## SSL with Certbot

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

## Troubleshooting

### Permission Issues

If you encounter permission issues with better-sqlite3:

```bash
npm rebuild better-sqlite3
```

### Port Already in Use

Check what's using the port:

```bash
sudo lsof -i :5000
```

### Database Locked

If you see "database is locked" errors, make sure only one instance of the app is running.

## Security Checklist

- [ ] Change the default admin password in `server/routes.ts`
- [ ] Set a strong `SESSION_SECRET` environment variable
- [ ] Use HTTPS in production (via Nginx + Certbot)
- [ ] Set `NODE_ENV=production`
- [ ] Configure firewall to only allow necessary ports
- [ ] Regular database backups
