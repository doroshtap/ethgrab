const fs = require('fs');
const axios = require('axios');
const delay = require('delay');
const readline = require('readline');
const config = require('./config.json');
const args = require('args-parser')(process.argv);

// API KEY
//const apiKey = 'EK-h7CAB-XsFzbGS-GfA7L';
let last = false;
const getApiKey = () => {
    if (last) {
        last = !last;
        return config.secondKey;
    } else {
        last = !last;
        return config.firstKey;
    }
};

const externalEthereumPrice = config.externalEthereumPrice;
const savedTokens = {
    //'': ''
};

const getEthereumPrice = async () => {
    const result = await axios.get(`https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD`);
    
    if (result.statusText !== 'OK') {
        console.error('[*] FAILED TO GET ETHEREUM PRICE');
        return externalEthereumPrice;
    }

    return result.data.USD;
};

const getTokenInfo = async (address) => {
    try {
        return await axios.get(`https://api.ethplorer.io/getTokenInfo/${address}?apiKey=${getApiKey()}`);
    } catch (err) {
        await delay(100);
        return await getTokenInfo(address);
    }
};

const getAddressInfo = async (address) => {
    try {
        return await axios.get(`https://api.ethplorer.io/getAddressInfo/${address}?apiKey=${getApiKey()}`);
    } catch (err) {
        await delay(100);
        return await getAddressInfo(address);
    }
};

const getBalanceOfAddress = async (address) => {
    let sum = 0;
    const result = await getAddressInfo(address);
    if (result.statusText !== 'OK') {
        console.error(`[*] FAILED TO GET ADDRESS INFO: ${address}`);
        return 0;
    } else {
        const ethBalance = result.data.ETH.balance;
        const ethPrice = await getEthereumPrice();
        sum += ethBalance * ethPrice;

        result.data.tokens.forEach(async (token) => {
            const tokenAddress = token.tokenInfo.address;
            const tokenBalance = token.balance;

            if (!(tokenAddress in savedTokens)) {
                const info = await getTokenInfo(tokenAddress);
                savedTokens[tokenAddress] = info.data.price.rate;
            }

            sum += savedTokens[tokenAddress] * tokenBalance;
        });
    }

    return sum;
};

const main = async () => {
    console.log('EthGrab by doroshtap v0.1');

    if (!args.to) {
        console.error('[!] Specify output file using `--to=FILE`');
        return;
    } else if (!args.from) {
        console.error('[!] Specify input file with wallets using `--from=FILE`');
        return;
    } else if (!args.minimum) {
        console.error('[!] Specify minimum balance in USD to save wallets `--minimum=DOLLARS`');
        return;
    }

    console.log(args);

    const to = args.to;
    const from = args.from;
    const minimum = parseInt(args.minimum);

    if (minimum < 0) {
        console.error('[!] Set POSITIVE minimum balance in USD!!!');
        return;
    } else if (to === from) {
        console.error('[!] Input and output file cannot be the same!!!');
        return;
    }

    const reader = readline.createInterface({
        input: fs.createReadStream(from),
        crlfDelay: Infinity
    });

    for await (const address of reader) {
        console.log(`[I] Scanning address: ${address}`);
        const balance = await getBalanceOfAddress(address);

        if (balance >= minimum) {
            fs.appendFile(to, address + '\n', (err) => {
                if (err) {
                    console.log(`[!] FAILED TO SAVE ADDRESS: ${address}`);
                    console.error(err);
                }
            });
        }
    }
};

main();