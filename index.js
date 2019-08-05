const path = require('path');
require('./config/env').config(path.join(__dirname, '.', 'config/.env'))

const { isBalanceEnough } = require('./utils/utils');
const { 
    getTicker,
    placeBuyOrder,
    getBalance,
    placeSellOrder
} = require("./api");
const schedule = require('node-schedule');

const job = schedule.scheduleJob('0 0 23 * * SUN,SAT', () => {
    console.log('works.')
});
const monitor = () => {
    Promise.all([getBalance(), getTicker()]) 
        .then(([balance, ticker]) => {
            console.log(`Saldo disponivel de R$: ${balance.brl}`);
            console.log(ticker)
            const
                qty = '0.001', 
                limite_price = ticker.sell;

            if (!(ticker.sell < 40000))
                return Promise.reject('Ainda muito alto, vamos esperar pra comprar depois.');
            
            if (isBalanceEnough(balance.brl, '100'))
                return Promise.reject('Saldo insuficiente para realizar compra.');

            return Promise.all([balance, ticker, placeBuyOrder(qty, limite_price)]);
        })
        .then(([balance, ticker, buyOrder]) => {
            console.log('Ordem de compra inserida ao livro ', buyOrder);
            const 
                qty = '0.02',
                limite_price = ticker.sell * process.env.PROFITABILITY;

            if (!isBalanceEnough(balance.btc, qty))
                return Promise.reject('Saldo insuficiente para realizar venda.');

            return placeSellOrder(qty, limite_price);
        })
        .then(sellOrder => {
            console.log('Ordem de venda inserida ao livro ', sellOrder);
        })
        .catch(e => console.error(e))
        .finally(_ => console.log('=================================='));
};

console.log('Robo em modo de monitoramento');
setInterval(monitor, process.env.CRAWLER_INTERVAL);