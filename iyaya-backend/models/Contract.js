const mongoose = require('mongoose');

const ContractSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  serviceType: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  hours: { type: Number, required: true },
  rate: { type: Number, required: true },
  totalAmount: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'active', 'completed', 'cancelled'], 
    default: 'pending' 
  },
  paymentStatus: { 
    type: String, 
    enum: ['pending', 'partial', 'paid'], 
    default: 'pending' 
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String
  },
  specialInstructions: String
}, { timestamps: true });

module.exports = mongoose.model('Contract', ContractSchema);