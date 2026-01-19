const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');

// Verify Solana payment
router.post('/verify', authenticate, async (req, res) => {
  try {
    const { signature, bookingId, expected } = req.body;
    
    console.log('Payment verification request:', { signature, bookingId, expected });
    
    // TODO: Add actual Solana blockchain verification
    // For now, accept all payments in development
    
    res.json({ 
      success: true,
      status: 'confirmed', 
      signature,
      bookingId,
      message: 'Payment verified successfully' 
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Get payment history
router.get('/history/:userId', authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // TODO: Fetch from Supabase payments table
    
    res.json({ 
      success: true,
      payments: []
    });
  } catch (error) {
    console.error('Payment history error:', error);
    res.status(500).json({ error: 'Failed to fetch payment history' });
  }
});

module.exports = router;
