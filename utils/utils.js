const crypto = require('crypto');
const moment = require('moment');

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

const nowMinus = (minus) => moment(new Date().getTime()).subtract(10, 'seconds');

const getLastPrice = (envPrice, { last }) => envPrice === 0 ? last : envPrice;
const validArgsAsRequired = (args, obj) => {
    args.forEach(arg => {
        if (!Object.keys(obj).includes(arg))
            throw `Argument ${arg} is required, check --help.`;
    });

    return obj; 
};

const percentToCurrency = (per, currencyPrice) => (per * currencyPrice) / 100;
const currencyToCoin = (currency, currencyPrice) => currency / currencyPrice;
const coinToCurrency = (coin, currencyPrice) => coin * currencyPrice;
const currencyPriceChange = (last, currencyPrice) => (
    ((currencyPrice - last) / last) * 100
);

module.exports = {
    genSignature,
    isBalanceEnough,
    parseBalanceToFloat,
    nowMinus,
    getLastPrice,
    percentToCurrency,
    currencyToCoin,
    coinToCurrency,
    validArgsAsRequired,
    currencyPriceChange
};
