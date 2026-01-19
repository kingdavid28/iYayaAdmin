# 🚀 Quick Start - Local Development with Solana

## Step 1: Start Solana Backend (Terminal 1)

```bash
cd C:\Users\reycel\Documents\iyayabeforereadme\forTransferIyaya\iyayaSupa
node server.js
```

**Expected Output:**
```
✅ Server running on port 3000
✅ Solana integration ready
✅ Points system active
```

## Step 2: Start Admin App (Terminal 2)

```bash
cd C:\Users\reycel\iYayaAll2\iyayabackupzip\iyayaforAdmin\iyayaAdmin\iyaya-admin
npm start
```

**Then press:**
- `w` - Open in web browser
- `a` - Open on Android
- `i` - Open on iOS

## Step 3: Test Features

### Login
- Email: Your admin email
- Password: Your admin password

### Test Solana Features
1. Navigate to **Management** tab
2. Click **Points System**
3. Award points to users
4. Click **Payments Management**
5. Test Solana payment button

## ✅ What's Working

- ✅ User management
- ✅ Reports system
- ✅ Bookings & Jobs
- ✅ **Solana payments** (NEW)
- ✅ **Points system** (NEW)

## 🔧 Troubleshooting

### Backend won't start
```bash
# Check if port 3000 is in use
netstat -ano | findstr :3000

# Kill the process if needed
taskkill /PID <PID> /F
```

### Admin app can't connect
1. Verify backend is running on port 3000
2. Check `.env.development` has `http://localhost:3000`
3. Clear cache: `npm start -- --clear`

### Solana features not working
1. Check backend console for Solana errors
2. Verify Solana wallet is configured in backend
3. Check network connection

## 📝 Quick Commands

**Restart everything:**
```bash
# Stop both terminals (Ctrl+C)
# Then restart both commands above
```

**Clear cache:**
```bash
npm start -- --clear
```

**View logs:**
```bash
# Backend logs in Terminal 1
# Admin app logs in Terminal 2 and browser console
```

---

**Ready to test!** 🎉
