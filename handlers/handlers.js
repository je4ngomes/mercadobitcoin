const mongoose = require('mongoose');
const chalk = require('chalk').default;

const { 
    isBalanceEnough,
    getProfit,
    saveOrder,
    priceWithExchangeTaxes,
    percentToCoin,
    setBuyLimitPrice,
    currencyToCoin,
    percentToCurrency
} = require('../utils/utils');

const {
    placeSellOrder,
    placeBuyOrder
} = require('../api');

const Order = mongoose.model('order');
const mBConfig = global.mBConfig;

const setBuyOrder = (BUY_QTY_PER, BUY_PER) =>
    (ticker, accountBalance) => {
    const 
        price = percentToCurrency(BUY_QTY_PER, ticker.sell),
        limitPrice = setBuyLimitPrice(ticker, BUY_PER);
    const qty = currencyToCoin(priceWithExchangeTaxes(price, 0.70), ticker.last);
    
    if (!isBalanceEnough(accountBalance.brl, 50))
        return console.warn(chalk.red('Saldo insuficiente para realizar compra.'));

    console.log(chalk.yellow('Quantidade Compra: ', qty));
    console.log(chalk.yellow('Compra Limite: R$', limitPrice));

    placeBuyOrder(qty, limitPrice)
        .then(buyOrder => {
            console.info(chalk.green('Ordem de compra inserida ao livro. ', buyOrder));

            saveOrder(buyOrder, 'BUY', mBConfig.getCoin());      
        })
        .catch(e => console.error(chalk.red('Nao foi possivel realizar a compra devido algum erro.'), e));
};

const setSellOrder = (SELL_PER, BUY_QTY_PER) => async (ticker, accountBalance) => {
    const orders = await Order.find({
        currency: mBConfig.getCoin(),
        orderType: 'BUY',
        dispatched: false
    });

    if (orders.length === 0) {
        if (!isBalanceEnough(accountBalance.btc, percentToCoin(SELL_PER, ticker.sell)))
            return console.warn(chalk.red('Saldo insuficiente para realizar venda.'));

        placeSellOrder(
            percentToCurrency(BUY_QTY_PER, ticker.sell),
            ticker.sell
        ).then(sellOrder => {
            if (!sellOrder) return;

            saveOrder(sellOrder, 'SELL', mBConfig.getCoin());
        });
    }       

    // place each order if balance is enough
    orders.forEach(order => {
        if (!isBalanceEnough(accountBalance.btc, order.qty))
            return console.warn(chalk.red('Saldo insuficiente para realizar venda.'));
                
        const priceWithProfitIncluded = order.limit_price * SELL_PER;
        const limit = (
            priceWithProfitIncluded >= ticker.sell 
                ? priceWithProfitIncluded
                : ticker.sell
        );

        console.log(chalk.yellow('Quantidade Venda: ', order.qty));
        console.log(chalk.yellow('Venda Limite: R$', limit));
        console.log(chalk.green('Rentabilidade de: '), getProfit(order.limit_price, limit, order.qty))                
    
        placeSellOrder(order.qty, limit)
            .then(sellOrder => {
                console.info(chalk.green('Ordem de venda inserida ao livro. '), sellOrder);
                
                saveOrder(sellOrder, 'BUY', mBConfig.getCoin());
            })
            .then(_ => Order.updateOne({ _id: order._id }, { dispatched: true }))
            .catch(e => console.error(chalk.red('Nao foi possivel realizar a venda devido algum erro.')))
    });
};

const setCanceledOrders = BUY_PER => ticker => (
    // Update canceled order so that it can be reorder eventually
    Order.updateMany(
        { orderType: 'SELL', dispatched: true }, { 
            dispatched: false, 
            orderType: 'BUY', 
            limit_price: setBuyLimitPrice(ticker, BUY_PER) 
        }
    )
);

module.exports = ({
    BUY_PER,
    SELL_PER=1.009,
    BUY_QTY_PER
}) => ({
    handleBuyOrder: setBuyOrder(BUY_QTY_PER, BUY_PER),
    handleSellOrder: setSellOrder(SELL_PER, BUY_QTY_PER),
    handleCanceledOrders: setCanceledOrders(BUY_PER)
});