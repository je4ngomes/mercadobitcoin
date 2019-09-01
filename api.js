const axios = require('axios').default;
const mongoose = require('mongoose');
const chalk = require('chalk').default;
const qs = require('querystring');
const R = require('ramda');

const { 
    genSignature, 
    nowMinus,
    parseBalanceToFloat
} = require('./utils/utils');

const mBConfig = global.mBConfig;

const infoApiCall = (method) => (
    axios.get(`${mBConfig.ENDPOINT_INFO_API}/${mBConfig.CURRENCY}/${method}`)
        .then(retrieveData)
);

const tradeApiCall = async (method, params={}) => {
    const queryString = qs.stringify({
        tapi_method: method,
        tapi_nonce: nowMinus(10),
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
    }).then(retrieveData);
};

const retrieveData = ({ data }) => (
    data.response_data ? 
        data.response_data : (
            data.error_message ?
                data.error_message : data
        )          
);

const getTicker = () => infoApiCall('ticker');
const getOrderBook = () => infoApiCall('orderbook');
const getTrades = () => infoApiCall('trades');

const getAccountInfo = () => tradeApiCall('get_account_info');
const listMyOrders = params => (
    tradeApiCall('list_orders', { 
        coin_pair: mBConfig.getCoin(), 
        ...params 
    })
);

const placeBuyOrder = (qty, limit_price) => (
    tradeApiCall('place_buy_order', {
        coin_pair: mBConfig.getCoin(),
        quantity: `${(''+qty).substring(0, 10)}`,
        limit_price: ''+limit_price
    })
);

const placeSellOrder = (qty, limit_price) => (
    tradeApiCall('place_sell_order', {
        coin_pair: mBConfig.getCoin(),
        quantity: `${(''+qty).substring(0, 10)}`,
        limit_price: `${(''+limit_price).substring(0, 5)}`
    })
);

const cancelOrder = (order_id) => (
    tradeApiCall('cancel_order', {
        coin_pair: mBConfig.getCoin(),
        order_id
    })
);

const getBalance = () => (
    getAccountInfo()
        .then(({ balance }) =>
            R.compose(
                R.fromPairs,
                R.map(([key, { available }]) => [key, parseBalanceToFloat(available)]),
                R.toPairs
            )(balance)
        )
);

module.exports = {
    getTicker,
    getOrderBook,
    getTrades,
    getAccountInfo,
    placeBuyOrder,
    placeSellOrder,
    getBalance,
    listMyOrders,
    cancelOrder
};