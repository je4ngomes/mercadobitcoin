const axios = require('axios').default;
const chalk = require('chalk').default;
const qs = require('querystring');
const R = require('ramda');

const { 
    genSignature, 
    nowMinus,
    isBalanceEnough,
    currencyPriceChange,
    currencyToCoin,
    percentToCurrency,
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
        .then(({ balance }) =>
            R.compose(
                R.fromPairs,
                R.map(([key, { available }]) => [key, parseBalanceToFloat(available)]),
                R.toPairs
            )(balance)
        )
);

const handleBuyOrder = (ticker, accountBalance) => {
    const {
        BUY_PER,
        DAILY_PRICE,
        BUY_WHEN_PERCEN_LOWER_THAN
    } = process.env
    const 
        price = percentToCurrency(parseFloat(BUY_PER), ticker.last),
        limitPrice = ticker.sell;

    const qty = currencyToCoin(price, ticker.last);
    const percenChanges = currencyPriceChange(parseFloat(DAILY_PRICE), ticker.last)
    const BUY_WHEN_LOWER = parseFloat(BUY_WHEN_PERCEN_LOWER_THAN);

    console.log(chalk.yellow('Quantidade Compra: ', qty));
    console.log(chalk.yellow('Compra Limite: R$', limitPrice));

    if (!(percenChanges <= BUY_WHEN_LOWER))
        return console.warn(chalk.red(`Compra não realizada, moeda nao está abaixo de ${BUY_WHEN_LOWER}%.`));
    
    if (!isBalanceEnough(accountBalance.brl, 50))
        return console.warn(chalk.red('Saldo insuficiente para realizar compra.'));

    // placeBuyOrder(qty, limitPrice)
    //     .then(buyOrder => console.info(chalk.green('Ordem de compra inserida ao livro.')))
    //     .catch(e => console.error(chalk.red('Nao foi possivel realizar a compra devido algum erro.')));
};

const handleSellOrder = (ticker, accountBalance) => {
    const {
        SELL_PER,
        PROFITABILITY,
        DAILY_PRICE,
        SELL_WHEN_PERCEN_HIGHER_THAN
    } = process.env;
    const 
        price = percentToCurrency(parseFloat(SELL_PER), ticker.last),
        limitPrice = ticker.sell * parseFloat(PROFITABILITY);
    const percenChanges = currencyPriceChange(parseFloat(DAILY_PRICE), ticker.last)
    const qty = currencyToCoin(price, ticker.last);
    const SELL_WHEN_HIGHER = parseFloat(SELL_WHEN_PERCEN_HIGHER_THAN);

    console.log(chalk.yellow('Quantidade Venda: ', qty));
    console.log(chalk.yellow('Venda Limite: R$', limitPrice));
    console.log(chalk.yellow('Valorização %: ', percenChanges, '%'));

    if (!(percenChanges >= SELL_WHEN_HIGHER))
        return console.warn(chalk.red(`Venda não realizada, moeda nao está acima de ${SELL_WHEN_HIGHER}%.`))

    if (!isBalanceEnough(accountBalance.btc, qty))
        return console.warn(chalk.red('Saldo insuficiente para realizar venda.'));

    // placeSellOrder(qty, limitPrice)
    //     .then(sellOrder => console.info(chalk.green('Ordem de venda inserida ao livro.')))
    //     .catch(e => console.error(chalk.red('Nao foi possivel realizar a venda devido algum erro.')))
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
