const mongoose = require('mongoose');

const Order = mongoose.Schema({
    order_id: { type: Number, required: true },
    qty: { type: Number, required: true },
    limit_price: { type: Number, required: true },
    currency: { type: String, required: true },
    orderType: { type: String, required: true },
    dispatched: { 
        type: Boolean, 
        required: true, 
        default: false
    }
});

mongoose.model('order', Order);