# iYaya Admin - React Native Admin Panel

A modern, comprehensive admin panel for the iYaya platform built with React Native and TypeScript. This mobile application provides administrators with powerful tools to manage users, jobs, bookings, and system settings.

## 🚀 Features

### 📊 Dashboard
- Real-time statistics and analytics
- Overview of users, jobs, and bookings
- Activity summary and trends
- Modern card-based UI design

### 👥 User Management
- Complete CRUD operations for users
- User search and filtering
- Status management (active, suspended, banned)
- Detailed user profiles and information
- Bulk operations support

### 💼 Job Management
- View and manage all job listings
- Admin workflow actions (approve, reject, cancel, complete, reopen)
- Status updates and tracking
- Job search and filtering
- Parent and caregiver information
- Job details and applications

### 📅 Booking Management
- Comprehensive booking overview
- Workflow transitions (confirm, start, complete, cancel, mark no-show)
- Parent-caregiver matching
- Booking details and scheduling
- Financial information tracking

### 🔐 Audit Logs
- Complete admin activity tracking
- Security event monitoring
- Action history and timestamps
- IP address and user agent logging
- Superadmin-only access

### ⚙️ System Settings
- Maintenance mode control
- Registration settings
- Email verification requirements
- Background check requirements
- Data export functionality

## 🛠️ Technology Stack

- **React Native** - Cross-platform mobile framework
- **TypeScript** - Type-safe JavaScript
- **React Navigation** - Navigation and routing
- **React Native Paper** - Material Design components
- **React Native Elements** - Additional UI components
- **Axios** - HTTP client for API calls
- **AsyncStorage** - Local data persistence
- **Supabase JavaScript Client** - Realtime database, auth, and storage

## 📋 Prerequisites

- Node.js >= 16.0.0
- npm or yarn package manager
- React Native development environment
- Android Studio (for Android development)
- Xcode (for iOS development)
- iYaya backend server running on `http://localhost:5000`
- Supabase project (URL and service keys with admin privileges)

## 🔧 Installation

1. **Navigate to the project directory:**
   ```bash
   cd iyaya-admin
   ```

2. **Install dependencies:**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Install iOS dependencies (iOS only):**
   ```bash
   cd ios && pod install && cd ..
   ```

## 🚀 Running the Application

### Development Mode

1. **Start the Metro bundler:**
   ```bash
   npm start
   # or
   yarn start
   ```

2. **Run on Android:**
   ```bash
   npm run android
   # or
   yarn android
   ```

3. **Run on iOS:**
   ```bash
   npm run ios
   # or
   yarn ios
   ```

### Backend Configuration

Ensure your iYaya backend is running with the following Supabase-enabled configuration:

1. **Environment Variables:**
   - Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_ANON_KEY`
   - Configure `JWT_SECRET`, `REFRESH_TOKEN_SECRET`, and `CORS_ORIGIN`
   - Optional: enable `AUDIT_ENABLED=true` to persist admin activity logs

2. **Supabase Database:**
   - Apply SQL migrations from `src/migrations/` and `fix-rls-policy.sql`
   - Confirm row-level security (RLS) policies allow only admin/superadmin service keys to access admin data
   - Seed core reference data with scripts under `scripts/`

3. **CORS Configuration:**
   The backend includes Expo Go support and should work with:
   - `http://localhost:19000` (Expo Go)
   - `http://localhost:19006` (Expo DevTools)
   - Your development machine's IP address

### Supabase Setup Checklist

- **Auth:** Configure the Supabase Dashboard with admin/superadmin users. Parents and caregivers use the public booking app and should not access the admin console.
- **Storage (optional):** Create buckets for profile images if image uploads are required, and expose signed URL policies for admins.
- **Realtime:** Enable `messages` and `conversations` tables for realtime monitoring if using in-app messaging.
- **Service Role Usage:** The backend uses the service-role key for privileged operations—store it securely and never bundle it with the mobile app.

## 🔄 Admin Workflows Overview

- **Jobs**
  - Pending/Open ➜ `approveJob()` to move into confirmed state
  - Pending/Open ➜ `rejectJob()` or `cancelJob()` to halt posting
  - Confirmed/Open ➜ `completeJob()` after successful fulfilment
  - Cancelled/Completed ➜ `reopenJob()` to re-list
  - All mutations logged through `auditService.logAction()` with RBAC enforced by `authorize(['admin','superadmin'])`
- **Bookings**
  - Pending Confirmation ➜ `confirmBooking()`
  - Confirmed ➜ `startBooking()` (in-progress)
  - In Progress/Confirmed ➜ `completeBooking()` when service is delivered
  - Any active state ➜ `cancelBooking()` or mark `no_show`
  - Each transition captures before/after state in Supabase `audit_logs`

## 🧪 Testing & Verification

- **Project lint/format**
  - `npm run lint`
  - `npx prettier --check "src/**/*.{ts,tsx}"`
- **Backend health checks**
  - `cd iyaya-backend`
  - `npm install`
  - `npm test` *(if test suite present)*
  - `node scripts/test-frontend-supabase.js` to validate Supabase connectivity
- **Local end-to-end smoke test**
  - Start backend (`npm run dev` in `iyaya-backend/`)
  - Start admin app (`npm start` in project root)
  - Sign in with an admin/superadmin test account

### ✅ QA Checklist

- **Users module**
  - Create, update, delete users via admin console
  - Trigger bulk status updates and confirm Supabase `user_status_history`
  - Verify audit log entries for each mutation
- **Jobs module**
  - Approve ➜ Confirm job appears with updated status
  - Reject/Cancel ➜ Ensure job no longer available for assignment
  - Complete/Reopen ➜ Validate Supabase `jobs.status` and corresponding audit trail
- **Bookings module**
  - Confirm ➜ Start ➜ Complete lifecycle using new buttons
  - Cancel from each active state and confirm notifications/logs
  - Mark No Show and verify status persists after refresh
- **Audit logs**
  - Navigate to Audit screen and filter by recent admin actions
  - Confirm metadata (`from`, `to`, `reason`) captured for job/booking workflows
- **RBAC enforcement**
  - Test with a non-admin credential (should be denied) and note audit security event
- **Supabase policies**
  - Attempt direct table updates without admin role; expect failure per RLS rules

## 📱 Usage

### Authentication

1. Launch the application
2. Enter your admin credentials
3. Access the full admin dashboard

### Navigation

- **Dashboard** - Overview and statistics
- **Users** - User management and profiles
- **Jobs** - Job listings and management
- **Bookings** - Booking management
- **Audit** - Activity logs (Superadmin only)
- **Settings** - System configuration

### User Management

- Search and filter users by type, status, or name
- View detailed user profiles
- Update user status (active, suspended, banned)
- Manage user permissions and roles

### Job Management

- Browse all job listings
- Update job status
- View parent and caregiver information
- Track job applications

### Booking Management

- Monitor all bookings
- Update booking status
- View parent-caregiver matches
- Track financial information

### Audit Logs

- View all admin actions
- Filter by action type or administrator
- Monitor security events
- Track system changes

### System Settings

- Toggle maintenance mode
- Control user registration
- Configure verification requirements
- Export user data

## 🔒 Security Features

- JWT-based authentication
- Secure API communication
- Admin permission validation
- Activity logging and monitoring
- Rate limiting protection
- Input validation and sanitization

## 🎨 UI/UX Features

- Modern Material Design interface
- Responsive card-based layout
- Smooth animations and transitions
- Intuitive navigation
- Consistent color scheme and typography
- Loading states and error handling
- Offline-friendly design

## 📱 Supported Platforms

- **Android** - Full support
- **iOS** - Full support
- **Expo Go** - Development and testing

## 🔧 Development

### Project Structure

```
src/
├── components/          # Reusable UI components
├── contexts/           # React contexts (Auth, etc.)
├── navigation/         # Navigation configuration
├── screens/           # Screen components
│   ├── auth/         # Authentication screens
│   ├── dashboard/    # Dashboard screens
│   ├── users/        # User management screens
│   ├── jobs/         # Job management screens
│   ├── bookings/     # Booking management screens
│   ├── audit/        # Audit log screens
│   └── settings/     # System settings screens
├── services/         # API services and utilities
└── types/           # TypeScript type definitions
```

### API Integration

The app communicates with the iYaya backend through RESTful APIs:

- `/api/admin/dashboard` - Dashboard statistics
- `/api/admin/users` - User management
- `/api/admin/jobs` - Job management
- `/api/admin/bookings` - Booking management
- `/api/admin/audit` - Audit logs
- `/api/admin/settings` - System settings
- `/api/auth/login` - Authentication

### Error Handling

- Comprehensive error handling for API calls
- User-friendly error messages
- Network connectivity checks
- Graceful fallbacks and loading states

## 🐛 Troubleshooting

### Common Issues

1. **Metro bundler not starting:**
   ```bash
   npx react-native start --reset-cache
   ```

2. **Android build issues:**
   - Clear Metro cache
   - Restart Android Studio
   - Check Android SDK configuration

3. **iOS build issues:**
   - Clean build folder: `cd ios && rm -rf build && cd ..`
   - Reinstall pods: `cd ios && pod install && cd ..`

4. **API connection issues:**
   - Verify backend is running on `localhost:5000`
   - Confirm Supabase keys and URL are correct in backend `.env`
   - Ensure admin user exists in Supabase `users` table and has an admin role

### Debug Mode

Enable debug logging by setting:
```javascript
console.log('Debug mode enabled');
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the troubleshooting guide above

## 🔄 Updates

Keep the application updated with:
```bash
npm update
# or
yarn upgrade
```

## 🎯 Future Enhancements

- Push notifications for admin alerts
- Advanced analytics and reporting
- Bulk operations for users and bookings
- Real-time updates via WebSocket
- Enhanced search and filtering
- Multi-language support
- Dark mode theme
- Offline functionality

---

**iYaya Admin** - Empowering administrators with comprehensive management tools for the iYaya platform.

### Test Accounts

- Supabase seed data includes sample admin credentials—check `scripts/setup-production.js` or your Supabase auth dashboard for generated admin emails.
- Parents and caregivers should authenticate through the public booking app; do not grant them Supabase admin roles.

---

## Database Schema

Iyaya now runs entirely on Supabase. We provide two ways to review the structure:

1. Supabase dashboard → Table Editor → public schema
2. Generated ER diagram in `/docs/schema-diagram.png` (exported from Supabase)

### Caregiver schema mapping (Supabase)

| Legacy Mongo collection/field | Supabase location |
| --- | --- |
| `users.status`, `statusReason`, `deletedAt`, `deletedBy`, `statusUpdatedAt`, `statusUpdatedBy` | `public.users.status`, `status_reason`, `deleted_at`, `deleted_by`, `status_updated_at`, `status_updated_by` |
| `Caregiver.caregiverId` | `public.caregiver_profiles.caregiver_id` |
| `Caregiver.profileImage`, `bio`, `experience`, `hourlyRate`, `education`, `languages`, `ageCareRanges`, `availability`, `portfolio`, `emergencyContacts`, `verification`, `trustScore`, `hasCompletedJobs` | `public.caregiver_profiles` JSON/structured columns |
| `Caregiver.certifications` (array with metadata) | `public.caregiver_profiles.certifications` JSONB |
| `Caregiver.documents` array | `public.caregiver_documents` rows (`name`, `url`, `document_type`, `verified`, `verified_at`, `verified_by`, `expiry_date`) |
| `Caregiver.backgroundCheck` object | `public.caregiver_background_checks` rows (`status`, `provider`, `check_types`, `requested_at`, `completed_at`, `verified_at`, `verified_by`, `expiry_date`, `notes`) |
| Status change audit (implicit) | `public.user_status_history` rows (`status`, `reason`, `changed_by`, `changed_at`) and `public.audit_logs` |




# Findings

## Backend

- **[iyaya-backend/controllers/authSupabase.js](cci:7://file:///c:/Users/reycel/iYayaAll2/iyayabackupzip/iyayaforAdmin/iyayaAdmin/iyaya-admin/iyaya-backend/controllers/authSupabase.js:0:0-0:0)**  
  Completed: Supabase-based login/signup/reset scaffolding, role normalization, profile updates, Firebase sync, logout/token refresh.  
  Missing: Email verification sending (`// TODO`), contract logic in [getCurrentUser()](cci:1://file:///c:/Users/reycel/iYayaAll2/iyayabackupzip/iyayaforAdmin/iyayaAdmin/iyaya-admin/iyaya-backend/controllers/authSupabase.js:174:0-221:2), token invalidation on logout, caregiver profile creation on role change, password reset email workflow, audit logging hookups.

- **[iyaya-backend/controllers/adminController.js](cci:7://file:///c:/Users/reycel/iYayaAll2/iyayabackupzip/iyayaforAdmin/iyayaAdmin/iyaya-admin/iyaya-backend/controllers/adminController.js:0:0-0:0)**  
  Completed: Dashboard metrics, user listing/detail, status updates, caregiver doc verification, soft delete, bookings/jobs list/detail/status updates.  
  Missing: Routes for status/job/booking patch are commented out, Supabase migration (still uses Mongoose), duplicate [updateBookingStatus()](cci:1://file:///c:/Users/reycel/iYayaAll2/iyayabackupzip/iyayaforAdmin/iyayaAdmin/iyaya-admin/iyaya-backend/controllers/adminController.js:581:0-645:2) at file end, no create/update/delete endpoints for users beyond status, no bulk operations, limited audit logging coverage.

- **[iyaya-backend/controllers/userController.js](cci:7://file:///c:/Users/reycel/iYayaAll2/iyayabackupzip/iyayaforAdmin/iyayaAdmin/iyaya-admin/iyaya-backend/controllers/userController.js:0:0-0:0)**  
  Completed: Mongo-based profile fetch/update endpoints.  
  Missing: Supabase migration, CRUD for admin usage, alignment with new auth flow.

- **[iyaya-backend/services/supabaseService.js](cci:7://file:///c:/Users/reycel/iYayaAll2/iyayabackupzip/iyayaforAdmin/iyayaAdmin/iyaya-admin/iyaya-backend/services/supabaseService.js:0:0-0:0)**  
  Completed: Supabase wrappers for users, conversations, messages, jobs, bookings, audit logs.  
  Missing: Controllers/routes broadly consuming these methods; some messaging helpers (e.g., name resolution) incomplete.

- **[iyaya-backend/routes/adminRoutes.js](cci:7://file:///c:/Users/reycel/iYayaAll2/iyayabackupzip/iyayaforAdmin/iyayaAdmin/iyaya-admin/iyaya-backend/routes/adminRoutes.js:0:0-0:0)**  
  Completed: Admin guard, dashboard/users/bookings/jobs/audit GET routes.  
  Missing: POST/PUT/PATCH/DELETE for full CRUD, bulk operations, Supabase-specific endpoints.

- **Audit & utilities**  
  [services/auditService.js](cci:7://file:///c:/Users/reycel/iYayaAll2/iyayabackupzip/iyayaforAdmin/iyayaAdmin/iyaya-admin/iyaya-backend/services/auditService.js:0:0-0:0) ready but only partially used. Rate-limiting/auth middleware exist, but RLS/Supabase policies not documented in code.

## Frontend

- **Auth (`src/contexts/AuthContext*.tsx`, `src/screens/auth/*`)**  
  Completed: Supabase-powered login/signup, email resend guard, admin-only restriction.  
  Missing: UI for inviting/creating users from admin console, caregiver/parent login removed (intentional).

- **Dashboard ([src/screens/dashboard/DashboardScreen.tsx](cci:7://file:///c:/Users/reycel/iYayaAll2/iyayabackupzip/iyayaforAdmin/iyayaAdmin/iyaya-admin/src/screens/dashboard/DashboardScreen.tsx:0:0-0:0), `services/dashboardService.ts`)**  
  Completed: Fetch and display of summary widgets with caching.  
  Missing: Drill-down actions, charts/visualizations (if desired).

- **Users ([src/screens/users/UsersScreen.tsx](cci:7://file:///c:/Users/reycel/iYayaAll2/iyayabackupzip/iyayaforAdmin/iyayaAdmin/iyaya-admin/src/screens/users/UsersScreen.tsx:0:0-0:0), `UserDetailScreen.tsx`, [services/usersService.ts](cci:7://file:///c:/Users/reycel/iYayaAll2/iyayabackupzip/iyayaforAdmin/iyayaAdmin/iyaya-admin/src/services/usersService.ts:0:0-0:0))**  
  Completed: Listing, filtering by role, search, status updates, stats.  
  Missing: Create/edit/delete forms, bulk operations, multi-select, Supabase user provisioning, deeper profile editing.

- **Bookings/Jobs (`src/screens/bookings/*`, `src/screens/jobs/*`, associated services`)**  
  Completed: List/detail views, Supabase fetches, status update requests.  
  Missing: Mutation endpoints for admin decisions, bulk operations, audit logging integration.

- **Audit Logs (`src/screens/audit/AuditLogsScreen.tsx`)**  
  Completed: UI scaffolding for log review.  
  Missing: Backend API (`adminController.listAuditLogs`) still Mongo-based; Supabase integration needed.

- **Management/Settings screens**  
  Completed: UI placeholders for analytics, payments, reviews, children, notifications, settings toggles.  
  Missing: Backend endpoints; many screens rely on yet-to-be-implemented services (likely placeholders).

- **Messaging (`src/screens/messages/MessagesScreen.tsx`, [services/messagingService.ts](cci:7://file:///c:/Users/reycel/iYayaAll2/iyayabackupzip/iyayaforAdmin/iyayaAdmin/iyaya-admin/src/services/messagingService.ts:0:0-0:0))**  
  Completed: Supabase realtime wiring, conversation/message retrieval.  
  Missing: User name resolution, pagination, improved error handling.

## Shared

- **README / docs** updated for Supabase but still mention features not yet functional (e.g., full CRUD & bulk operations).  
- **Scripts**: `scripts/setup-production.js`, testing scripts target Supabase, but instructions for running them incomplete.

# Recommended Actions

- **Complete Supabase migration**: Replace remaining Mongo references (`adminController`, `userController`, models) with Supabase service usage; ensure RLS policies and service role handling documented and enforced.

- **Implement full user CRUD**: Create Supabase-backed endpoints for user creation/update/delete (including auth admin API calls), wire frontend forms, and add bulk operations with audit logging.

- **Uncomment/finish admin routes**: Enable status update routes once Supabase versions exist; remove duplicate functions and dead code.

- **Enhance audit logging**: Invoke [auditService.logAction()](cci:1://file:///c:/Users/reycel/iYayaAll2/iyayabackupzip/iyayaforAdmin/iyayaAdmin/iyaya-admin/iyaya-backend/services/auditService.js:61:2-118:3) for every admin mutation (users, bookings, jobs, messaging) and expose logs through Supabase queries.

- **Polish placeholder screens**: Either complete functionality (analytics, payments, reviews, notifications) or mark as roadmap in UI to set expectations.

- **Expand documentation/testing**: Provide end-to-end setup steps for Supabase migrations, RLS policies, and QA checklists covering CRUD and bulk workflows.

This breakdown should help prioritize remaining work to align the app with the advertised feature set.









# Findings
- The core admin workflows depend on server-side Supabase integration, yet critical pieces remain unfinished: user CRUD/bulk operations, consistent Supabase-backed controllers, and secure RBAC enforcement.
- Several front-end screens (users, jobs, bookings, audit) surface data but can’t mutate it end-to-end due to missing APIs.
- Audit logging exists ([iyaya-backend/services/auditService.js](cci:7://file:///c:/Users/reycel/iYayaAll2/iyayabackupzip/iyayaforAdmin/iyayaAdmin/iyaya-admin/iyaya-backend/services/auditService.js:0:0-0:0)) but is sparsely invoked, reducing traceability for sensitive admin actions.

# Recommended Actions
- **[Finalize Supabase migration]**  
  Replace remaining MongoDB logic in [iyaya-backend/controllers/adminController.js](cci:7://file:///c:/Users/reycel/iYayaAll2/iyayabackupzip/iyayaforAdmin/iyayaAdmin/iyaya-admin/iyaya-backend/controllers/adminController.js:0:0-0:0) and [iyaya-backend/controllers/userController.js](cci:7://file:///c:/Users/reycel/iYayaAll2/iyayabackupzip/iyayaforAdmin/iyayaAdmin/iyaya-admin/iyaya-backend/controllers/userController.js:0:0-0:0) with the Supabase service layer. Wire up routes in [iyaya-backend/routes/adminRoutes.js](cci:7://file:///c:/Users/reycel/iYayaAll2/iyayabackupzip/iyayaforAdmin/iyayaAdmin/iyaya-admin/iyaya-backend/routes/adminRoutes.js:0:0-0:0) for POST/PUT/PATCH/DELETE and bulk actions.

- **[Implement user CRUD & bulk ops]**  
  Expose endpoints calling `supabase.auth.admin` APIs alongside [UserService](cci:2://file:///c:/Users/reycel/iYayaAll2/iyayabackupzip/iyayaforAdmin/iyayaAdmin/iyaya-admin/iyaya-backend/services/supabaseService.js:10:0-112:1) to create/update/delete accounts. Extend [src/services/usersService.ts](cci:7://file:///c:/Users/reycel/iYayaAll2/iyayabackupzip/iyayaforAdmin/iyayaAdmin/iyaya-admin/src/services/usersService.ts:0:0-0:0) and [src/screens/users/UsersScreen.tsx](cci:7://file:///c:/Users/reycel/iYayaAll2/iyayabackupzip/iyayaforAdmin/iyayaAdmin/iyaya-admin/src/screens/users/UsersScreen.tsx:0:0-0:0) to support creation forms, editing, deletion, and multi-select bulk status changes.

- **[Enforce RBAC & logging]**  
  Ensure all new routes use `authorize(['admin','superadmin'])` and log mutations through [auditService.logAction()](cci:1://file:///c:/Users/reycel/iYayaAll2/iyayabackupzip/iyayaforAdmin/iyayaAdmin/iyaya-admin/iyaya-backend/services/auditService.js:61:2-118:3). Update Supabase RLS policies so only admin roles can touch admin data.

- **[Backfill domain workflows]**  
  Implement missing job/booking mutation endpoints (approve/reject, cancel, etc.) and wire UI buttons in `src/screens/jobs/` and `src/screens/bookings/` to those APIs. Add tests or QA scripts verifying both happy paths and failure states.

- **[Documentation & QA]**  
  Refresh README to reflect actual capabilities once the above are complete, and supply setup/testing steps. Provide a QA checklist for verifying admin CRUD, bulk operations, and audit logs.

Executing these priorities will turn the app into a functional admin console that matches the advertised feature set while staying secure and auditable.