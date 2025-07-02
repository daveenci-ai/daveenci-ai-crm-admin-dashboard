# Production Deployment Guide - CRM Contact Fields Enhancement

## Overview
This guide provides step-by-step instructions for safely deploying the enhanced CRM system with new contact fields to production.

## 🚨 Critical Prerequisites

### Pre-Deployment Checklist
- [ ] All testing completed and signed off (see TESTING_CHECKLIST.md)
- [ ] Database migration tested in staging environment
- [ ] Backup strategy confirmed and tested
- [ ] Rollback procedures documented and tested
- [ ] Production database access confirmed
- [ ] Domain/hosting configuration ready
- [ ] SSL certificates valid and configured
- [ ] Environment variables configured

### Team Preparation
- [ ] Database administrator available during deployment
- [ ] Development team on standby for issues
- [ ] Stakeholders notified of deployment window
- [ ] Support team briefed on new features
- [ ] Documentation updated for end users

---

## 📋 Deployment Process

### Step 1: Pre-Deployment Backup
```bash
# Connect to production server
ssh user@production-server

# Navigate to application directory
cd /path/to/crm-application

# Create full database backup
pg_dump -h [DB_HOST] -U [DB_USER] -d [DB_NAME] > backups/pre-deployment-$(date +%Y%m%d_%H%M%S).sql

# Create application code backup
tar -czf backups/application-backup-$(date +%Y%m%d_%H%M%S).tar.gz .

# Verify backup files
ls -la backups/
```

### Step 2: Environment Preparation
```bash
# Set maintenance mode (if available)
# touch maintenance.html

# Stop application services
sudo systemctl stop crm-backend
sudo systemctl stop crm-frontend

# Verify services are stopped
sudo systemctl status crm-backend
sudo systemctl status crm-frontend
```

### Step 3: Code Deployment
```bash
# Pull latest code from main branch
git fetch origin
git checkout main
git pull origin main

# Verify correct version
git log --oneline -5

# Install/update dependencies
cd server
npm ci --production
cd ../src/src
npm ci --production
cd ../..
```

### Step 4: Database Migration
```bash
# Navigate to server directory
cd server

# Run database migration with verification
npm run db:migrate-safe

# Verify migration success
npm run db:verify

# Check application can connect to database
npm run test:api
```

### Step 5: Application Build
```bash
# Build frontend
cd src/src
npm run build

# Build backend (if applicable)
cd ../../server
npm run build

# Verify build files exist
ls -la dist/ || ls -la build/
```

### Step 6: Service Restart
```bash
# Start backend service
sudo systemctl start crm-backend
sudo systemctl enable crm-backend

# Start frontend service (if using PM2 or similar)
sudo systemctl start crm-frontend
sudo systemctl enable crm-frontend

# Verify services are running
sudo systemctl status crm-backend
sudo systemctl status crm-frontend
```

### Step 7: Deployment Verification
```bash
# Test API endpoints
curl -X GET http://localhost:3001/api/contacts
curl -X GET http://localhost:3001/health

# Test frontend is serving
curl -X GET http://localhost:3000

# Run comprehensive API tests
cd server
npm run test:api
```

---

## 🔍 Post-Deployment Validation

### Immediate Health Checks (0-15 minutes)
- [ ] **Application Accessibility**
  - [ ] Frontend loads without errors
  - [ ] Backend API responds correctly
  - [ ] Login functionality works
  - [ ] Database connections are stable

- [ ] **Core Functionality**
  - [ ] Can view existing contacts
  - [ ] Can create new contacts with all fields
  - [ ] Can edit existing contacts
  - [ ] Search and filtering work
  - [ ] Export functionality works

- [ ] **Data Integrity**
  - [ ] Contact counts match pre-deployment
  - [ ] All existing contacts display correctly
  - [ ] New fields are available in forms
  - [ ] Legacy data migrated properly

### Extended Validation (15 minutes - 2 hours)
- [ ] **Performance Monitoring**
  - [ ] Page load times acceptable (< 3 seconds)
  - [ ] API response times normal (< 500ms)
  - [ ] Database query performance stable
  - [ ] No memory leaks or CPU spikes

- [ ] **User Workflows**
  - [ ] Complete contact creation workflow
  - [ ] Complete contact editing workflow
  - [ ] Search across all fields works
  - [ ] Industry filtering functions
  - [ ] CSV export includes all new fields

- [ ] **Browser Compatibility**
  - [ ] Chrome/Chromium (latest)
  - [ ] Firefox (latest)
  - [ ] Safari (latest)
  - [ ] Edge (latest)

### 24-Hour Monitoring
- [ ] **System Stability**
  - [ ] No application crashes
  - [ ] No database connection issues
  - [ ] No unusual error rates
  - [ ] Server resources stable

- [ ] **User Feedback**
  - [ ] No user-reported issues
  - [ ] New features being used
  - [ ] Performance acceptable
  - [ ] Data accuracy confirmed

---

## 🚨 Rollback Procedures

### When to Rollback
- Critical functionality broken
- Data corruption detected
- Performance degradation > 50%
- Security vulnerabilities discovered
- User login issues

### Emergency Rollback Process
```bash
# 1. Stop current services
sudo systemctl stop crm-backend
sudo systemctl stop crm-frontend

# 2. Restore application code
cd /path/to/crm-application
tar -xzf backups/application-backup-[TIMESTAMP].tar.gz

# 3. Rollback database (CRITICAL - Data loss possible)
psql -h [DB_HOST] -U [DB_USER] -d [DB_NAME] < backups/pre-deployment-[TIMESTAMP].sql

# 4. Restart services
sudo systemctl start crm-backend
sudo systemctl start crm-frontend

# 5. Verify rollback
curl -X GET http://localhost:3001/api/contacts
```

⚠️ **WARNING**: Database rollback will lose any data created after deployment!

---

## 📊 Environment-Specific Configurations

### Production Environment Variables
```bash
# Database Configuration
DATABASE_URL="postgresql://user:password@host:port/database"
DB_HOST="production-db-host"
DB_PORT="5432"
DB_NAME="crm_production"

# Application Configuration
NODE_ENV="production"
PORT="3001"
FRONTEND_URL="https://crm.yourdomain.com"

# Security Configuration
JWT_SECRET="secure-random-string"
COOKIE_SECRET="another-secure-string"
CORS_ORIGIN="https://crm.yourdomain.com"

# Logging
LOG_LEVEL="info"
LOG_FILE="/var/log/crm/application.log"
```

### Nginx Configuration (if using)
```nginx
server {
    listen 80;
    server_name crm.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name crm.yourdomain.com;

    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;

    # Frontend
    location / {
        root /path/to/crm/src/src/build;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 📈 Monitoring & Alerting

### Key Metrics to Monitor
- **Application Metrics**
  - Response times (API endpoints)
  - Error rates (4xx, 5xx responses)
  - Request volume
  - Active user sessions

- **Database Metrics**
  - Connection count
  - Query execution time
  - Database size growth
  - Slow query log

- **System Metrics**
  - CPU usage
  - Memory usage
  - Disk space
  - Network I/O

### Alert Thresholds
- API response time > 2 seconds
- Error rate > 5%
- Database connections > 80% of max
- CPU usage > 80% for 5+ minutes
- Memory usage > 85%
- Disk space > 90%

---

## 🔧 Troubleshooting Guide

### Common Issues & Solutions

#### "Cannot connect to database"
```bash
# Check database status
sudo systemctl status postgresql

# Check connection string
echo $DATABASE_URL

# Test connection manually
psql $DATABASE_URL -c "SELECT 1;"
```

#### "Frontend shows white screen"
```bash
# Check if build files exist
ls -la src/src/build/

# Check Nginx/web server logs
sudo tail -f /var/log/nginx/error.log

# Rebuild frontend
cd src/src && npm run build
```

#### "API returns 500 errors"
```bash
# Check application logs
sudo journalctl -u crm-backend -f

# Check process is running
ps aux | grep node

# Restart backend service
sudo systemctl restart crm-backend
```

#### "Migration fails"
```bash
# Check migration status
cd server && npx prisma migrate status

# Check database permissions
psql $DATABASE_URL -c "SELECT current_user, current_database();"

# Run rollback if needed
npm run db:rollback
```

---

## 📞 Emergency Contacts

### Deployment Team
- **Lead Developer**: [Name] - [Phone] - [Email]
- **Database Administrator**: [Name] - [Phone] - [Email]
- **DevOps Engineer**: [Name] - [Phone] - [Email]
- **Product Manager**: [Name] - [Phone] - [Email]

### Escalation Process
1. **Level 1**: Development team (0-30 minutes)
2. **Level 2**: Database administrator (30-60 minutes)
3. **Level 3**: Senior management (60+ minutes)

---

## ✅ Deployment Checklist

### Pre-Deployment
- [ ] Code review completed
- [ ] Testing sign-off received
- [ ] Database backup created
- [ ] Application backup created
- [ ] Team members notified
- [ ] Maintenance window scheduled

### During Deployment
- [ ] Services stopped gracefully
- [ ] Code deployed successfully
- [ ] Dependencies updated
- [ ] Database migration completed
- [ ] Build process successful
- [ ] Services restarted
- [ ] Health checks passed

### Post-Deployment
- [ ] Immediate validation completed
- [ ] Performance monitoring active
- [ ] User acceptance testing passed
- [ ] Documentation updated
- [ ] Team debriefing scheduled
- [ ] Monitoring alerts configured

### Sign-off
**Deployment Lead**: ________________________  
**Database Admin**: _________________________  
**Product Manager**: ________________________  
**Date/Time**: ______________________________  
**Deployment Status**: [ ] SUCCESS [ ] FAILED [ ] ROLLED BACK

---

**Last Updated**: Phase 9 - Production Deployment  
**Version**: 1.0.0 