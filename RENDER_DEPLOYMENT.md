# Render Deployment Guide - Daveenci CRM

## 🚀 Render Configuration

Since your database already has the required tables, use these commands in Render:

**Build Command:**
```bash
npm run render:build
```

**Start Command:**
```bash
npm run render:start
```

## 📋 What These Commands Do

**Build Command:**
1. **Installs Dependencies** - Both server and frontend
2. **Generates Prisma Client** - Creates the client to match your existing database structure
3. **Builds Server** - Compiles TypeScript to JavaScript

**Start Command:**
1. **Starts Application** - Launches the server

## 🛠️ Alternative Deployment Methods

### Method 1: Using the deployment script
```bash
./render-deploy.sh
```

### Method 2: Manual steps
```bash
# Install dependencies
npm run setup

# Build server
cd server
npx prisma generate
npm run build

# Start server (separate step)
npm start
```

## 🔧 Environment Variables for Render

Make sure these environment variables are set in your Render dashboard:

```
DATABASE_URL=your_postgresql_connection_string
NODE_ENV=production
PORT=10000
```

## 📝 Render Service Configuration

### Build Command:
```bash
npm run render:build
```

### Start Command:
```bash
npm run render:start
```

## 🗄️ Database Notes

- ✅ Your database already has all required tables
- ✅ Prisma schema matches your database structure
- ✅ No migrations needed during deployment
- ✅ Data will be preserved

## 🚨 If You Need to Run Migrations Later

If you ever need to apply migrations in the future:

```bash
cd server
npx prisma migrate deploy
```

## 🧪 Testing Deployment Locally

Before deploying to Render, test locally:

```bash
# Build everything
npm run build

# Start server
npm run start:server
```

## 📊 Monitoring

After deployment, monitor:
- Application logs in Render dashboard
- Database connections
- API endpoints functionality

## 🔄 Rollback Plan

If something goes wrong:
1. Check Render logs
2. Verify environment variables
3. Ensure DATABASE_URL is correct
4. Restart the service in Render dashboard

---

**Ready to deploy on Render?**
- **Build Command:** `npm run render:build`
- **Start Command:** `npm run render:start` 