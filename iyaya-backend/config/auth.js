// Debug JWT configuration
console.log('🔧 Auth config loading JWT_SECRET:', !!process.env.JWT_SECRET);
if (process.env.JWT_SECRET) {
  console.log('🔧 JWT_SECRET length:', process.env.JWT_SECRET.length);
  console.log('🔧 JWT_SECRET preview:', process.env.JWT_SECRET.substring(0, 10) + '...');
}

module.exports = {
  jwtSecret: process.env.JWT_SECRET,
  refreshTokenSecret: process.env.JWT_REFRESH_SECRET,
  jwtExpiry: process.env.JWT_EXPIRE,
  jwtExpire: process.env.JWT_EXPIRE || '30d',
  refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRE || '90d',
  cookieExpiry: process.env.JWT_COOKIE_EXPIRE
};