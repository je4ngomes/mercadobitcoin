const crypto = require('crypto');

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

const nowMinus = (minus) => Math.round(new Date().getTime() / minus);

const getLast6hPrice = (envPrice, { last }) => envPrice === 0 ? last : envPrice;
const validArgsAsRequired = (args, obj) => {
    args.forEach(arg => {
        if (!Object.keys(obj).includes(arg))
            throw `Argument ${arg} is required, check --help.`;
    });

    return obj; 
};

const percentToCurrency = (per, currencyPrice) => (per * currencyPrice) / 100;
const currencyToCoin = (currency, currencyPrice) => currency / currencyPrice;
const currencyPriceChange = (price24h, currencyPrice) => (
    ((price24h - currencyPrice) / price24h) * 100
);

module.exports = {
    genSignature,
    isBalanceEnough,
    parseBalanceToFloat,
    nowMinus,
    getLast6hPrice,
    percentToCurrency,
    currencyToCoin,
    validArgsAsRequired,
    currencyPriceChange
};