# 📊 CRM — Internal Tool

A simple, clean CRM for managing Leads, Repeat Inquiries, and Online Orders.

---

## 🚀 Quick Start (Local)

### 1. Install backend dependencies
```bash
npm install
```

### 2. Install & build frontend
```bash
cd client && npm install && npm run build && cd ..
```

### 3. Start the server
```bash
npm start
```

Open → http://localhost:3001

**Default logins:**
- `ethan` / `Admin@123` (Manager)
- `eddie` / `Admin@123` (Manager)

> ⚠️ Change passwords after first login via Users → Edit

---

## ☁️ Deploy to Render (Free)

### Step 1 — Push to GitHub
Create a new repo and push this entire folder.

### Step 2 — Create a Render Web Service
1. Go to [render.com](https://render.com) → New → Web Service
2. Connect your GitHub repo
3. Set these settings:

| Field | Value |
|-------|-------|
| **Runtime** | Node |
| **Build Command** | `npm install && cd client && npm install && npm run build && cd ..` |
| **Start Command** | `node server.js` |

### Step 3 — Add Environment Variables
In Render → Environment:
```
JWT_SECRET = some-long-random-string-change-this
NODE_ENV = production
```

### Step 4 — Deploy
Click Deploy. Render gives you a free public URL like `https://your-crm.onrender.com`

> 💡 Free tier spins down after inactivity (takes ~30s to wake). For $7/mo you get always-on.

---

## 📁 Project Structure

```
crm/
├── server.js          ← Express server
├── database.js        ← SQLite setup + seeding
├── middleware/
│   └── auth.js        ← JWT auth middleware
├── routes/
│   ├── auth.js        ← Login / me
│   ├── users.js       ← User management
│   ├── customers.js   ← Customer CRUD
│   └── inquiries.js   ← Inquiries, followups, activity
└── client/            ← React frontend
    └── src/
        ├── pages/     ← Dashboard, Leads, Customers, etc.
        └── components/ ← Shared UI components
```

---

## 👥 Roles

| Role | Can Do |
|------|--------|
| **Manager** | See everything, assign to anyone, manage users |
| **AE** | See only their assigned leads/inquiries/orders |

---

## 🗂️ Modules

- **Leads** — New customer inquiries
- **Repeat Inquiries** — Follow-on requirements from existing customers
- **Online Orders** — Website orders manually entered by staff
- **Customers** — Customer profiles linking all their inquiries
- **Users** — Manager-only: create/edit/delete team members
