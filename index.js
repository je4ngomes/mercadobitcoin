const path = require('path');
require('./config/env').config(path.join(__dirname, '.', 'config/.env'))

const { ObjectFromEntries } = require('./utils/utils');
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
            console.log(`Saldo disponivel de R$: ${balance.brl}`);
            console.log('Valorizacao Atual:');
            console.table(
                ObjectFromEntries(
                    Object.entries(ticker).map(([k, v]) => [k, parseFloat(v).toFixed(2)])
                )
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