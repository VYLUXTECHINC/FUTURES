# FUTURES Trading Bot — Complete Production Setup Guide
## From Zero to Live Multi-User Trading Platform

> This guide walks you through **every single step** — from buying a VPS to having your bot running live with users signing up, connecting MT5 accounts, and trading automatically.

---

## Architecture Overview

```
Users (Web App)
        │
        ▼
┌─────────────────────┐               ┌──────────────────────┐
│   Your Domain       │ ◄─── HTTPS ──►│  Cloudflare Tunnel   │
│   bot.futuretraders.net             │  (cloudflared)       │
└─────────────────────┘               └──────────┬───────────┘
                                                 │ :8000 (outbound tunnel)
                                                 ▼
                                        ┌──────────────────┐
                                        │  FastAPI Backend  │
                                        │  (brain + backend)│
                                        └──┬───────────┬───┘
                                           │           │
                               MT5 (local) │           │ Supabase (cloud)
                                           ▼           ▼
                                    ┌────────────┐  ┌──────────────────┐
                                    │ HFM MT5    │  │ PostgreSQL DB    │
                                    │ terminal   │  │ Auth + Tables    │
                                    └────────────┘  └──────────────────┘
```

**How it works for multiple users:**
1. Each user signs up via the web app
2. They connect their MT5 broker account (credentials saved encrypted to Supabase)
3. The bot on your VPS reads credentials from Supabase, logs into MT5, and trades on their behalf
4. All trades, signals, and settings are synced to Supabase in real-time

---

## Phase 1: Infrastructure Setup

### Step 1.1: Get a Windows VPS

**Minimum specs:**
- **OS:** Windows Server 2019 or 2022
- **CPU:** 2 cores (4+ recommended)
- **RAM:** 4GB (8GB recommended)
- **Storage:** 40GB SSD minimum
- **Network:** Stable, low-latency connection

**Recommended providers:**
- Contabo, Hetzner, OVH, DigitalOcean (Windows), AWS EC2 (Windows), Vultr

**What you'll get:**
- Public IPv4 address (e.g., `203.0.113.50`)
- RDP credentials (username + password)
- Administrator access

### Step 1.2: Connect to Your VPS via RDP

**Windows:**
1. Press `Win + R` → type `mstsc` → Enter
2. Enter your VPS IP → Connect
3. Login with the credentials from your provider

**Mac/Linux:**
- Use Microsoft Remote Desktop from the App Store or `remmina` on Linux

### Step 1.3: Set Up Your Domain DNS

Go to your Cloudflare dashboard — DNS is handled automatically by the tunnel (see Phase 4).

**Note:** With Cloudflare Tunnel, you don't need a DNS A record pointing to your VPS IP. The tunnel creates a CNAME automatically when you run `cloudflared tunnel route dns`.

### Step 1.4: Set Up Supabase (Database + Auth)

1. Go to https://supabase.com → Sign up → Create New Project
2. Name it `futures-bot`, set a strong database password, choose a region close to your VPS
3. Wait 2-3 minutes for provisioning

**Get your credentials:**
1. Go to **Project Settings → API**
2. Copy these values:
   - **Project URL:** `https://xxxxx.supabase.co`
   - **anon public key:** (starts with `eyJ...`)
   - **service_role key:** (secret — never expose to frontend)

3. Go to **Project Settings → Database**
4. Under "Connection string", select **URI** tab, copy the **Transaction** pooler string (port 6543)
   - It looks like: `postgresql://postgres.xxxxx:YOUR_PASSWORD@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=require`

**Run the database schema:**
1. In Supabase dashboard, go to **SQL Editor**
2. Open your `db.txt` file, copy ALL the SQL
3. Paste into the SQL Editor → Click **Run**
4. You should see "Success. No rows returned" or similar — this means all tables, policies, and triggers were created

**Verify tables exist:**
Go to **Table Editor** — you should see: `profiles`, `trades`, `bot_state`, `signals`, `mt5_credentials`, `support_tickets`, `user_settings`, `system_logs`, `news_state`, `legal_acceptances`

---

## Phase 2: VPS Software Installation

### Step 2.1: Install Python

1. Download Python 3.11+ from https://www.python.org/downloads/windows/
2. Run the installer
3. **CRITICAL:** Check ✅ **"Add Python to PATH"** at the bottom
4. Click "Install Now"
5. Verify: Open Command Prompt → `python --version` → should show `Python 3.11.x` or higher

### Step 2.2: Install HFM MetaTrader 5

1. Download from: https://www.hfm.com/en/trading-platforms/metatrader-5
2. Run installer → Install to default location: `C:\Program Files\HFM MetaTrader 5\`
3. **Launch MT5 once** after installation
4. **Log in:**
   - File → Open an Account → Search "HFM"
   - Choose server:
     - **Demo:** `HFM.com Demo MT5`
     - **Live:** `HFM.com Real MT5`
   - Enter your MT5 login + password
5. **Enable Algo Trading (CRITICAL):**
   - Tools → Options → Expert Advisors tab
   - ✅ Check "Allow Algorithmic Trading"
   - ✅ Check "Allow WebRequest for listed URLs"
   - Add your Supabase URL: `https://xxxxx.supabase.co`
   - Click OK
6. **Close MT5** — the bot will launch it automatically

> **Note:** If you use a different broker, adjust the server name accordingly. The exact server name is visible in MT5 → File → Login to Trade Account → Server dropdown.

### Step 2.3: Install Cloudflare Tunnel (cloudflared)

Cloudflare Tunnel creates a secure outbound connection from your VPS to Cloudflare's edge — no open ports needed.

1. Download `cloudflared` from: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
2. Extract `cloudflared.exe` to `C:\cloudflared\`
3. Verify: Open Command Prompt → `C:\cloudflared\cloudflared.exe version`
4. Authenticate: `cloudflared tunnel login` — this opens a browser to authorize with your Cloudflare account

---

## Phase 3: Deploy the Bot

### Step 3.1: Upload Your Project

Create the directory and upload all project files:

```cmd
mkdir C:\futures-bot
```

**Upload methods:**
- **RDP clipboard:** Copy files on your local machine, paste in RDP session
- **Git:** `git clone your-repo C:\futures-bot` (if repo is accessible)
- **SCP/WinSCP:** Use WinSCP to SFTP files from your local machine to VPS
- **Zip + RDP:** Zip the project, transfer via RDP, extract on VPS

Your final structure should look like:
```
C:\futures-bot\
├── backend\
│   ├── main.py
│   ├── api\
│   ├── ai\
│   ├── db\
│   └── telegram_bot\
├── brain\
│   ├── main.py
│   ├── config\
│   ├── core\
│   ├── data\
│   ├── db\
│   ├── sectors\
│   ├── utils\
│   └── api\
├── scripts\
├── web\
├── requirements.txt
├── .env
└── ...
```

### Step 3.2: Install Python Dependencies

```cmd
cd C:\futures-bot
pip install -r requirements.txt
```

This installs: FastAPI, uvicorn, pandas, numpy, supabase, psycopg2, MetaTrader5, python-telegram-bot, cryptography, and all other packages.

### Step 3.3: Generate Encryption Key

MT5 passwords are encrypted before storage in Supabase. Generate a unique key:

```cmd
python -c "from cryptography.fernet import Fernet; import base64; print(base64.urlsafe_b64encode(Fernet.generate_key()).decode())"
```

Copy the output — it looks like: `abc123def456...==`

### Step 3.4: Create the `.env` File

Create `C:\futures-bot\.env` with these values:

```env
# ============================================================
# FUTURES – Production Environment Variables
# ============================================================

# --- API Server ---
API_HOST=127.0.0.1
API_PORT=8000

# --- Allowed Origins (your domain) ---
ALLOWED_ORIGINS=https://bot.futuretraders.net

# --- Supabase (from Step 1.4) ---
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=your-anon-public-key-here
SUPABASE_DB_URI=postgresql://postgres.xxxxx:YOUR_PASSWORD@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=require
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# --- Supabase JWT Secret (find in Supabase Dashboard → Settings → API → JWT Secret) ---
SUPABASE_JWT_SECRET=your-jwt-secret-here

# --- Encryption (from Step 3.3) ---
ENCRYPTION_KEY=your-generated-encryption-key-here

# --- AI Copilot ---
AI_BASE_URL=https://all-in-1-ais.officialhectormanuel.workers.dev
AI_MODEL=deepseek

# --- Logging ---
LOG_LEVEL=INFO

# --- Telegram Admin Bot ---
TELEGRAM_ADMIN_BOT_TOKEN=your-bot-token-from-botfather
TELEGRAM_ADMIN_ID_1=your-telegram-user-id
TELEGRAM_ADMIN_ID_2=second-admin-id-optional
```

**Replace all placeholders:**
- `bot.futuretraders.net` → your actual subdomain
- `https://xxxxx.supabase.co` → your Supabase project URL
- `your-anon-public-key-here` → from Supabase Settings → API
- `SUPABASE_DB_URI` → the Transaction pooler connection string (port 6543)
- `your-service-role-key-here` → from Supabase Settings → API (service_role key)
- `your-jwt-secret-here` → from Supabase Dashboard → Settings → API → JWT Secret
- `your-generated-encryption-key-here` → from Step 3.3
- Telegram values → create a bot via @BotFather on Telegram, get the token, and your user ID via @userinfobot

### Step 3.5: Quick Test Run

```cmd
cd C:\futures-bot
python backend/main.py
```

Watch the output. You should see:
```
INFO: Uvicorn running on http://127.0.0.1:8000
INFO: FuturesBrain v2.0 API started
INFO: Trading loop active | pairs=['GBPUSD', 'GBPJPY', 'USDJPY', 'EURUSD', 'AUDUSD', 'USDCAD'] | tf=15m
```

Press `Ctrl+C` to stop. If there are errors, fix them before proceeding.

---

## Phase 4: HTTPS with Cloudflare Tunnel

### Step 4.1: Create the Tunnel

After authenticating with `cloudflared tunnel login`, create a named tunnel:

```cmd
cd C:\cloudflared
cloudflared tunnel create futures-bot
```

This creates a credentials JSON file in `C:\Users\<you>\.cloudflared\`. Note the **Tunnel ID** (a UUID) — you'll need it below.

### Step 4.2: Configure the Tunnel

Create `C:\cloudflared\config.yml`:

```yaml
tunnel: YOUR-TUNNEL-ID-HERE
credentials-file: C:\Users\<you>\.cloudflared\<TUNNEL-ID>.json

ingress:
  - hostname: bot.futuretraders.net
    service: http://localhost:8000
  - service: http_status:404
```

Replace `YOUR-TUNNEL-ID-HERE` with your actual tunnel ID (from the `create` step).

### Step 4.3: Configure DNS in Cloudflare

Point your domain to the tunnel:

```cmd
cloudflared tunnel route dns futures-bot bot.futuretraders.net
```

Or from the Cloudflare Dashboard:
1. Go to **Zero Trust → Networks → Tunnels**
2. Select your tunnel → **Edit** → add a public hostname:
   - **Subdomain:** `bot`
   - **Domain:** `futuretraders.net`
   - **Service:** `http://localhost:8000`
3. Save

### Step 4.4: Test the Tunnel

```cmd
cloudflared tunnel run futures-bot
```

Open `https://bot.futuretraders.net` in your browser — you should see your bot's API response.

Press `Ctrl+C` to stop.

### Step 4.5: Cloudflare SSL Settings

In Cloudflare Dashboard:
1. **SSL/TLS → Overview:** Set to **Full (strict)**
2. **SSL/TLS → Edge Certificates:**
   - ✅ Always Use HTTPS
   - ✅ Automatic HTTPS Rewrites

---

## Phase 5: Windows Firewall

With Cloudflare Tunnel, all traffic is **outbound-only** — no inbound ports needed.

### Step 5.1: Confirm Outbound Connectivity

Just ensure your VPS has outbound internet access (it will, by default). Run this to verify:

```cmd
curl -I https://bot.futuretraders.net
```

You don't need to open or close any inbound firewall ports. The tunnel connection is initiated from your VPS to Cloudflare.

---

## Phase 6: Auto-Start Everything on Boot

### Step 6.1: Install NSSM (Non-Sucking Service Manager)

1. Download from: https://nssm.cc/download
2. Extract the zip
3. Copy `nssm.exe` from the `win64\` folder to `C:\nssm\`

### Step 6.2: Install the Bot as a Service

```cmd
C:\nssm\nssm.exe install FuturesBot
```

A GUI window opens. Fill in:

| Tab | Field | Value |
|-----|-------|-------|
| Application | Path | `C:\Python311\python.exe` (your actual Python path) |
| Application | Startup directory | `C:\futures-bot` |
| Application | Arguments | `backend/main.py` |
| Details | Display name | `FUTURES Trading Bot` |
| Details | Description | `AI-Powered Forex Trading Bot` |
| Log on | | Select "Local System account" |
| App console | | Check "Console window" (optional, for debugging) |

Click **Install service**.

### Step 6.3: Install Cloudflare Tunnel as a Service

```cmd
cd C:\cloudflared
cloudflared service install
```

This registers the tunnel as a Windows service that starts automatically on boot.

### Step 6.4: Start Both Services

```cmd
nssm start FuturesBot
net start cloudflared
```

Verify:
```cmd
nssm status FuturesBot         → should show SERVICE_RUNNING
cloudflared tunnel list        → should show futures-bot as active
```

### Step 6.5: Verify Everything

```cmd
:: Check bot API is accessible via HTTPS
curl https://bot.futuretraders.net/api/status

:: Check via browser — open https://bot.futuretraders.net
```

---

## Phase 7: Configure MT5 Credentials

### Step 7.1: Via the Web App (Recommended for Multi-User)

1. Navigate to https://bot.futuretraders.net
2. User signs up → verifies email
3. User goes to **Broker Connect** screen
4. User enters their MT5 Login ID, Password, and selects server (Demo/Live)
5. User taps **"Activate Trading Bot"**
6. Credentials are encrypted and saved to Supabase
7. The bot on the VPS picks them up automatically and connects

### Step 7.2: Via SQL (Manual / Testing)

If you need to manually add MT5 credentials for testing:

1. In Supabase → SQL Editor
2. Run (replace with your values):

```sql
-- First, find your user ID from auth.users
SELECT id, email FROM auth.users;

-- Then insert credentials (password will be encrypted by the app, not raw)
-- Better to use the app's API endpoint:
-- POST /api/mt5/connect
```

> **Important:** The bot fetches the most recently updated MT5 credential from Supabase and connects to it. For production multi-user, the bot should be modified to handle multiple accounts — see the multi-MT5 section below.

---

## Phase 8: Frontend Deployment

The frontend is a static SPA served directly from the FastAPI backend (no build step required). See `web/index.html`, `web/style.css`, and `web/main.js`.

All frontend updates are deployed by simply updating files in the `web/` directory and restarting the FastAPI server.

---

## Phase 9: Telegram Admin Bot Setup

### Step 9.1: Create the Bot

1. Open Telegram → search `@BotFather`
2. Send `/newbot`
3. Choose a name: `FUTURES Bot Admin`
4. Choose a username: `futures_admin_bot` (must end in `bot`)
5. Copy the **token** — paste it into `.env` as `TELEGRAM_ADMIN_BOT_TOKEN`

### Step 9.2: Get Your Telegram User ID

1. Search `@userinfobot` on Telegram
2. Send `/start`
3. Copy your **Id** — paste it into `.env` as `TELEGRAM_ADMIN_ID_1`

### Step 9.3: Available Commands

Once running, send these to your Telegram bot:

| Command | Description |
|---------|-------------|
| `/health` | Check bot status, MT5 connection, account balance |
| `/start` | Start the trading bot |
| `/stop` | Stop the trading bot |
| `/status` | Show current state, open positions, today's PnL |
| `/trades` | Show recent trades |
| `/risk` | Show/change risk settings |
| `/pairs` | Show active trading pairs |

---

## Phase 10: Multi-User Architecture

### How It Works

```
User A (phone) ──► Supabase Auth ──► profiles table ──► mt5_credentials (encrypted)
User B (phone) ──► Supabase Auth ──► profiles table ──► mt5_credentials (encrypted)
User C (web)   ──► Supabase Auth ──► profiles table ──► mt5_credentials (encrypted)
                                                    │
                                                    ▼
                                    VPS Bot reads ALL credentials
                                    Connects to MT5 (one at a time or multi-instance)
                                    Trades on behalf of each user
                                    Syncs trades back to Supabase
```

### Key Tables for Multi-User

| Table | Purpose |
|-------|---------|
| `profiles` | One row per user — risk settings, bot_active flag, notifications |
| `mt5_credentials` | Each user's MT5 login (encrypted), linked by `user_id` |
| `trades` | All trades, tagged with `user_id` so each user sees only theirs |
| `user_settings` | Per-user overrides — max_daily_trades, risk_percent, trading_mode |
| `signals` | All signals logged (service role only) |
| `bot_state` | Global bot settings (shared) |

### RLS (Row Level Security)

Supabase RLS ensures:
- **Users can ONLY see their own data** (trades, settings, credentials)
- **Service role (your bot) has full access** to everything
- Users cannot read other users' trades or credentials

### Current Limitation & Fix Needed

**Current:** The bot connects to **one MT5 account at a time** (the most recently updated one in Supabase).

**For true multi-user**, you need to modify the bot to either:
1. **Run multiple MT5 instances** — one per user (requires more VPS resources)
2. **Use a broker API** instead of MT5 terminal (if your broker supports it)
3. **Queue-based approach** — cycle through users' accounts, trading one at a time

To implement option 3, modify `backend/main.py` trading loop to:
```python
# Fetch ALL active users with credentials
users = _exec_query("SELECT user_id, login, password, server FROM mt5_credentials WHERE connected = TRUE")

for user in users:
    # Connect to this user's MT5 account
    reconnect_mt5(user['login'], decrypt_password(user['password']), user['server'])
    # Run pipeline for this user's pairs
    # Execute trades
    # Sync trades to Supabase with user_id
    sync_trade(..., user_id=user['user_id'])
```

---

## Phase 11: Monitoring & Maintenance

### Daily Checks

1. **Bot status:** `curl https://bot.futuretraders.net/api/status` or `/health` on Telegram
2. **MT5 connection:** Ensure terminal is running and connected
3. **Today's trades:** Check Supabase → Table Editor → `trades`
4. **Error logs:** Check VPS console output or log files

### Weekly Checks

1. **Tunnel health:** `cloudflared tunnel info futures-bot`
2. **Disk space:** `dir C:\` — ensure enough free space
3. **Windows Updates:** Apply security updates, restart if needed
4. **Supabase usage:** Check project dashboard for row count, storage usage

### Monthly Checks

1. **Review trades:** Analyze win rate, PnL, drawdown
2. **Update dependencies:** `pip install --upgrade -r requirements.txt`
3. **Backup:** Export Supabase data, backup `.env` and config files
4. **VPS health:** Check CPU, RAM, network usage

### Restarting the Bot

```cmd
nssm stop FuturesBot
nssm start FuturesBot
nssm status FuturesBot
```

### Restarting Cloudflare Tunnel

```cmd
net stop cloudflared
net start cloudflared
```

### Viewing Service Logs

```cmd
nssm edit FuturesBot    → check "I/O" tab for log file path
```

Or redirect output by editing the NSSM service:
```cmd
nssm set FuturesBot AppStdout C:\futures-bot\logs\bot-stdout.log
nssm set FuturesBot AppStderr C:\futures-bot\logs\bot-stderr.log
mkdir C:\futures-bot\logs
nssm restart FuturesBot
```

---

## Troubleshooting

### Bot Won't Start

```
ModuleNotFoundError: No module named 'xxx'
```
→ Run `pip install -r requirements.txt` again

```
SUPABASE_DB_URI not configured
```
→ Check `.env` file exists at `C:\futures-bot\.env` with correct values

```
psycopg2 not installed
```
→ `pip install psycopg2-binary`

### MT5 Won't Connect

```
MT5 connection failed after 5 attempts
```
1. Open MT5 manually → verify login works
2. Check server name matches **exactly** (case-sensitive)
3. Kill stale MT5: `taskkill /F /IM terminal64.exe`
4. Verify "Allow Algorithmic Trading" is enabled in MT5
5. Restart bot service

Common server name variations:
- `HFM.com Demo MT5`
- `HFMGlobal-Demo`
- `HFM.com Real MT5`
- `HFMGlobal-Real`

Find exact name: MT5 → File → Login to Trade Account → look at Server dropdown.

### HTTPS Not Working

1. Check DNS: `nslookup bot.futuretraders.net` → should return a Cloudflare IP (not your VPS)
2. Check tunnel is running: `cloudflared tunnel list` → should show `active`
3. Test locally: `curl http://localhost:8000/api/status` → bot must respond
4. Check tunnel logs: `cloudflared tunnel run futures-bot` (run manually to see errors)
5. Cloudflare SSL/TLS mode must be **Full (strict)**

### No Trades Being Placed

1. Check session hours: UTC 06:00-20:00, Monday-Friday only
2. Check no open position exists (short mode = 1 trade at a time)
3. Check risk gates: cooldown active? daily limit reached? drawdown breached?
4. Check `ENABLE_SELL_TRADES` in constants.py
5. Check `SUPPORTED_PAIRS` list
6. Review logs for pipeline errors

### CORS Errors from App

1. Update `ALLOWED_ORIGINS` in `.env` to include your domain
2. Restart bot: `nssm restart FuturesBot`
3. Clear browser/app cache

### Supabase Connection Fails

```
connection refused / timeout
```
1. Verify `SUPABASE_DB_URI` uses port **6543** (Transaction pooler), not 5432
2. Test from VPS: `python -c "import psycopg2; psycopg2.connect('your-uri')"`
3. Check Supabase project is not paused (free tier pauses after inactivity)

### Users Can't Sign Up

1. Check Supabase Auth → Email Templates → verify email is enabled
2. Check SMTP settings in Supabase (use custom SMTP or Supabase default)
3. Check RLS policies on `profiles` table — insert policy must allow auth.uid() = id

---

## Security Checklist

Before going live, verify EVERY item:

- [ ] `.env` file is NOT in git (check `.gitignore`)
- [ ] `ALLOWED_ORIGINS` only lists your domain (no `*`)
- [ ] HTTPS working (padlock in browser)
- [ ] MT5 passwords encrypted in database (not plaintext)
- [ ] No inbound ports open on VPS firewall (tunnel is outbound-only)
- [ ] Supabase RLS policies are enabled on ALL tables
- [ ] `ENCRYPTION_KEY` is unique and backed up securely
- [ ] `SUPABASE_JWT_SECRET` is configured (not empty)
- [ ] `SUPABASE_URL` and `SUPABASE_KEY` are set for frontend config
- [ ] Telegram admin IDs are YOUR IDs only
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is never exposed to frontend
- [ ] VPS has a strong administrator password
- [ ] Windows Defender / antivirus is active
- [ ] Automatic Windows Updates are enabled
- [ ] Database password is strong (16+ chars, mixed case, numbers, symbols)

---

## Quick Reference Commands

| Command | Purpose |
|---------|---------|
| `python backend/main.py` | Start bot manually (foreground) |
| `nssm start FuturesBot` | Start bot service |
| `nssm stop FuturesBot` | Stop bot service |
| `nssm restart FuturesBot` | Restart bot service |
| `nssm status FuturesBot` | Check service status |
| `net start cloudflared` | Start Cloudflare Tunnel |
| `net stop cloudflared` | Stop Cloudflare Tunnel |
| `cloudflared tunnel list` | List tunnels and status |
| `curl https://bot.futuretraders.net/api/status` | Check bot health |
| `taskkill /F /IM terminal64.exe` | Kill MT5 process |
| `pip install -r requirements.txt` | Install/update dependencies |
| `nslookup bot.futuretraders.net` | Verify DNS |
| `nssm edit FuturesBot` | Edit service config GUI |

---

## Cost Estimate (Monthly)

| Service | Cost |
|---------|------|
| Windows VPS (2CPU/4GB) | $10-25/mo |
| Supabase (free tier) | $0 (up to 500MB DB, 50k MAU) |
| Domain name | $10-15/year |
| Cloudflare Tunnel (free tier) | $0 |
| HFM Demo account | $0 |
| HFM Live account | $0 (spread-based) |
| OpenRouter API (optional) | Pay-per-use (~$5-20/mo) |
| Telegram Bot | $0 |
| **Total** | **~$10-45/mo** |

---

## Next Steps After Setup

1. **Test on Demo first** — run for 2-4 weeks with demo MT5 account
2. **Monitor win rate** — compare live results to backtest
3. **Gradually increase risk** — start at 1-2% risk, scale up as confidence grows
4. **Add more data** — download 6+ months of Dukascopy data for better backtesting
5. **Fix SELL pipeline** — debug why SELL signals underperform
6. **Implement multi-MT5** — modify bot to handle multiple user accounts concurrently
7. **Set up alerts** — Telegram notifications for trades, errors, drawdown
8. **Build admin dashboard** — web UI to monitor all users, trades, and bot health
