# POS PHP Backend — Deployment Guide

This folder contains a complete Laravel 11 backend that is a PHP port of the NestJS backend in `../apps/`.
The original NestJS code is **not touched** — both exist side by side.

---

## Requirements (on your server)

| Tool       | Version   |
|------------|-----------|
| PHP        | 8.2+      |
| Composer   | 2.x       |
| PostgreSQL | 14+       |
| Node.js    | 18+ (for building the frontend) |

---

## 1. Copy the frontend (run once, on Windows before uploading)

```powershell
cd c:\Users\adnan\Documents\GitHub\pos_exe
.\backend\copy-frontend.ps1
```

This copies `apps/renderer/` → `backend/renderer/` (excluding node_modules).

---

## 2. Set up on the server

### Upload

Upload the entire `backend/` folder to your server (e.g. `/var/www/pos`).

### Install PHP dependencies

```bash
cd /var/www/pos/api
composer install --no-dev --optimize-autoloader
```

### Create .env

```bash
cp .env.example .env
nano .env
```

Fill in:
```
APP_KEY=          # generated below
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=pos_db
DB_USERNAME=pos_user
DB_PASSWORD=yourpassword
JWT_SECRET=       # any long random string (32+ chars)
PLATFORM_JWT_SECRET=  # different random string for platform admin
```

### Generate app key

```bash
php artisan key:generate
```

### Run migrations

```bash
php artisan migrate
```

### Seed initial data

```bash
php artisan db:seed
```

This creates:
- **Platform Admin**: email `admin@platform.local` / password `Admin@1234`
- **Demo Company** with a Company Admin: username `admin` / password `Admin@1234`
- All 17 permissions + 7 roles + Hospital module catalog entry

---

## 3. Web server (Apache / Nginx)

### Nginx config

```nginx
server {
    listen 80;
    server_name api.yourserver.com;
    root /var/www/pos/api/public;
    index index.php;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }
}
```

### Apache (if using shared hosting)

The `public/` folder is your document root. Many shared hosts (cPanel) let you set the document root to a subfolder — point it to `api/public/`.

---

## 4. Build the frontend

```bash
cd /var/www/pos/renderer
npm install
npm run build
```

This creates `renderer/dist/` — serve it as a static site, or point Electron to it.

---

## 5. API base URL

All endpoints are prefixed with `/api/`:

- Auth: `POST /api/v1/auth/login`
- Platform admin: `POST /api/v1/platform/auth/login`
- All other routes: `/api/v1/...`

---

## 6. Storage permissions

```bash
chmod -R 775 /var/www/pos/api/storage
chmod -R 775 /var/www/pos/api/bootstrap/cache
chown -R www-data:www-data /var/www/pos/api/storage
```

---

## 7. Default credentials (change after first login!)

| Role           | Login                           | Password   |
|----------------|---------------------------------|------------|
| Platform Admin | email: admin@platform.local     | Admin@1234 |
| Company Admin  | username: admin, tenantId: (see seed output) | Admin@1234 |

---

## Architecture summary

```
backend/
├── api/                  Laravel 11 PHP backend
│   ├── app/
│   │   ├── Http/Controllers/
│   │   │   ├── Auth/           login, me, refresh
│   │   │   ├── Platform/       super-admin: companies, plans, modules
│   │   │   ├── Identity/       branches, users, roles, module status
│   │   │   ├── POS/            products, categories, customers, invoices,
│   │   │   │                   suppliers, purchase orders
│   │   │   ├── Hospital/       doctors, patients, appointments, billing,
│   │   │   │                   queue, reports
│   │   │   ├── Reports/        sales summary, stock valuation, top products
│   │   │   └── Settings/       receipt settings, printers, accounting
│   │   ├── Http/Middleware/    JWT, platform auth, license, module, permission
│   │   ├── Models/             30+ Eloquent models
│   │   └── Exceptions/         domain exceptions (typed HTTP errors)
│   ├── database/
│   │   ├── migrations/         single file, all 50+ tables
│   │   └── seeders/            permissions, module catalog, demo data
│   └── routes/api.php          all endpoints
└── renderer/             (copied from apps/renderer by copy-frontend.ps1)
```
