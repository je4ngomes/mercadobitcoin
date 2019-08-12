const mongoose = require('mongoose');

const Order = mongoose.Schema({
    order_id: { type: String, required: true },
    qty: { type: Number, required: true },
    limitPrice: { type: Number, required: true },
    type: { type: String, required: true },
    dispatched: { type: Boolean, default: false }
});

mongoose.model('order', Order);