# Bookings Tab Fix

## Issues Fixed

### 1. Missing API Method
The `getBookings` method was missing from the frontend API service, causing the bookings tab to fail when trying to fetch data.

**Fixed in:** `src/services/apiService.ts`
- Added `getBookings` method to `adminApi` object

### 2. Network Configuration
The frontend was configured to use `localhost` which doesn't work on mobile devices/emulators.

**Fixed in:** `.env`
- Updated `EXPO_PUBLIC_API_HOST` to `"192.168.1.9"` (your network IP)

**Fixed in:** `iyaya-backend/.env`
- Added `http://192.168.1.9:8081` and `http://192.168.1.9:19006` to `CORS_ORIGIN`

## How to Apply the Fix

### Step 1: Restart Backend Server
```bash
cd iyaya-backend
# Stop the current server (Ctrl+C if running)
npm start
```

### Step 2: Restart Frontend App
```bash
# In the root directory
npx expo start --clear
```

The `--clear` flag clears the Metro bundler cache to ensure the new API method is loaded.

### Step 3: Verify the Fix
1. Open the app on your device/emulator
2. Navigate to the Bookings tab
3. The bookings should now load properly

## What Was Wrong

### Network Request Failed Errors
These occurred because:
1. The app was trying to connect to `localhost:5000`
2. Mobile devices/emulators can't reach `localhost` - they need the computer's network IP
3. The CORS settings didn't include the network IP

### Bookings Tab Not Displaying
This occurred because:
1. The `adminApi.getBookings()` method was missing from `apiService.ts`
2. The `bookingsService.ts` was calling this non-existent method
3. This caused the API call to fail silently

## Testing the Connection

Run this PowerShell script to verify connectivity:
```powershell
.\test-connection.ps1
```

Both localhost and network IP should return status 200.

## Important Notes

### IP Address Changes
If your computer's IP address changes (e.g., you connect to a different WiFi network):
1. Run `ipconfig` to get the new IP
2. Update `EXPO_PUBLIC_API_HOST` in `.env`
3. Add the new IP to `CORS_ORIGIN` in `iyaya-backend/.env`
4. Restart both servers

### Development vs Production
- **Development:** Use network IP (e.g., `192.168.1.9`)
- **Production:** Use your deployed API URL

### Troubleshooting

If bookings still don't load:
1. Check the backend console for errors
2. Check the frontend console/logs for API errors
3. Verify the backend is running on port 5000
4. Verify both devices are on the same WiFi network
5. Try clearing the app cache: `npx expo start --clear`

### Backend API Endpoint
The bookings are fetched from:
```
GET http://192.168.1.9:5000/api/admin/bookings
```

With optional query parameters:
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)
- `status` - Filter by status (optional)
- `search` - Search term (optional)
