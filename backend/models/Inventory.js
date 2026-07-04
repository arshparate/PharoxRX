const mongoose = require('mongoose');

const InventorySchema = new mongoose.Schema({
  shop: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
  medicineName: { type: String, required: true, trim: true },
  price: { type: Number, required: true },
  isOutOfStock: { type: Boolean, default: false },
  medicineImage: { type: String } // Path or URL to the medicine image
}, { timestamps: true });

// Create indexes to optimize text searches on medicine names and filters
InventorySchema.index({ medicineName: 'text' });
InventorySchema.index({ shop: 1 });

module.exports = mongoose.model('Inventory', InventorySchema);
