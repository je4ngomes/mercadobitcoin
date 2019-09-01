module.exports = ({ CURRENCY }) => (
    global.mBConfig = {
        CURRENCY,
        getCoin() { return `BRL${this.CURRENCY}` },
        KEY: process.env.KEY,
        SECRET: process.env.SECRET,
        PIN: process.env.PIN,
        ENDPOINT_INFO_API: 'https://www.mercadobitcoin.com.br/api',
        ENDPOINT_TRADE_API: 'https://www.mercadobitcoin.net/tapi/v3/'
    }
);