# User Status Management Best Practices

## Status Types & When to Use

### 1. ACTIVE
- Default status for verified users
- Full platform access
- Can book/accept jobs

### 2. SUSPENDED (Temporary Ban)
**Use When:**
- Investigating complaints (3-7 days)
- Payment disputes (until resolved)
- First-time policy violation (7-14 days)
- Incomplete verification renewal (30 days)
- Multiple late cancellations (7 days)
- Suspicious activity detected (pending review)

**Process:**
1. Document reason clearly
2. Notify user via email with:
   - Reason for suspension
   - Duration (if known)
   - Steps to resolve
   - Appeal process
3. Set `status_reason` field
4. Log in audit trail
5. Schedule review date

**Example Reasons:**
```
"Under investigation for report #12345 - Expected resolution within 7 days"
"Payment dispute with booking #67890 - Suspended until resolved"
"Multiple late cancellations - 7-day suspension"
"Background check expired - Suspended until renewed"
```

### 3. BANNED (Permanent Ban)
**Use When:**
- Verified abuse/harassment
- Criminal activity discovered
- Identity fraud confirmed
- 3+ suspensions in 6 months
- Serious safety violations
- Theft or financial fraud
- Threatening behavior
- Repeated policy violations after warnings

**Process:**
1. Thorough investigation required
2. Document all evidence
3. Legal review if needed
4. Final warning (except safety issues)
5. Permanent ban with detailed reason
6. Notify user with appeal rights
7. Refund/payment settlement
8. Block from re-registration

**Example Reasons:**
```
"Permanent ban: Verified harassment of caregiver (Report #12345)"
"Account terminated: Identity fraud detected"
"Banned: 3 suspensions in 6 months - repeated policy violations"
"Permanent ban: Safety violation - left child unattended"
```

### 4. INACTIVE
**Use When:**
- User requested account deletion
- No activity for 12+ months
- Failed to complete onboarding in 30 days
- Duplicate account cleanup

## Implementation Workflow

### Suspension Workflow
```
1. Report received → Status: ACTIVE
2. Investigation starts → Status: SUSPENDED
   - Reason: "Under investigation for [issue]"
   - Duration: 3-7 days
3. Investigation complete:
   - If innocent → Status: ACTIVE
   - If guilty (minor) → Status: SUSPENDED (7-30 days)
   - If guilty (severe) → Status: BANNED
```

### Escalation Path
```
1st Offense: Warning (email)
2nd Offense: 7-day suspension
3rd Offense: 30-day suspension
4th Offense: Permanent ban
```

**Exception**: Safety violations → Immediate ban

## Admin Actions Required

### Before Suspending:
- [ ] Review all evidence
- [ ] Check user history
- [ ] Verify report authenticity
- [ ] Document reason clearly
- [ ] Set expected resolution date

### Before Banning:
- [ ] Complete investigation
- [ ] Review with senior admin
- [ ] Document all evidence
- [ ] Check legal implications
- [ ] Prepare user notification
- [ ] Plan refund/payment handling

### After Status Change:
- [ ] Send notification email
- [ ] Log in audit trail
- [ ] Update related bookings/jobs
- [ ] Notify affected parties
- [ ] Schedule follow-up review

## Notification Templates

### Suspension Email
```
Subject: Account Temporarily Suspended

Dear [Name],

Your iYaya account has been temporarily suspended.

Reason: [Clear explanation]
Duration: [X days or "pending investigation"]
What happens now: [Next steps]

To resolve:
1. [Action required]
2. [Contact information]

Appeal: Reply to this email within 7 days

Best regards,
iYaya Admin Team
```

### Ban Email
```
Subject: Account Permanently Closed

Dear [Name],

After careful review, your iYaya account has been permanently closed.

Reason: [Detailed explanation]
Effective: Immediately

This decision is final. However, you may appeal by:
- Emailing: appeals@iyaya.com
- Providing: [Required documentation]
- Deadline: 30 days from this notice

Outstanding payments: [Settlement details]

Best regards,
iYaya Admin Team
```

## Code Implementation

### Update User Status
```typescript
// Suspend user
await usersService.updateUserStatus(userId, 'suspended', {
  reason: 'Under investigation for report #12345',
  duration: '7 days',
  reviewDate: '2024-01-15',
  adminId: currentAdmin.id,
});

// Ban user
await usersService.updateUserStatus(userId, 'banned', {
  reason: 'Permanent ban: Verified harassment (Report #12345)',
  permanent: true,
  adminId: currentAdmin.id,
});
```

### Automatic Suspension Expiry
```sql
-- Cron job to auto-reactivate after suspension period
UPDATE users 
SET status = 'active', 
    status_reason = 'Suspension period completed'
WHERE status = 'suspended' 
  AND suspension_end_date < NOW()
  AND suspension_end_date IS NOT NULL;
```

## Metrics to Track

### Monitor:
- Suspension rate (should be <5% of active users)
- Ban rate (should be <1% of active users)
- Average suspension duration
- Appeal success rate
- Repeat offender rate
- Time to resolution

### Red Flags:
- Suspension rate >10% → Review policies
- Ban rate >3% → Improve onboarding
- Many appeals → Review investigation process
- Long resolution times → Add admin resources

## Legal Considerations

### Document Everything:
- All evidence and reports
- Investigation timeline
- Admin decisions and reasoning
- User communications
- Appeal process

### User Rights:
- Right to know reason
- Right to appeal
- Right to data export
- Right to refund (if applicable)
- Right to delete account

### Platform Protection:
- Terms of Service violations
- Safety of other users
- Legal compliance
- Reputation management

## Appeal Process

### User Can Appeal:
1. Within 30 days of ban
2. Via email to appeals@iyaya.com
3. Must provide new evidence
4. Reviewed by different admin

### Appeal Review:
- 7-day response time
- Independent review
- Document decision
- Final decision communicated
- No further appeals

## Automation Opportunities

### Auto-Suspend:
- 3+ reports in 7 days
- Payment chargeback
- Failed background check
- Expired documents

### Auto-Ban:
- Criminal record discovered
- Identity verification failed
- Blacklisted email/phone

### Auto-Reactivate:
- Suspension period ended
- Issue resolved
- Payment completed
- Documents verified

## Summary

**Suspended**: Temporary, reversible, for investigation or minor issues
**Banned**: Permanent, for severe violations or repeated offenses
**Key**: Clear communication, fair process, thorough documentation


Google OAuth Implementation : Added Gmail signin/signup functionality with backend endpoint, frontend service, and login screen integration; configured Google Cloud OAuth credentials (Web, Android, iOS Client IDs)

User Reporting System : Implemented complete misconduct reporting feature with database schema, backend services/controllers, frontend screens, and navigation integration

User Status Management Best Practices : Fully implemented suspension/ban system with duration tracking, auto-reactivation, professional email templates, escalation workflow, and audit logging