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
    coinToCurrency,
    percentToCurrency,
    parseBalanceToFloat
} = require('./utils/utils');

const Order = mongoose.model('order');
const mBConfig = {
    CURRENCY: null,
    getCoin() { return `BRL${this.CURRENCY}` },
    KEY: process.env.KEY,
    SECRET: process.env.SECRET,
    PIN: process.env.PIN,
    ENDPOINT_INFO_API: 'https://www.mercadobitcoin.com.br/api',
    ENDPOINT_TRADE_API: 'https://www.mercadobitcoin.net/tapi/v3/'
};

const infoApiCall = (method) => (
    axios.get(`${mBConfig.ENDPOINT_INFO_API}/${mBConfig.CURRENCY}/${method}`)
        .then(retrieveData)
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

const getAccountInfo = () => tradeApiCall('get_account_info', {});
const listMyOrders = params => (
    tradeApiCall('list_orders', { 
        coin_pair: mBConfig.getCoin(), 
        ...params 
    })
)

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

const setBuyOrder = ({ BUY_PER, BUY_WHEN_PER_LOWER }) =>
    (ticker, accountBalance, lastPrice) => {
    const 
        price = percentToCurrency(BUY_PER, ticker.last),
        priceWithExchanTaxes = (
            price >= 50 
                ? price + percentToCurrency(0.70, price) 
                : 50 + percentToCurrency(0.70, 50)
        ),
        limitPrice = ticker.sell;
    const qty = currencyToCoin(priceWithExchanTaxes, ticker.last);
    const percenChanges = currencyPriceChange(lastPrice, ticker.last)

    console.log(chalk.yellow('Quantidade Compra: ', qty));
    console.log(chalk.yellow('Compra Limite: R$', limitPrice));
    
    if (!(percenChanges <= BUY_WHEN_PER_LOWER))
        return console.warn(chalk.red(`Compra não realizada, moeda nao está abaixo de ${BUY_WHEN_PER_LOWER}%.`));
    
    if (!isBalanceEnough(accountBalance.brl, 50))
        return console.warn(chalk.red('Saldo insuficiente para realizar compra.'));

    placeBuyOrder(qty, limitPrice)
        .then(buyOrder => {
            console.info(chalk.green('Ordem de compra inserida ao livro. ', buyOrder));

            new Order({ 
                order_id: buyOrder.order.order_id,
                qty: currencyToCoin(price, ticker.last),
                limitPrice: buyOrder.order.limit_price,
                type: 'BUY'
             }).save();
        })
        .catch(e => console.error(chalk.red('Nao foi possivel realizar a compra devido algum erro.'), e));
};

const setSellOrder = ({ PROFIT, SELL_WHEN_PER_HIGHER }) =>
    (ticker, accountBalance) => {

    Order.findOne({ type: 'BUY', limitPrice: { $lt: ticker.sell } })
        .sort({ limitPrice: 1 })
        .then(doc => {            
            if (!doc)
                return console.warn(chalk.red(`Não a compras anteriores no banco de dados para realizar venda.`));

            const percenChanges = currencyPriceChange(doc.limitPrice, ticker.last);            

            if (!(percenChanges >= SELL_WHEN_PER_HIGHER))
                return console.warn(chalk.red(`Venda não realizada, moeda nao está acima de ${SELL_WHEN_PER_HIGHER}%.`));

            if (!isBalanceEnough(accountBalance.btc, doc.qty))
                return console.warn(chalk.red('Saldo insuficiente para realizar venda.'));


            const profitIncluded = doc.limitPrice * PROFIT;
            const limit = (
                profitIncluded > ticker.sell
                    ? profitIncluded 
                    : ticker.sell
            );

            console.log(chalk.yellow('Quantidade Venda: ', doc.qty));
            console.log(chalk.yellow('Venda Limite: R$', limit));
            console.log(chalk.yellow(`Valorização %: ${percenChanges}%`));
        
            placeSellOrder(doc.qty, limit)
                .then(async sellOrder => {
                    console.info(chalk.green('Ordem de venda inserida ao livro. '), sellOrder);
                    
                    // delete buy order
                    await Order.findOne({ _id: doc.id });
                })
                .catch(e => console.error(chalk.red('Nao foi possivel realizar a venda devido algum erro.')))
        })
        .catch(e => console.error('Erro no banco de dados.', e));
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
        placeSellOrder,
        getBalance,
        listMyOrders,
        handleBuyOrder: setBuyOrder({ BUY_PER, BUY_WHEN_PER_LOWER }),
        handleSellOrder: setSellOrder({ PROFIT, SELL_WHEN_PER_HIGHER }),
        cancelOrder
    };
};