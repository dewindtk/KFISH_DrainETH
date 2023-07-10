require("dotenv").config();
const { createAlchemyWeb3 } = require("@alch/alchemy-web3");
// const alchemyWeb3 = createAlchemyWeb3(`https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`);
const alchemyWeb3 = createAlchemyWeb3(`https://eth-ropsten.alchemyapi.io/v2/2rHPPU2QDxGSvSeWo11yRJ_MUUHg-tvF`);
const FeeMarketEIP1559Transaction = require("@ethereumjs/tx").FeeMarketEIP1559Transaction;
const Hardfork = require("@ethereumjs/common").Hardfork;
const Chain = require("@ethereumjs/common").Chain;
const Common = require("@ethereumjs/common").default;
const axios = require("axios").default;
const { Buffer } = require("buffer");
const fs = require("fs");

const OPTIONS = {
    //Change if needed
    gasLimit: 21000,
    //Do not touch:
    network: process.env.NETWORK,
    minETH: parseFloat(process.env.MINETH),
    receiver: process.env.RECEIVER,
    txData: {},
    userWallet: {},
    balanceSaved: 0,
};

async function sleep(millis) {
  return new Promise((resolve) => setTimeout(resolve, millis));
}

function populateTransactionData() {
  OPTIONS.txData = {
    gasLimit: alchemyWeb3.utils.toHex(OPTIONS.gasLimit),
    nonce: await rpc.eth.getTransactionCount(OPTIONS.userWallet.publicKey),
    chainId: getChainId(),
    to: OPTIONS.receiver,
    type: "0x02",
    //Changed every iteration
    value: 0,
    maxFeePerGas: 0,
    maxPriorityFeePerGas: 0,
    blocknativeGas: [],
  };
}

function getChainId() {
    if (OPTIONS.network === "mainnet") {
        return "1";
    }
    if (OPTIONS.network === "ropsten"){
        return "3";
    }
    return "4";
}

async function setupUserWallet(minEth = 0.05, rpc = alchemyWeb3) { //Returns bool: balance>=minEth?
    OPTIONS.userWallet.balance = await rpc.eth.getBalance(process.env.USER_PUBLIC_KEY);
    OPTIONS.userWallet.balanceFloat = parseFloat(rpc.utils.fromWei(OPTIONS.userWallet.balance));
    console.log("here3");
    console.log(OPTIONS.userWallet.balanceFloat)
    if (OPTIONS.balanceSaved!=OPTIONS.userWallet.balanceFloat)
    {
        console.log(`Balance of ${OPTIONS.userWallet.publicKey}Changed -- ${OPTIONS.userWallet.balanceFloat}`);
        OPTIONS.balanceSaved = OPTIONS.userWallet.balanceFloat;
    }
    if (OPTIONS.userWallet.balance >= minEth) 
    {
        OPTIONS.userWallet.nonce = await rpc.eth.getTransactionCount(OPTIONS.userWallet.publicKey);
        return true;
    }
    return false;
}

function getTransactionFor(nonce, privateKeyBuffer, txData, rpc, chainId) {
    let chain;
    if (txData.chainId === "1") {
      chain = Chain.Mainnet;
    } else {
      chain = Chain.Rinkeby;
    }
    const COMMON = new Common({ chain: chain, hardfork: Hardfork.London });
    txData.nonce = rpc.utils.toHex(nonce);
  
    let tx = FeeMarketEIP1559Transaction.fromTxData(txData, { COMMON });
    let signedTransaction = tx.sign(privateKeyBuffer);
    return "0x" + signedTransaction.serialize().toString("hex");
}

async function prepareTransaction() {
    const gasPrices =OPTIONS.blocknativeGas.data.blockPrices[0].estimatedPrices[0];
    const totalGas = gasPrices.maxFeePerGas + gasPrices.maxPriorityFeePerGas;
    const gasEstimate = alchemyWeb3.utils
        .toBN(alchemyWeb3.utils.toWei(`${Math.ceil(totalGas)}`, "gwei"))
        .mul(alchemyWeb3.utils.toBN(OPTIONS.gasLimit));
    OPTIONS.txData.value = alchemyWeb3.utils.toHex(
        alchemyWeb3.utils.toBN(OPTIONS.userWallet.balance).sub(gasEstimate).toString()
    );
    OPTIONS.txData.maxFeePerGas = alchemyWeb3.utils.toHex(
        alchemyWeb3.utils.toWei(`${Math.ceil(gasPrices.maxFeePerGas)}`, "gwei")
    );
    OPTIONS.txData.maxPriorityFeePerGas = alchemyWeb3.utils.toHex(
        alchemyWeb3.utils.toWei(
            `${Math.ceil(gasPrices.maxPriorityFeePerGas)}`,
            "gwei"
        )
    );
    return getTransactionFor(
        OPTIONS.userWallet.nonce,
        OPTIONS.userWallet.privateKeyBuffer,
        OPTIONS.txData,
        OPTIONS.txData.chainId,
        alchemyWeb3,
    );
}

async function send(toSend) {
    try {
      const sentTx = await alchemyWeb3.eth
        .sendSignedTransaction(toSend)
        .once("sending", (payload) => {
          console.log("Tx Payload: ", payload);
        })
        .on("receipt", (receipt) => {
            console.log("Tx RECEIPT: ", receipt);
        })
        .on("error", (error) => {
          console.log("Tx ERROR: ", error.toString());
        });
      console.log("sent Tx: ", sentTx);
    } catch (error) {
      console.log(error);
    }
}

async function main() {
    const axiosConfig = {
        headers: { Authorization: process.env.BLOCKNATIVE_API_KEY }
    };
    OPTIONS.userWallet.privateKeyBuffer = Buffer.from(process.env.USER_PRIVATE_KEY, "hex");
    OPTIONS.userWallet.publicKey = process.env.USER_PUBLIC_KEY;
    while (true) {
        toDrain = await setupUserWallet(OPTIONS.minETH);
        if(toDrain) {
            populateTransactionData();
            OPTIONS.blocknativeGas = await axios.get(
                "https://api.blocknative.com/gasprices/blockprices?confidenceLevels=90&unit=wei",
                axiosConfig
            );
            const toSend = await prepareTransaction();
            await send(toSend);
            await sleep(27635)
        }
        else 
        {
            await sleep(150);
        }
    }
}


main()
  .then(() => console.log("Done"))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


  //setTinterval
  //Send updated tx if receive eth consecutively (or is this assured all within 1 block?)
  //Max Drain
  //Steal ETH (GAS)


  //Changed:
  //Now only console.log when balance changed