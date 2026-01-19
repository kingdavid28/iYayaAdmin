const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Award points to caregiver
router.post('/award', authenticate, authorize(['admin', 'superadmin']), async (req, res) => {
  try {
    const { caregiverId, rating, punctual, reason } = req.body;
    
    if (!caregiverId) {
      return res.status(400).json({ error: 'caregiverId is required' });
    }
    
    const deltas = [
      { metric: 'rating', delta: rating >= 4 ? 10 : rating >= 3 ? 5 : -5, reason: `rating=${rating}` },
      { metric: 'completion', delta: 5, reason: 'completed booking' },
      { metric: 'punctuality', delta: punctual ? 5 : -3, reason: punctual ? 'on-time' : 'late' }
    ];
    
    // Insert points
    for (const { metric, delta, reason: pointReason } of deltas) {
      const { error } = await supabase.from('caregiver_points_ledger').insert({
        caregiver_id: caregiverId,
        metric,
        delta,
        reason: reason || pointReason
      });
      
      if (error) {
        console.error('Points insertion error:', error);
      }
    }
    
    // Calculate total
    const { data: ledger } = await supabase
      .from('caregiver_points_ledger')
      .select('delta')
      .eq('caregiver_id', caregiverId);
    
    const totalPoints = ledger?.reduce((sum, entry) => sum + entry.delta, 0) || 0;
    const tier = totalPoints >= 500 ? 'Platinum' : 
                 totalPoints >= 250 ? 'Gold' : 
                 totalPoints >= 100 ? 'Silver' : 'Bronze';
    
    // Update summary
    await supabase.from('caregiver_points_summary').upsert({
      caregiver_id: caregiverId,
      total_points: totalPoints,
      last_updated: new Date().toISOString()
    });
    
    res.json({ success: true, totalPoints, tier });
  } catch (error) {
    console.error('Award points error:', error);
    res.status(500).json({ error: 'Failed to award points' });
  }
});

// Get caregiver points
router.get('/:caregiverId', authenticate, async (req, res) => {
  try {
    const { caregiverId } = req.params;
    
    const { data: summary } = await supabase
      .from('caregiver_points_summary')
      .select('*')
      .eq('caregiver_id', caregiverId)
      .single();
      
    const { data: recent } = await supabase
      .from('caregiver_points_ledger')
      .select('*')
      .eq('caregiver_id', caregiverId)
      .order('created_at', { ascending: false })
      .limit(10);
      
    res.json({ 
      success: true,
      summary: summary || { total_points: 0, caregiver_id: caregiverId },
      recent: recent || []
    });
  } catch (error) {
    console.error('Fetch points error:', error);
    res.status(500).json({ error: 'Failed to fetch points' });
  }
});

// Get all caregivers points (admin only)
router.get('/', authenticate, authorize(['admin', 'superadmin']), async (req, res) => {
  try {
    const { data: summaries } = await supabase
      .from('caregiver_points_summary')
      .select('*')
      .order('total_points', { ascending: false });
      
    res.json({ success: true, summaries: summaries || [] });
  } catch (error) {
    console.error('Fetch all points error:', error);
    res.status(500).json({ error: 'Failed to fetch points' });
  }
});

module.exports = router;
