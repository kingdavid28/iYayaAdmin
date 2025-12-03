// At the top of your serverSupabase.js
require("dotenv").config();

const express = require("express");
const { app } = require("./app"); // Import your app configuration

// Health check endpoint (REQUIRED for Vercel)
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    service: "iyaya-backend",
    environment: process.env.NODE_ENV || 'development'
  });
});

// Export for Vercel serverless
module.exports = app;

module.exports = app;
