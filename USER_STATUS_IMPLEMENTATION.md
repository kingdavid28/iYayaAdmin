# User Status Management - Implementation Complete ✅

## What Was Implemented

### 1. Database Enhancements
**File**: `iyaya-backend/migrations/add_suspension_fields.sql`
- Added `suspension_end_date` field for automatic reactivation
- Added `suspension_count` to track repeat offenses
- Added `last_suspension_at` timestamp
- Created `auto_reactivate_expired_suspensions()` function
- Added index for efficient suspension queries

### 2. Enhanced Status Update Logic
**File**: `iyaya-backend/controllers/adminController.js`
- Added `durationDays` parameter for suspensions (default: 7 days)
- Automatic calculation of suspension end date
- Suspension counter increments on each suspension
- Clears suspension data when reactivating
- Tracks suspension history in audit logs

### 3. Professional Email Templates
**File**: `iyaya-backend/services/emailTemplates.js`
- **Suspension Email**: Includes duration, reason, suspension count, appeal process
- **Ban Email**: Permanent closure notice with appeal rights
- **Reactivation Email**: Welcome back message with reminders

**File**: `iyaya-backend/services/emailService.js`
- Updated to use professional templates
- Includes suspension duration in emails
- Shows escalation warnings for repeat offenders

## How to Use

### 1. Apply Database Migration

**Option A: Supabase Dashboard**
1. Go to https://supabase.com/dashboard
2. Select your project → SQL Editor
3. Copy contents of `iyaya-backend/migrations/add_suspension_fields.sql`
4. Paste and click **Run**

**Option B: Command Line**
```bash
psql -d your_database < iyaya-backend/migrations/add_suspension_fields.sql
```

### 2. Suspend a User (API)

```bash
PATCH /api/admin/users/:userId/status
Authorization: Bearer {admin_token}

{
  "status": "suspended",
  "reason": "Multiple late cancellations",
  "durationDays": 7
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "user-id",
    "status": "suspended",
    "statusReason": "Multiple late cancellations",
    "suspension_count": 1
  },
  "message": "User status updated to suspended",
  "suspensionEndDate": "2024-01-15T10:30:00Z"
}
```

### 3. Ban a User (Permanent)

```bash
PATCH /api/admin/users/:userId/status

{
  "status": "banned",
  "reason": "Verified harassment (Report #12345)"
}
```

### 4. Reactivate a User

```bash
PATCH /api/admin/users/:userId/status

{
  "status": "active",
  "reason": "Suspension period completed"
}
```

### 5. Auto-Reactivation (Scheduled)

**Manual Trigger:**
```sql
SELECT auto_reactivate_expired_suspensions();
```

**Automated (requires pg_cron extension):**
```sql
SELECT cron.schedule(
  'auto-reactivate-suspensions', 
  '*/5 * * * *',  -- Every 5 minutes
  'SELECT auto_reactivate_expired_suspensions()'
);
```

**Alternative: Node.js Cron Job**
```javascript
// In your backend
const cron = require('node-cron');
const { supabase } = require('./config/supabase');

// Run every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  const { data, error } = await supabase.rpc('auto_reactivate_expired_suspensions');
  if (error) console.error('Auto-reactivation error:', error);
  else console.log(`Auto-reactivated ${data} users`);
});
```

## Frontend Integration

### Update UserDetailScreen

```typescript
// src/screens/users/UserDetailScreen.tsx

const [durationDays, setDurationDays] = useState(7);

const handleSuspend = async () => {
  await usersService.updateUserStatus(userId, 'suspended', {
    reason: 'Multiple policy violations',
    durationDays: durationDays,
  });
};

// In your JSX:
<TextInput
  label="Suspension Duration (days)"
  value={durationDays.toString()}
  onChangeText={(text) => setDurationDays(parseInt(text) || 7)}
  keyboardType="numeric"
/>
```

### Update usersService

```typescript
// src/services/usersService.ts

export const updateUserStatus = async (
  userId: string,
  status: string,
  options?: {
    reason?: string;
    durationDays?: number;
  }
) => {
  const response = await api.patch(`/admin/users/${userId}/status`, {
    status,
    reason: options?.reason,
    durationDays: options?.durationDays,
  });
  return response.data;
};
```

## Escalation Workflow

The system automatically tracks suspension count:

1. **1st Offense**: 7-day suspension
2. **2nd Offense**: 14-day suspension  
3. **3rd Offense**: 30-day suspension
4. **4th Offense**: Permanent ban

**Implementation:**
```javascript
// In your admin UI
const getSuggestedDuration = (suspensionCount) => {
  switch (suspensionCount) {
    case 0: return 7;   // First suspension
    case 1: return 14;  // Second suspension
    case 2: return 30;  // Third suspension
    default: return null; // Suggest ban
  }
};
```

## Email Notifications

Users automatically receive emails when:
- ✅ Account is suspended (with duration and appeal info)
- ✅ Account is banned (with appeal process)
- ✅ Account is reactivated (welcome back)

**Email includes:**
- Clear reason for action
- Duration (for suspensions)
- Suspension count (for repeat offenders)
- Appeal process
- Next steps

## Monitoring & Metrics

### Check Suspension Stats

```sql
-- Active suspensions
SELECT COUNT(*) FROM users WHERE status = 'suspended';

-- Expiring soon (next 24 hours)
SELECT COUNT(*) FROM users 
WHERE status = 'suspended' 
  AND suspension_end_date < NOW() + INTERVAL '24 hours';

-- Repeat offenders (3+ suspensions)
SELECT id, email, name, suspension_count 
FROM users 
WHERE suspension_count >= 3
ORDER BY suspension_count DESC;

-- Average suspension duration
SELECT AVG(EXTRACT(EPOCH FROM (suspension_end_date - last_suspension_at))/86400) as avg_days
FROM users 
WHERE status = 'suspended' AND suspension_end_date IS NOT NULL;
```

### Audit Trail

All status changes are logged in:
- `audit_logs` table (admin actions)
- `user_status_history` table (status timeline)

```sql
-- View user's status history
SELECT * FROM user_status_history 
WHERE user_id = 'user-id' 
ORDER BY changed_at DESC;

-- View admin's actions
SELECT * FROM audit_logs 
WHERE admin_id = 'admin-id' 
  AND action = 'UPDATE_USER_STATUS'
ORDER BY created_at DESC;
```

## Testing Checklist

- [ ] Apply database migration
- [ ] Suspend a user with 7-day duration
- [ ] Verify email received with correct duration
- [ ] Check suspension_end_date is set correctly
- [ ] Wait for suspension to expire (or manually update date)
- [ ] Run auto-reactivation function
- [ ] Verify user is reactivated
- [ ] Verify reactivation email sent
- [ ] Suspend same user again
- [ ] Verify suspension_count incremented
- [ ] Ban a user
- [ ] Verify ban email received
- [ ] Check audit logs for all actions

## Configuration

### Email Setup

Ensure these environment variables are set:

```env
EMAIL_USERNAME=your-email@gmail.com
EMAIL_PASSWORD=your-app-password
EMAIL_FROM=noreply@iyaya.com
```

### Suspension Defaults

Edit in `adminController.js`:

```javascript
const days = durationDays || 7; // Change default duration here
```

## Best Practices Implemented

✅ **Clear Communication**: Professional email templates  
✅ **Automatic Tracking**: Suspension count and history  
✅ **Escalation Path**: Duration increases with repeat offenses  
✅ **Auto-Reactivation**: Expired suspensions handled automatically  
✅ **Audit Trail**: Complete logging of all actions  
✅ **Appeal Process**: Clear instructions in emails  
✅ **User Rights**: Transparent reasons and timelines  

## Support

For issues:
1. Check backend logs for email sending errors
2. Verify database migration applied successfully
3. Test auto-reactivation function manually
4. Ensure email credentials are configured
5. Check audit logs for action history

---

**Status**: ✅ Fully Implemented  
**Last Updated**: 2024  
**Version**: 1.0
