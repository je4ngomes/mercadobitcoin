const crypto = require('crypto');

const genSignature = (secret, queryString) => (
    crypto.createHmac('sha512', secret)
        .update(`/tapi/v3/?${queryString}`)
        .digest('hex')
);

const ObjectFromEntries = (entries) => (
    entries.reduce((acc, [key, val]) => ({ ...acc, [key]: val }), {})
);

const parseBalanceToFloat = (balance, fixed=5) =>
    parseFloat(parseFloat(balance).toFixed(fixed));

const isBalanceEnough = (currentBalance, amount) => (
    parseFloat(currentBalance) >= parseFloat(amount)
);

const nowMinus = (minus) => Math.round(new Date().getTime() / minus);

const percentToCurrency = (per, currencyPrice) => (per * currencyPrice) / 100;
const currencyToCoin = (currency, currencyPrice) => currency / currencyPrice;
const currencyPriceChange = (price24h, currencyPrice) => (
    ((price24h - currencyPrice) / price24h) * 100
);

module.exports = {
    genSignature,
    isBalanceEnough,
    ObjectFromEntries,
    compose,
    parseBalanceToFloat,
    nowMinus,
    percentToCurrency,
    currencyToCoin,
    currencyPriceChange
};