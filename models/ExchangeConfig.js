const mongoose = require('mongoose');

const ExchangeConfig = mongoose.Schema({
    last3hPrice: { type: Number, required: true }
});

mongoose.model('exchangeconfig', ExchangeConfig);