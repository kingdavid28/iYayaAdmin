// At the top of your serverSupabase.js
require('dotenv').config();

const express = require('express');
const { app } = require('./appSupabase'); // Import your app configuration

// Get port from environment variable or default to 8081
const port = process.env.PORT || 8081;

// Health check endpoint (REQUIRED for Elastic Beanstalk)
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'iyaya-backend'
  });
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`Iyaya Backend running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});

module.exports = app;