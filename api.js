const axios = require('axios').default;
const qs = require('querystring');

const { 
    genSignature, 
    nowMinus,
    isBalanceEnough,
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

const handleBuyOrder = (ticker, accountBalance) => {
    const qty = parseFloat(process.env.BUY_QTY);
    const limitPrice = ticker.sell;
    const BUY_WHEN_PRICE_LOWER_THAN = parseFloat(process.env.BUY_WHEN_PRICE_LOWER_THAN);
    if (!(ticker.sell < BUY_WHEN_PRICE_LOWER_THAN))
        return console.warn(`Valorização atual de ${ticker.last}, ainda muito alto para realizar compra.`);
    
    if (!isBalanceEnough(accountBalance.brl, BUY_WHEN_PRICE_LOWER_THAN))
        return console.warn('Saldo insuficiente para realizar compra.');

    placeBuyOrder(qty, limitPrice)
        .then(buyOrder => console.info('Ordem de compra inserida ao livro ', buyOrder))
        .catch(e => console.error('Nao foi possivel realizar a compra devido algum erro.'));
};

const handleSellOrder = (ticker, accountBalance) => {
    const qty = parseFloat(process.env.SELL_QTY);
    const limitPrice = ticker.sell;
    const PROFITABILITY = parseFloat(process.env.PROFITABILITY);
    const SELL_WHEN_PRICE_HIGHER_THAN = parseFloat(process.env.SELL_WHEN_PRICE_HIGHER_THAN);

    if (!(SELL_WHEN_PRICE_HIGHER_THAN > ticker.sell))
        return console.warn(`Valorizacao de ${ticker.sell} não atende  o valor de ${SELL_WHEN_PRICE_HIGHER_THAN} para realizar venda.`)

    if (!isBalanceEnough(accountBalance.btc, qty))
        return console.warn('Saldo insuficiente para realizar venda.');

    placeBuyOrder(qty, limitPrice * PROFITABILITY)
        .then(sellOrder => console.info('Ordem de venda inserida ao livro ', sellOrder))
        .catch(e => console.error('Nao foi possivel realizar a venda devido algum erro.'))
};

module.exports = {
    getTicker,
    getOrderBook,
    getTrades,
    getAccountInfo,
    getBalance,
    listMyOrders,
    handleBuyOrder,
    handleSellOrder,
    cancelOrder
};
