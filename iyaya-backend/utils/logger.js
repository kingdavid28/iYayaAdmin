const winston = require("winston");
const { combine, timestamp, printf, colorize } = winston.format;

const logFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level}]: ${message}`;
});

const transports = [new winston.transports.Console({ format: combine(colorize(), logFormat) })];

if (process.env.VERCEL !== '1') {
  transports.push(
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" })
  );
}

const logger = winston.createLogger({
  level: "info",
  format: combine(timestamp(), logFormat),
  transports,
});

module.exports = logger;
