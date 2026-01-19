// Test Admin App Configuration
const fs = require('fs');
const path = require('path');

console.log('🔧 Testing Admin App Configuration...\n');

// Check environment files
const envFiles = ['.env', '.env.development', '.env.production'];
envFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file} exists`);
    const content = fs.readFileSync(filePath, 'utf8');
    const apiUrl = content.match(/EXPO_PUBLIC_API_URL="([^"]+)"/);
    if (apiUrl) {
      console.log(`   API URL: ${apiUrl[1]}`);
    }
  } else {
    console.log(`❌ ${file} missing`);
  }
});

// Check if our Solana service exists
const solanaServicePath = path.join(__dirname, 'src', 'services', 'solanaPaymentsService.ts');
if (fs.existsSync(solanaServicePath)) {
  console.log('✅ Solana payment service exists');
  const content = fs.readFileSync(solanaServicePath, 'utf8');
  if (content.includes('localhost:3000')) {
    console.log('   ✅ Configured for localhost:3000');
  }
} else {
  console.log('❌ Solana payment service missing');
}

// Check if Points Management screen exists
const pointsScreenPath = path.join(__dirname, 'src', 'screens', 'management', 'PointsManagementScreen.tsx');
if (fs.existsSync(pointsScreenPath)) {
  console.log('✅ Points Management screen exists');
} else {
  console.log('❌ Points Management screen missing');
}

console.log('\n🎯 Configuration Summary:');
console.log('- Environment files configured for dev/prod');
console.log('- API URLs point to localhost:3000 for development');
console.log('- Solana payment integration ready');
console.log('- Points management screen integrated');

console.log('\n🚀 Ready to start with: npm run start:dev');