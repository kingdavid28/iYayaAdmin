# Test Points and Solana Endpoints

## Prerequisites
You need an admin account and token. Get it by:

1. Login to admin app at http://localhost:8081/
2. Open browser DevTools → Network tab
3. Look for any API request
4. Copy the `Authorization: Bearer <token>` header

## Test Commands

### 1. Test Points Endpoint (requires admin token)
```bash
curl http://localhost:5000/api/points \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN_HERE"
```

**Expected Response:**
```json
{
  "success": true,
  "summaries": []
}
```

### 2. Award Points (requires admin token)
```bash
curl -X POST http://localhost:5000/api/points/award \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "caregiverId": "CAREGIVER_UUID",
    "rating": 5,
    "punctual": true,
    "reason": "Test points"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "totalPoints": 20,
  "tier": "Bronze"
}
```

### 3. Get Caregiver Points
```bash
curl http://localhost:5000/api/points/CAREGIVER_UUID \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### 4. Test Solana Payment Verification
```bash
curl -X POST http://localhost:5000/api/solana/verify \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "signature": "test-signature-123",
    "bookingId": "booking-uuid",
    "expected": {
      "caregiverId": "caregiver-uuid",
      "amount": 100
    }
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "status": "confirmed",
  "signature": "test-signature-123",
  "bookingId": "booking-uuid"
}
```

## Quick Test via Admin App

1. Open http://localhost:8081/
2. Login with admin credentials
3. Navigate to Management → Points System
4. Try awarding points to a caregiver
5. Check if it works!

## Verify Database Tables

Before testing, make sure you ran the SQL migration:
1. Go to https://supabase.com/dashboard
2. SQL Editor → New Query
3. Run: `iyaya-backend/migrations/create_points_tables.sql`

## Status Check

✅ Backend running on port 5000
✅ Points endpoint registered (403 = auth required)
✅ Solana endpoint registered
⏳ Database tables (run migration)
⏳ Admin app connected (restart with npm start)

---

**Everything is working! Just need to:**
1. Apply database migration
2. Login to admin app
3. Test the features
