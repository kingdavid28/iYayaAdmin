// models/index.js
const mongoose = require('mongoose');
const User = require('./User');  // Mongoose model
const Booking = require('./Booking');
const Job = require('./Job');
const Application = require('./Application');
const AuditLog = require('./AuditLog'); // Now a Mongoose model

module.exports = {
  // Mongoose Models
  User,
  Booking,
  Job,
  Application,
  AuditLog
};