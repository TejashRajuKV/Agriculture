import mongoose from 'mongoose';

export const OrderStatus = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'READY_FOR_PICKUP',
  'PICKED_UP',
  'IN_TRANSIT',
  'DELIVERED',
  'CANCELLED'
];
export const OrderPaymentStatus = ['PENDING', 'PAID', 'REFUNDED'];

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true }, // OD-2026-00001
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    buyerName: String,
    buyerType: String,
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    sellerName: String,
    sellerType: String,
    listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
    // Snapshot so the order stays correct if the listing changes later
    item: {
      title: String,
      crop: { type: mongoose.Schema.Types.ObjectId, ref: 'Crop' },
      unit: String,
      qualityGrade: String,
      image: String,
      pickupLocation: String
    },
    quantity: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
    deliveryFee: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    deliveryAddress: String,
    notes: String,
    status: { type: String, enum: OrderStatus, default: 'PENDING' },
    paymentStatus: { type: String, enum: OrderPaymentStatus, default: 'PENDING' },
    deliveryStatus: { type: String, default: 'NOT_SCHEDULED' }, // NOT_SCHEDULED -> SCHEDULED -> PICKED_UP -> IN_TRANSIT -> DELIVERED
    // Set while a logistics trip is carrying this order; the trip then drives pickup and delivery
    delivery: {
      trip: { type: mongoose.Schema.Types.ObjectId, ref: 'Delivery' },
      number: String,
      plate: String
    },
    history: [
      {
        status: String,
        at: { type: Date, default: Date.now },
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
      }
    ]
  },
  { timestamps: true }
);

orderSchema.index({ buyer: 1, createdAt: -1 });
orderSchema.index({ seller: 1, createdAt: -1 });

export default mongoose.model('Order', orderSchema);
