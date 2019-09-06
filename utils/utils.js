const crypto = require('crypto');
const mongoose = require('mongoose');
const moment = require('moment');

// const Order = mongoose.model('order');

const genSignature = (secret, queryString) => (
    crypto.createHmac('sha512', secret)
        .update(`/tapi/v3/?${queryString}`)
        .digest('hex')
);

const parseBalanceToFloat = (balance, fixed=5) =>
    parseFloat(parseFloat(balance).toFixed(fixed));

const isBalanceEnough = (currentBalance, amount) => (
    parseFloat(currentBalance) >= parseFloat(amount)
);

const nowMinus = (seconds) => moment(new Date().getTime()).subtract(seconds, 'seconds').valueOf();

const getLastPrice = (envPrice, { last }) => envPrice === 0 ? last : envPrice;

const validArgsAsRequired = (args, obj) => {
    args.forEach(arg => {
        if (!Object.keys(obj).includes(arg))
            throw `Argument ${arg} is required, check --help.`;
    });

    return obj; 
};

const setBuyLimitPrice = (ticker, per) => ticker.sell - ((per / 100) * ticker.sell);

const priceWithExchangeTaxes = (price, taxes) => (
    price + percentToCurrency(taxes, price)
);

const percentToCurrency = (per, currencyPrice) => (per * currencyPrice) / 100;

const currencyToCoin = (currency, currencyPrice) => currency / currencyPrice;

const percentToCoin = (per, currencyPrice) => (
    currencyToCoin(
        percentToCurrency(per, currencyPrice),
        currencyPrice
    )
);

const coinToCurrency = (coin, currencyPrice) => coin * currencyPrice;

const currencyPriceChange = (last, currencyPrice) => (
    ((currencyPrice - last) / last) * 100
);

const getProfit = (limitePriceBuy, limitePriceSell, qty) => (
    coinToCurrency(qty, limitePriceSell) - coinToCurrency(qty, limitePriceBuy)
);

const perBetween = (initValue, postValue) => ((postValue - initValue) / initValue) * 100;

const saveOrder = ({ order }, orderType, currency) => (
    new Order({
        order_id: order.order_id,
        qty: order.quantity,
        limit_price: order.limit_price,
        orderType,
        currency
    }).save()
);


module.exports = {
    genSignature,
    isBalanceEnough,
    parseBalanceToFloat,
    nowMinus,
    percentToCoin,
    saveOrder,
    setBuyLimitPrice,
    priceWithExchangeTaxes,
    getLastPrice,
    getProfit,
    percentToCurrency,
    currencyToCoin,
    coinToCurrency,
    perBetween,
    validArgsAsRequired,
    currencyPriceChange
};
