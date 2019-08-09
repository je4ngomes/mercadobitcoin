const axios = require('axios').default;
const chalk = require('chalk').default;
const mongoose = require('mongoose');
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

const Order = mongoose.model('order');
const mBConfig = {
    CURRENCY: null,
    KEY: null,
    SECRET: null,
    PIN: null,
    ENDPOINT_INFO_API: 'https://www.mercadobitcoin.com.br/api',
    ENDPOINT_TRADE_API: 'https://www.mercadobitcoin.net/tapi/v3/'
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

const setBuyOrder = ({ BUY_PER, BUY_WHEN_PER_LOWER }) =>
    (ticker, accountBalance, last6hPrice) => {
    const 
        price = percentToCurrency(BUY_PER, ticker.last),
        limitPrice = ticker.sell;
    const qty = currencyToCoin(price, ticker.last);
    const percenChanges = currencyPriceChange(last6hPrice, ticker.last)

    console.log(chalk.yellow('Quantidade Compra: ', qty));
    console.log(chalk.yellow('Compra Limite: R$', limitPrice));

    if (!(percenChanges <= BUY_WHEN_PER_LOWER))
        return console.warn(chalk.red(`Compra não realizada, moeda nao está abaixo de ${BUY_WHEN_PER_LOWER}%.`));
    
    if (!isBalanceEnough(accountBalance.brl, 50))
        return console.warn(chalk.red('Saldo insuficiente para realizar compra.'));

    placeBuyOrder(qty, limitPrice)
        .then(buyOrder => {
            console.info(chalk.green('Ordem de compra inserida ao livro.'));

            new Order({ 
                order_id: buyOrder.order.order_id,
                qty: buyOrder.order.quantity,
                limitPrice: buyOrder.order.limit_price
             })
        })
        .catch(e => console.error(chalk.red('Nao foi possivel realizar a compra devido algum erro.')));
};

const setSellOrder = ({ PROFIT, SELL_WHEN_PER_HIGHER }) =>
    (ticker, accountBalance, last6hPrice) => {
    const percenChanges = currencyPriceChange(last6hPrice, ticker.last);

    if (!(percenChanges >= SELL_WHEN_PER_HIGHER))
        return console.warn(chalk.red(`Venda não realizada, moeda nao está acima de ${SELL_WHEN_PER_HIGHER}%.`))


    Order.findOne({ dispatched: false, type: 'BUY' })
        .sort({ qty: 1 })
        .then(doc => {
            const profitIncluded = doc.limitPrice * PROFIT;
            const limit = (
                profitIncluded > ticker.sell
                    ? profitIncluded 
                    : ticker.sell
            );

            console.log(chalk.yellow('Quantidade Venda: ', doc.qty));
            console.log(chalk.yellow('Venda Limite: R$', limit));
            console.log(chalk.yellow(`Valorização %: ${percenChanges}%`));

            if (!isBalanceEnough(accountBalance.btc, doc.qty))
                return console.warn(chalk.red('Saldo insuficiente para realizar venda.'));
        
            placeSellOrder(doc.qty, limit)
                .then(sellOrder => {
                    console.info(chalk.green('Ordem de venda inserida ao livro.'));
                    
                    // delete buy order
                    Order.deleteOne({ _id: doc.id });
                })
                .catch(e => console.error(chalk.red('Nao foi possivel realizar a venda devido algum erro.')))
        })
        .catch(e => console.error('Erro no banco de dados.'));
};

module.exports = ({
    BUY_WHEN_PER_LOWER,
    BUY_PER,
    SELL_WHEN_PER_HIGHER,
    PROFIT=1.029,
    CURRENCY='BTC'
}) => {
    // set exchange global config
    mBConfig.CURRENCY = CURRENCY;


    return {
        getTicker,
        getOrderBook,
        getTrades,
        getAccountInfo,
        getBalance,
        listMyOrders,
        handleBuyOrder: setBuyOrder({ BUY_PER, BUY_WHEN_PER_LOWER }),
        handleSellOrder: setSellOrder({ PROFIT, SELL_WHEN_PER_HIGHER }),
        cancelOrder
    };
}