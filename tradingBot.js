#!/usr/bin/env node
// load db and env config first
const path = require('path');

require('./config/env').config(path.join(__dirname, '.', 'config/.env'));
require('./config/db');
require('./models/Order');

const mongoose = require('mongoose');
const schedule = require('node-schedule');
const R = require('ramda');
const program = require('commander')
    .option('-bP, --BUY_PER <number>', 'Percentage here needs to be neg', parseFloat)
    .option('-sP, --SELL_PER <number>', 'Percentage here needs to be neg', parseFloat)
    .option('-bqP, --BUY_QTY_PER <number>', 'Percentage to buy', parseFloat)
    .option('-cB, --CANCEL_BUY <number>', 'Percentage to compare limit_price against current market price', parseFloat)
    .option('-c, --CURRENCY <string>', 'Cryptocurrency: BTC|BCH|ETH|LTC|XRP')
    .parse(process.argv);


// validate args
const { validArgsAsRequired, perBetween } = require('./utils/utils');

const args = ['BUY_PER', 'SELL_PER', 
              'BUY_QTY_PER', 'CURRENCY', 'CANCEL_BUY'];

const { CURRENCY, CANCEL_BUY, ...argsValidated } = R.compose(
    obj => validArgsAsRequired(args, obj),
    R.pick(args)
)(program);

// set global config
require('./config/mbGlobalConfig')({ CURRENCY });

const { 
    getTicker,
    getBalance,
    listMyOrders,
    cancelOrder
} = require("./api");
const {
    handleBuyOrder,
    handleSellOrder
} = require('./handlers/handlers')(argsValidated);

const Order = mongoose.model('order');

const monitor = () => {
    Promise.all([getBalance(), getTicker()]) 
        .then(([balance, { ticker }]) => {
            console.log(`Saldo disponivel: [R$: ${balance.brl}] [BTC: ${balance.btc}]`);
            console.log('Valorizacao Atual:');
            
            const tickerFloat = R.compose(
                R.fromPairs,
                R.map(([k, v]) => [k, parseFloat(v)]),
                R.toPairs
            )(ticker);

            // const lastPrice = getLastPrice(parseFloat(process.env.lastPrice), tickerFloat);
            handleBuyOrder(tickerFloat, balance);
            handleSellOrder(tickerFloat, balance);

        })
        .catch(e => console.error(e));
};

console.log('Robo em modo de monitoramento');
setInterval(monitor, 8000);

// schedule.scheduleJob('0 */3 * * *', async () => {
//     const { ticker: { last } } = await getTicker();

//     process.env.lastPrice = last;
// });


// Scheduled job running every 6 minute
// Fetch my Orders from exchange
// Fetch SELL orders with dispatched `false` from database
// Check if each SELL order from database is still open [2] in `myOrders`
// if so, then cancel this particular order 
schedule.scheduleJob('*/6 * * * *', async () => {
    const { myOrders } = await listMyOrders()
                                 .catch(e => console.error(`List orders Error: ${e}`));
    const { ticker } = await getTicker()
                               .catch(e => console.error(`Ticker Error: ${e}`));

    Order.find({
        orderType: 'BUY',
        dispatched: false
    }).then(orders => {
        if (orders.length === 0) return;
        
        orders.forEach((order, i) => {
            const isOpen = myOrders.some(myOrder => (
                myOrder.order_id === order.order_id
                    && (myOrder.status === 2)
            ));

            if (!isOpen) return;

            if (perBetween(order.limit_price, ticker.sell) < CANCEL_BUY) return;

            cancelOrder(order_id, 10 * (i + 1))
                .then(cancelledOrder => Order.deleteOne({ _id: order._id })
                ).catch(e => console.error(e));
        });
    })
});