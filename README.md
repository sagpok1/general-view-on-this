# General View On This

A community platform that connects neighborhoods through credit-based orders, honest reviews, and community surveys. Built for local businesses and the people who support them.

Users earn credits by completing surveys about their neighborhood and spend those credits to place orders at local businesses. Businesses can review customers, customers can review businesses, and admins moderate the whole ecosystem.

## Tech Stack

- **Runtime:** Node.js 18+
- **Framework:** Express 4
- **Database:** SQLite via better-sqlite3 (WAL mode, zero config)
- **Auth:** Passport.js (local strategy + Google OAuth 2.0)
- **Templating:** EJS
- **Styling:** Pure CSS (no frameworks)
- **Email:** Nodemailer with Gmail SMTP
- **Security:** Helmet, express-rate-limit, bcryptjs, CSRF tokens

---

## Quick Start (Local Development)

```bash
git clone <your-repo-url> generalviewonthis
cd generalviewonthis
cp .env.example .env
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

For auto-reload during development:

```bash
npm run dev
```

### Default Admin Account

| Email                  | Password   |
|------------------------|------------|
| admin@generalviewonthis.com    | admin123   |

The database seeds automatically on first run with the admin account, five sample businesses, and eight community surveys.

---

## Setting Up Google OAuth

Google OAuth is **optional**. Local email/password authentication works without it.

1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (or select an existing one).
3. Navigate to **APIs & Services > Library** and enable the **Google+ API**.
4. Go to **APIs & Services > Credentials**.
5. Click **Create Credentials > OAuth 2.0 Client ID**.
6. Set the application type to **Web application**.
7. Under **Authorized redirect URIs**, add:
   ```
   http://localhost:3000/auth/google/callback
   ```
8. Copy the **Client ID** and **Client Secret** into your `.env` file:
   ```
   GOOGLE_CLIENT_ID=your-client-id-here
   GOOGLE_CLIENT_SECRET=your-client-secret-here
   GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
   ```

---

## Configuring Gmail SMTP

Email is **optional** in development. To disable email verification, set `REQUIRE_EMAIL_VERIFICATION=false` in your `.env` file (this is the default).

To enable email sending:

1. Go to your [Google Account](https://myaccount.google.com/) > **Security**.
2. Enable **2-Step Verification** if not already enabled.
3. Go to **2-Step Verification > App passwords**.
4. Generate an app password for **Mail**.
5. Add to your `.env`:
   ```
   EMAIL_USER=your@gmail.com
   EMAIL_PASS=the-16-character-app-password
   EMAIL_FROM=General View On This <noreply@generalviewonthis.com>
   REQUIRE_EMAIL_VERIFICATION=true
   ```

---

## Deploying to Railway

1. Push your code to a GitHub repository.
2. Go to [railway.app](https://railway.app) and sign in with GitHub.
3. Click **New Project > Deploy from GitHub repo** and select your repository.
4. Railway auto-detects Node.js and runs `npm start`.
5. Add environment variables in the Railway dashboard (**Variables** tab):
   ```
   NODE_ENV=production
   SESSION_SECRET=a-long-random-string-at-least-32-characters
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_CALLBACK_URL=https://your-app.up.railway.app/auth/google/callback
   ```
6. Railway assigns a public URL automatically. Update `GOOGLE_CALLBACK_URL` to match.

---

## Deploying to Render

1. Push your code to a GitHub repository.
2. Go to [render.com](https://render.com) and create a **New Web Service**.
3. Connect your GitHub repo.
4. Configure the service:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Add environment variables in the Render dashboard (**Environment** tab):
   ```
   NODE_ENV=production
   SESSION_SECRET=a-long-random-string-at-least-32-characters
   GOOGLE_CLIENT_ID=your-client-id
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_CALLBACK_URL=https://your-app.onrender.com/auth/google/callback
   ```

**Note:** The Render free tier spins down after 15 minutes of inactivity. The first request after spin-down may take 30-60 seconds while the service restarts.

---

## Deploying to a VPS (Ubuntu) with PM2 + Nginx

### 1. Install Node.js

```bash
ssh user@your-server-ip
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 18
```

### 2. Clone and Install

```bash
git clone <your-repo-url> /var/www/generalviewonthis
cd /var/www/generalviewonthis
npm install --production
```

### 3. Configure Environment

```bash
cp .env.example .env
nano .env
```

Set production values:

```
NODE_ENV=production
SESSION_SECRET=a-long-random-string-at-least-32-characters
GOOGLE_CALLBACK_URL=https://yourdomain.com/auth/google/callback
```

### 4. Run with PM2

```bash
npm install -g pm2
pm2 start app.js --name generalviewonthis
pm2 startup
pm2 save
```

PM2 will restart the app on crashes and on server reboot.

### 5. Configure Nginx

```bash
sudo apt install nginx
sudo nano /etc/nginx/sites-available/generalviewonthis
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
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

Enable the site and restart Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/generalviewonthis /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 6. SSL with Certbot

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

Certbot auto-renews certificates via a systemd timer.

---

## Custom Domain Setup

1. Point your domain's DNS **A record** to your server's IP address.
2. Wait for DNS propagation (can take up to 48 hours, usually minutes).
3. Update `GOOGLE_CALLBACK_URL` in your `.env` to use the new domain:
   ```
   GOOGLE_CALLBACK_URL=https://yourdomain.com/auth/google/callback
   ```
4. Update the redirect URI in Google Cloud Console to match.
5. Restart the application.

---

## Database Backup

SQLite stores everything in a single file (`generalviewonthis.db`), making backups straightforward.

### Manual Backup

```bash
cp generalviewonthis.db backups/generalviewonthis-$(date +%Y%m%d).db
```

### Automated Daily Backup (Cron)

```bash
mkdir -p /var/www/generalviewonthis/backups
crontab -e
```

Add this line for a daily backup at 2:00 AM:

```
0 2 * * * cp /var/www/generalviewonthis/generalviewonthis.db /var/www/generalviewonthis/backups/generalviewonthis-$(date +\%Y\%m\%d).db
```

### Migrating to PostgreSQL

The SQLite schema is largely compatible with PostgreSQL. Key differences to address:

- Replace `INTEGER PRIMARY KEY AUTOINCREMENT` with `SERIAL PRIMARY KEY`.
- Replace `DATETIME DEFAULT CURRENT_TIMESTAMP` with `TIMESTAMP DEFAULT NOW()`.
- Replace `better-sqlite3` calls with a PostgreSQL client (e.g., `pg`).

---

## Environment Variables

| Variable                     | Required | Default                              | Description                          |
|------------------------------|----------|--------------------------------------|--------------------------------------|
| `NODE_ENV`                   | No       | `development`                        | Set to `production` in deployment    |
| `PORT`                       | No       | `3000`                               | HTTP port                            |
| `SESSION_SECRET`             | Yes      | _(dev fallback provided)_            | Secret for signing session cookies   |
| `DB_PATH`                    | No       | `./generalviewonthis.db`                     | Path to SQLite database file         |
| `GOOGLE_CLIENT_ID`           | No       | _(empty)_                            | Google OAuth client ID               |
| `GOOGLE_CLIENT_SECRET`       | No       | _(empty)_                            | Google OAuth client secret           |
| `GOOGLE_CALLBACK_URL`        | No       | `http://localhost:3000/auth/google/callback` | OAuth redirect URI          |
| `EMAIL_USER`                 | No       | _(empty)_                            | Gmail address for SMTP               |
| `EMAIL_PASS`                 | No       | _(empty)_                            | Gmail app password                   |
| `EMAIL_FROM`                 | No       | `General View On This <noreply@generalviewonthis.com>`  | Sender address for outgoing email    |
| `REQUIRE_EMAIL_VERIFICATION` | No       | `false`                              | Require email verification on signup |

---

## Project Structure

```
generalviewonthis/
├── app.js                  # Express entry point, middleware, routes
├── package.json
├── .env.example            # Template for environment variables
├── config/
│   ├── database.js         # SQLite connection, schema, seed data
│   ├── passport.js         # Local + Google OAuth strategies
│   └── mailer.js           # Nodemailer configuration
├── middleware/
│   ├── auth.js             # Authentication guards, CSRF, user locals
│   └── rateLimit.js        # Rate limiting configuration
├── models/
│   ├── User.js             # User accounts (personal + business)
│   ├── Business.js         # Business profiles and verification
│   ├── Order.js            # Credit-based orders
│   ├── Review.js           # Reviews (user-to-business, business-to-user)
│   ├── Credit.js           # Credit balance and transaction history
│   └── Survey.js           # Surveys, questions, completions
├── routes/
│   ├── auth.js             # Login, register, Google OAuth, logout
│   ├── dashboard.js        # User dashboard
│   ├── orders.js           # Browse businesses, create/manage orders
│   ├── reviews.js          # Write and view reviews
│   ├── surveys.js          # Take surveys, view available/completed
│   ├── business.js         # Business dashboard, order management
│   └── admin.js            # Admin panel, pending review moderation
├── views/
│   ├── landing.ejs         # Public landing page
│   ├── layout/             # Base layout, header, footer, nav
│   ├── auth/               # Login and registration forms
│   ├── dashboard/          # User home dashboard
│   ├── orders/             # Browse, create, my orders
│   ├── reviews/            # Search, write, business profile
│   ├── surveys/            # Survey list and take survey
│   ├── business/           # Business dashboard, orders, review customer
│   ├── admin/              # Pending reviews moderation
│   └── errors/             # 404 and 500 pages
└── public/
    ├── css/
    │   ├── main.css        # Global styles
    │   ├── components.css  # Reusable component styles
    │   ├── layout.css      # Layout and grid styles
    │   └── pages/          # Page-specific styles
    ├── js/
    │   ├── main.js         # Global client-side scripts
    │   ├── search.js       # Business search functionality
    │   ├── survey.js       # Survey interaction logic
    │   └── stars.js        # Star rating widget
    └── assets/
        └── logo.svg        # General View On This logo
```

---

## How It Works

### Credits

Credits are the internal currency of General View On This. Users start with 0 credits and earn them by participating in the community.

- **Earning credits:** Complete a community survey to earn **1 credit** per survey.
- **Spending credits:** Place an order at a local business. The credit cost is set per order.
- **Admin bonus:** The seeded admin account starts with 100 credits for testing.
- **Business accounts:** Seeded business accounts start with 50 credits.

All credit changes are recorded in the `credit_transactions` table with a reason and optional reference ID for full auditability.

### Reviews

Reviews are permanent and cannot be deleted by any user, including admins. This ensures an honest, tamper-resistant record.

- **User-to-business reviews** are published immediately and update the business's average rating.
- **Business-to-user reviews** require admin verification before becoming visible (status starts as `pending_verification`).
- Admins can **approve** or **reject** pending business-to-user reviews from the admin panel.
- Ratings are on a 1 to 5 scale.
- Each review includes a rating, optional title, and required body text.

### Surveys

Surveys are community questionnaires created through seed data. Each survey contains multiple questions of different types:

- **Multiple choice** -- select from predefined options.
- **Rating** -- a numeric rating scale.
- **Text** -- free-form written response.

Each user can complete a given survey only once (enforced by a unique constraint). Completing a survey awards 1 credit automatically. Users can view which surveys they have completed and which are still available.

---

## License

MIT
