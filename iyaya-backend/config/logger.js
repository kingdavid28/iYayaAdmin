const winston = require('winston');

// Check if running in Vercel serverless environment
const isVercel = process.env.VERCEL || process.env.VERCEL_ENV;

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Add file transports only for non-Vercel environments
if (!isVercel) {
  const path = require('path');
  const fs = require('fs');
  
  // Ensure logs directory exists
  const logsDir = path.join(__dirname, '../logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  
  logger.add(new winston.transports.File({
    filename: path.join(__dirname, '../logs/error.log'),
    level: 'error'
  }));
  
  logger.add(new winston.transports.File({ 
    filename: path.join(__dirname, '../logs/combined.log') 
  }));
}

// Create a stream for morgan
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

module.exports = logger;