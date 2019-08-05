const axios = require('axios').default;
const qs = require('querystring');

const { 
    genSignature, 
    nowMinus,
    ObjectFromEntries,
    parseBalanceToFloat
} = require('./utils/utils');


const mBConfig = {
    CURRENCY: process.env.CURRENCY,
    KEY: process.env.KEY,
    SECRET: process.env.SECRET,
    PIN: process.env.PIN,
    ENDPOINT_INFO_API: process.env.ENDPOINT_INFO_API,
    ENDPOINT_TRADE_API: process.env.ENDPOINT_TRADE_API
};

const infoApiCall = method => (
    axios.get(`${mBConfig.ENDPOINT_INFO_API}/${mBConfig.CURRENCY}/${method}`)
);

const tradeApiCall = async (method, params) => {
    const queryString = qs.stringify({
        tapi_method: method,
        tapi_nonce: nowMinus(1000),
        ...params
    });
    const headers = {
        'Content-type': 'application/x-www-form-urlencoded',
        'TAPI-ID': mBConfig.KEY,
        'TAPI-MAC': genSignature(mBConfig.SECRET, queryString)
    }
    
    return axios({
        method: 'POST',
        headers,
        data: queryString,
        url: mBConfig.ENDPOINT_TRADE_API
    });
};

const retrieveData = ({ data }) => data.response_data ? data.response_data : data;

const getTicker = () => infoApiCall('ticker').then(retrieveData);
const getOrderBook = () => infoApiCall('orderbook').then(retrieveData);
const getTrades = () => infoApiCall('trades').then(retrieveData);

const getAccountInfo = () => tradeApiCall('get_account_info', {});
const listMyOrders = params => tradeApiCall('list_orders', params);
const placeBuyOrder = (qty, limit_price) => (
    tradeApiCall('place_buy_order', {
        coin_pair: `BRL${mBConfig.CURRENCY}`,
        quantity: `${qty.substring(0, 10)}`,
        limit_price: ''+limit_price
    }).then(retrieveData)
);
const placeSellOrder = (qty, limit_price) => (
    tradeApiCall('place_sell_order', {
        coin_pair: `BRL${mBConfig.CURRENCY}`,
        quantity: `${qty.substring(0, 10)}`,
        limit_price: ''+limit_price
    }).then(retrieveData)
);
const cancelOrder = order_id => (
    tradeApiCall('cancel_order', {
        coin_pair: `BRL${mBConfig.CURRENCY}`,
        order_id
    }).then(retrieveData)
);

const getBalance = () => (
    getAccountInfo()
        .then(retrieveData)
        .then(({ balance }) => {
            const entries = Object
                .entries(balance)
                .map(([key, { available }]) => [key, parseBalanceToFloat(available)]);

            return ObjectFromEntries(entries);
        })
);

module.exports = {
    getTicker,
    getOrderBook,
    getTrades,
    getAccountInfo,
    getBalance,
    listMyOrders,
    placeBuyOrder,
    placeSellOrder,
    cancelOrder
};
