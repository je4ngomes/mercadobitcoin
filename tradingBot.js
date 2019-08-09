#!/usr/bin/env node

const path = require('path');
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

const { getLast6hPrice, validArgsAsRequired } = require('./utils/utils');
const apiConfig = require("./api");

schedule.scheduleJob('0 */6 * * *', async () => {
    const { ticker: { last } } = await getTicker();

    process.env.last6hPrice = last;
});

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
        obj => validArgsAsRequired(args, Object.keys(obj)),
        R.pick(args)
    )(program)
);

const monitor = () => {
    Promise.all([getBalance(), getTicker()]) 
        .then(([balance, { ticker }]) => {
            console.log(`Saldo disponivel de R$: ${balance.brl}`);
            console.log('Valorizacao Atual:');
            console.table(
                R.compose(
                    R.fromPairs,
                    R.map(([k, v]) => [k, parseFloat(v).toFixed(2)]),
                    R.toPairs,
                    R.pick(['last', 'sell', 'buy'])
                )(ticker)
            );
            
            const last6hPrice = getLast6hPrice(process.env.last6hPrice, ticker);
            const objValuesToFloat = R.compose(
                R.fromPairs,
                R.map(([k, v]) => [k, parseFloat(v)]),
                R.toPairs
            )(ticker);


            // operation handlers
            handleBuyOrder(objValuesToFloat, balance, last6hPrice);
            handleSellOrder(objValuesToFloat, balance, last6hPrice);

        })
        .catch(e => console.error(e))
        .finally(_ => console.log('=================================='));
};

console.log('Robo em modo de monitoramento');
setInterval(monitor, 8000);