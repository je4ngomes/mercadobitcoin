const path = require('path');
const chalk = require('chalk').default;
const R = require('ramda');
require('./config/env').config(path.join(__dirname, '.', 'config/.env'))

const { 
    getTicker,
    getBalance,
    handleBuyOrder,
    handleSellOrder
} = require("./api");
// const schedule = require('node-schedule');

const monitor = () => {
    Promise.all([getBalance(), getTicker()]) 
        .then(([balance, { ticker }]) => {
            console.log(chalk.blue(`Saldo disponivel de R$: ${balance.brl}`));
            console.log('Valorizacao Atual:');
            console.table(
                R.compose(
                    R.fromPairs,
                    R.map(([k, v]) => [k, parseFloat(v).toFixed(2)]),
                    R.toPairs
                )(ticker)
            );

            // operation handlers
            handleBuyOrder(ticker, balance);
            handleSellOrder(ticker, balance);

        })
        .catch(e => console.error(e))
        .finally(_ => console.log('=================================='));
};

console.log('Robo em modo de monitoramento');
setInterval(monitor, process.env.CRAWLER_INTERVAL);


// const job = schedule.scheduleJob('0 0 23 * * SUN,SAT', () => {
//     console.log('works.')
// });