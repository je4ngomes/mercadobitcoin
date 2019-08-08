const mongoose = require('mongoose');

const Order = mongoose.Schema({
    order_id: { type: String, required: true },
    quantity: { type: Number, required: true },
    limitPrice: { type: Number, required: true },
    operation: { type: String, required: true },
    dispatched: { type: Boolean, default: false }
});

mongoose.model('order', Order);