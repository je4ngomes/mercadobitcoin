#!/usr/bin/env node

const path = require('path');
const mongoose = require('mongoose');
const schedule = require('node-schedule');
const R = require('ramda');
const program = require('commander')
    .option('-bl, --BUY_WHEN_PER_LOWER <number>', 'Percentage here needs to be neg', parseFloat)
    .option('-b, --BUY_PER <number>', 'Percentage to buy', parseFloat)
    .option('-sh, --SELL_WHEN_PER_HIGHER <number>', 'Percentage here needs to be pos', parseFloat)
    .option('-p, --PROFIT <number>', '`PROFITABILITY` is add when selling coin', parseFloat)
    .option('-c, --CURRENCY <string>', 'Cryptocurrency: BTC|BCH|ETH|LTC|XRP')
    .parse(process.argv);

require('./config/env').config(path.join(__dirname, '.', 'config/.env'));
require('./config/db');
require('./models/Order');

const { getLastPrice, validArgsAsRequired } = require('./utils/utils');
const apiConfig = require("./api");

const args = ['BUY_WHEN_PER_LOWER', 'BUY_PER', 
            'SELL_WHEN_PER_HIGHER', 
            'PROFIT', 'CURRENCY'];
const { 
    getTicker,
    getBalance,
    handleBuyOrder,
    handleSellOrder
} = apiConfig(
    R.compose(
        obj => validArgsAsRequired(args, obj),
        R.pick(args)
    )(program)
);
const Order = mongoose.model('order');

const monitor = () => {
    Promise.all([getBalance(), getTicker()]) 
        .then(([balance, { ticker }]) => {
            console.log(`Saldo disponivel: [R$: ${balance.brl}] [BTC: ${balance.btc}]`);
            console.log('Valorizacao Atual:');
            console.table(
                R.compose(
                    R.fromPairs,
                    R.map(([k, v]) => [k, parseFloat(v).toFixed(2)]),
                    R.toPairs,
                    R.pick(['last', 'sell', 'buy'])
                )(ticker)
            );
            
            const tickerFloat = R.compose(
                R.fromPairs,
                R.map(([k, v]) => [k, parseFloat(v)]),
                R.toPairs
            )(ticker);

            const lastPrice = getLastPrice(parseFloat(process.env.lastPrice), tickerFloat);


            handleBuyOrder(tickerFloat, balance, lastPrice);
            handleSellOrder(tickerFloat, balance);

        })
        .catch(e => console.error(e));
};

console.log('Robo em modo de monitoramento');
setInterval(monitor, 8000);

schedule.scheduleJob('0 */3 * * *', async () => {
    const { ticker: { last } } = await getTicker();

    process.env.lastPrice = last;
});