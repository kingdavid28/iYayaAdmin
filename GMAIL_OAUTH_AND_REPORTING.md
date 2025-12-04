# Gmail OAuth & User Reporting Implementation

## Overview
This implementation adds two major features:
1. **Gmail OAuth Sign-in/Sign-up** - Allow users to authenticate using their Google accounts
2. **User Reporting System** - Enable users to report misconduct, maltreatment, and other issues

## 1. Gmail OAuth Authentication

### Backend Implementation

#### Auth Controller (`iyaya-backend/controllers/authSupabase.js`)
- Added `googleAuth()` function to handle Google OAuth signin/signup
- Automatically creates user account if doesn't exist
- Updates existing user profile with Google data
- Generates JWT tokens for authenticated sessions
- Logs authentication events in audit logs

#### Route (`iyaya-backend/routes/authRoutes.js`)
- `POST /auth/google` - Google OAuth endpoint
- Rate limited to prevent abuse
- Accepts: `{ idToken, accessToken, email, name, profileImage }`

### Frontend Implementation (To Be Added)

You'll need to add Google Sign-In to your React Native app:

```bash
npm install @react-native-google-signin/google-signin
```

#### Example Usage:
```typescript
import { GoogleSignin } from '@react-native-google-signin/google-signin';

// Configure
GoogleSignin.configure({
  webClientId: 'YOUR_WEB_CLIENT_ID',
  offlineAccess: true,
});

// Sign in
const signInWithGoogle = async () => {
  await GoogleSignin.hasPlayServices();
  const userInfo = await GoogleSignin.signIn();
  
  // Send to backend
  const response = await api.post('/auth/google', {
    idToken: userInfo.idToken,
    email: userInfo.user.email,
    name: userInfo.user.name,
    profileImage: userInfo.user.photo,
  });
  
  // Store token and user data
  await AsyncStorage.setItem('authToken', response.data.token);
};
```

## 2. User Reporting System

### Database Schema

#### Table: `user_reports`
```sql
- id (UUID, primary key)
- reporter_id (UUID, references users)
- reported_user_id (UUID, references users)
- report_type (enum: caregiver_misconduct, parent_maltreatment, inappropriate_behavior, safety_concern, payment_dispute, other)
- category (VARCHAR)
- title (VARCHAR, required)
- description (TEXT, required)
- severity (enum: low, medium, high, critical)
- status (enum: pending, under_review, resolved, dismissed)
- evidence_urls (TEXT[])
- booking_id (UUID, optional)
- job_id (UUID, optional)
- admin_notes (TEXT)
- reviewed_by (UUID, references users)
- reviewed_at (TIMESTAMP)
- resolution (TEXT)
- created_at, updated_at (TIMESTAMP)
```

#### Migration File
- Location: `iyaya-backend/migrations/create_reports_table.sql`
- Run: `psql -d your_database < create_reports_table.sql`
- Or apply via Supabase Dashboard → SQL Editor

### Backend Implementation

#### Service Layer (`iyaya-backend/services/reportService.js`)
- `create()` - Create new report
- `findById()` - Get report details
- `getReports()` - List reports with filters
- `updateStatus()` - Update report status
- `getReportStats()` - Get statistics

#### Controller (`iyaya-backend/controllers/reportController.js`)
- `createReport` - POST /auth/reports (authenticated users)
- `getReports` - GET /admin/reports (admin only)
- `getReportById` - GET /admin/reports/:id
- `updateReportStatus` - PATCH /admin/reports/:id/status (admin only)
- `getReportStats` - GET /admin/reports/stats (admin only)
- `getMyReports` - GET /auth/reports/my (user's own reports)

#### Routes
**User Routes** (`/auth/reports`):
- POST `/auth/reports` - Create report (authenticated)
- GET `/auth/reports/my` - View own reports (authenticated)

**Admin Routes** (`/admin/reports`):
- GET `/admin/reports` - List all reports
- GET `/admin/reports/stats` - Get statistics
- GET `/admin/reports/:id` - View report details
- PATCH `/admin/reports/:id/status` - Update status

### Frontend Implementation

#### Service (`src/services/reportsService.ts`)
- TypeScript interfaces for Report and ReportStats
- API methods for all report operations

#### Screens
1. **ReportsScreen** (`src/screens/reports/ReportsScreen.tsx`)
   - List all reports with filters
   - Search functionality
   - Status and severity filters
   - Color-coded severity and status chips

2. **ReportDetailScreen** (`src/screens/reports/ReportDetailScreen.tsx`)
   - View full report details
   - Add admin notes
   - Update report status
   - Add resolution details
   - View reporter and reported user info

### Navigation Setup (To Be Added)

Add to your navigation stack:

```typescript
// In your admin navigation
<Stack.Screen 
  name="Reports" 
  component={ReportsScreen}
  options={{ title: 'User Reports' }}
/>
<Stack.Screen 
  name="ReportDetail" 
  component={ReportDetailScreen}
  options={{ title: 'Report Details' }}
/>
```

## Usage Examples

### Creating a Report (User)

```typescript
import { reportsService } from '../services/reportsService';

const submitReport = async () => {
  try {
    await reportsService.createReport({
      reported_user_id: caregiverId,
      report_type: 'caregiver_misconduct',
      title: 'Caregiver arrived late multiple times',
      description: 'The caregiver has been consistently late...',
      severity: 'medium',
      booking_id: bookingId,
    });
    Alert.alert('Success', 'Report submitted successfully');
  } catch (error) {
    Alert.alert('Error', 'Failed to submit report');
  }
};
```

### Viewing Reports (Admin)

```typescript
// Get all pending reports
const reports = await reportsService.getReports({
  status: 'pending',
  page: 1,
  limit: 20,
});

// Get report statistics
const stats = await reportsService.getReportStats();
console.log(stats.byStatus); // { pending: 5, under_review: 3, resolved: 10 }
```

### Updating Report Status (Admin)

```typescript
await reportsService.updateReportStatus(reportId, {
  status: 'resolved',
  adminNotes: 'Investigated and resolved with both parties',
  resolution: 'Caregiver received warning, parent compensated',
});
```

## Security Features

### Row Level Security (RLS)
- Users can only view their own reports
- Users can create reports
- Admins can view and update all reports
- Automatic timestamp updates

### Audit Logging
- All report creations logged
- Status updates logged with admin ID
- Metadata includes report type, severity, and changes

### Rate Limiting
- Auth endpoints rate limited
- Prevents spam reporting

## Report Types

1. **caregiver_misconduct** - Unprofessional behavior, negligence
2. **parent_maltreatment** - Abuse, harassment of caregivers
3. **inappropriate_behavior** - Inappropriate comments, actions
4. **safety_concern** - Child safety issues
5. **payment_dispute** - Payment-related conflicts
6. **other** - Other issues

## Severity Levels

- **low** - Minor issues, informational
- **medium** - Moderate concerns requiring attention
- **high** - Serious issues requiring immediate review
- **critical** - Urgent safety or legal concerns

## Status Workflow

1. **pending** - Initial state, awaiting admin review
2. **under_review** - Admin is investigating
3. **resolved** - Issue resolved with resolution notes
4. **dismissed** - Report dismissed (invalid, duplicate, etc.)

## Next Steps

1. **Run Database Migration**
   ```bash
   psql -d your_database < iyaya-backend/migrations/create_reports_table.sql
   ```

2. **Add Google OAuth to Frontend**
   - Install `@react-native-google-signin/google-signin`
   - Configure with your Google Cloud credentials
   - Add sign-in button to LoginScreen

3. **Add Report Navigation**
   - Add Reports screen to admin navigation
   - Add "Report User" button to user profiles
   - Add report creation form

4. **Test the Features**
   - Test Google sign-in flow
   - Create test reports
   - Test admin report management
   - Verify RLS policies

## Configuration Required

### Google OAuth Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials
3. Add to `.env`:
   ```
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   ```

### Supabase Setup
1. Apply the migration SQL
2. Verify RLS policies are enabled
3. Test with admin and regular user accounts

## Best Practices

1. **Evidence Collection** - Encourage users to provide evidence URLs
2. **Timely Response** - Review reports within 24-48 hours
3. **Fair Investigation** - Contact both parties before resolution
4. **Documentation** - Keep detailed admin notes
5. **Follow-up** - Notify users of resolution
6. **Privacy** - Protect user information in reports
7. **Escalation** - Have process for critical reports

## Support

For issues or questions:
- Check backend logs for errors
- Verify database migration applied
- Ensure RLS policies are correct
- Test with Postman/curl first
- Check user permissions and roles
