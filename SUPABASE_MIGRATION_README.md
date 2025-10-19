# iYaya Supabase Migration Guide

This guide documents the complete migration from Firebase to Supabase for the iYaya admin application.

## 📋 Migration Overview

The migration includes:
- ✅ **Frontend Authentication**: Converted from Firebase Auth to Supabase Auth
- ✅ **Messaging System**: Migrated from Firebase RTDB to Supabase Realtime
- ✅ **File Storage**: Updated from local storage to Supabase Storage
- ✅ **Database**: Designed PostgreSQL schema with RLS policies
- ✅ **Backend Integration**: Updated auth middleware and API routes

## 🚀 Quick Start

### 1. Database Setup

Execute the SQL script in your Supabase dashboard:

```bash
# Copy and paste the contents of src/migrations/20251014_supabase_core.sql
# into your Supabase SQL Editor and run it
```

### 2. Storage Buckets

Create these storage buckets in your Supabase Dashboard:

1. **uploads** (Public access for general files)
2. **profiles** (Authenticated access for profile images)

### 3. Environment Variables

Update your `.env` files with Supabase credentials:

**Frontend (.env):**
```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**Backend (.env.production):**
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-key
SUPABASE_ANON_KEY=your-anon-key
```

### 4. Install Dependencies

```bash
# Frontend
cd iyaya-admin
npm install

# Backend
cd iyaya-backend
npm install @supabase/supabase-js
```

## 🧪 Testing

Run the comprehensive test suites:

```bash
# Test backend Supabase integration
cd iyaya-backend
node scripts/test-supabase-integration.js

# Test frontend Supabase integration
node scripts/test-frontend-supabase.js

# Run data migration (after setting up database)
node scripts/migrate-data.js
```

## 📊 Data Migration

### MongoDB to Supabase Migration

The migration script handles:
- **Users**: Transforms user data with proper role mapping
- **Conversations**: Migrates conversation relationships
- **Messages**: Preserves message history and read status

```bash
# Run migration (ensure MongoDB is accessible)
cd iyaya-backend
node scripts/migrate-data.js
```

### Migration Features

- **Data Transformation**: Converts MongoDB schemas to Supabase format
- **Error Handling**: Continues migration even if individual records fail
- **Progress Tracking**: Shows detailed migration statistics
- **Rollback Safety**: Can be run multiple times safely

## 🔧 Configuration

### Supabase Settings

**Database Schema:**
- Users table with authentication integration
- Conversations and Messages with proper relationships
- Row Level Security policies for data protection

**Storage Buckets:**
- `uploads`: Public bucket for general file uploads
- `profiles`: Private bucket for user profile images

**Authentication:**
- Email/password authentication
- Role-based access control (parent/caregiver)
- Session management

### Environment Variables

**Required for Production:**
```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-key
SUPABASE_ANON_KEY=your-anon-key

# Frontend (Expo)
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Backend
NODE_ENV=production
JWT_SECRET=your-jwt-secret
MONGODB_URI=your-mongodb-connection (if still using MongoDB)
```

## 🚀 Deployment

### Production Setup

```bash
# Generate production configuration
node scripts/setup-production.js

# Review generated files
# - iyaya-admin/.env
# - iyaya-backend/.env.production
# - deploy.sh

# Deploy application
./deploy.sh
```

### Deployment Checklist

- [ ] Database schema applied to Supabase
- [ ] Storage buckets created in Supabase
- [ ] Environment variables configured
- [ ] Data migration completed
- [ ] Tests passing
- [ ] SSL certificates configured
- [ ] DNS pointing to backend domain

## 🔍 Troubleshooting

### Common Issues

**Authentication Issues:**
- Ensure Supabase project is active
- Verify API keys are correct
- Check RLS policies aren't blocking access

**Database Connection:**
- Confirm Supabase URL is correct
- Verify service role key has proper permissions
- Check network connectivity

**File Upload Issues:**
- Ensure storage buckets exist
- Verify bucket policies allow uploads
- Check file size limits

**Migration Issues:**
- Run tests before migration
- Check MongoDB connection
- Verify data transformation logic

### Debug Commands

```bash
# Check Supabase connection
cd iyaya-backend
node -e "const { createClient } = require('@supabase/supabase-js'); const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY); console.log('Connected:', !!client);"

# Test authentication
node scripts/test-supabase-integration.js

# Check environment variables
node -e "console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'Set' : 'Missing');"
```

## 📈 Monitoring

### Logs to Monitor

**Backend:**
```bash
# View backend logs
tail -f iyaya-backend/server.log

# Check for errors
grep -i error iyaya-backend/server.log
```

**Frontend:**
```bash
# Check Expo development logs
npx expo logs

# Monitor build process
npx expo build:status
```

### Health Checks

```bash
# Backend health check
curl http://localhost:5000/api/health

# Supabase dashboard metrics
# Check your Supabase project dashboard for:
# - Database performance
# - Storage usage
# - Authentication stats
# - Real-time connections
```

## 🔄 Rollback Plan

If issues occur after deployment:

1. **Immediate Rollback:**
   ```bash
   # Switch back to Firebase configuration
   git checkout HEAD -- src/config/firebase.js
   git checkout HEAD -- src/contexts/AuthContext.tsx
   git checkout HEAD -- package.json
   ```

2. **Data Preservation:**
   - Supabase data remains intact
   - Can migrate back if needed
   - No data loss during rollback

3. **Gradual Migration:**
   - Test Supabase integration in staging first
   - Migrate users gradually
   - Monitor error rates closely

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Auth Guide](https://supabase.com/docs/guides/auth)
- [Supabase Storage Guide](https://supabase.com/docs/guides/storage)
- [Supabase Realtime Guide](https://supabase.com/docs/guides/realtime)

## 🤝 Support

For issues or questions:
1. Check this migration guide
2. Run the test scripts
3. Review Supabase dashboard logs
4. Check application logs for errors

---

**Migration completed on:** ${new Date().toISOString()}
**Version:** 1.0.0
**Status:** ✅ Complete


Recommended Actions
[Refine query] Update 
fetchDashboardStats()
 to select explicit columns and enable RLS-friendly filtering. Add head requests or metadata checks before fetching full payloads.
[Cache granularity] Store individual section timestamps in AsyncStorage and let loadDashboard() skip sections still within TTL; run stale sections with Promise.allSettled.
[Skeleton rollout] Extend the skeleton system: display skeletons on first render and when sections refetch, and consider using expo-skeleton-loader for richer placeholders.
[Asset/code split] Preload dashboard icons and convert large images; lazy-load secondary widgets or charts using React.lazy/Suspense.
[Resilient fetch] Wrap Supabase calls with retry/backoff and show a snackbar when offline; use AppState to trigger background refresh on foreground entry.

https://github.com/kingdavid28/iYayaAdmin