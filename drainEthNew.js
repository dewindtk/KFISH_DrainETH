const axios = require("axios").default;
const { Buffer } = require("buffer");
const Web3 = require('web3');
require("dotenv").config();
const fs = require("fs");

const userWallet = {
    privateKeyBuffer: Buffer.from(process.env.USER_PRIVATE_KEY, "hex"),
    publicKey: process.env.USER_PUBLIC_KEY,
    balance: 0, //Wei
};

const txData = {
    from: process.env.USER_PUBLIC_KEY,
    to: process.env.RECEIVER,
    value: '0', //Topopulate
    gas: 21000,
    type: 2,
    maxFeePerGas: "0", //Topopulate
    maxPriorityFeePerGas: "0", //Topopulate
    data: '0x',
    nonce: '0', //ToPopulate
    chain: '0', //Topopulate
    hardfork: "london",
}

async function sleep(millis) {
    return new Promise((resolve) => setTimeout(resolve, millis));
}

async function doesWalletHaveMoreEthThan(minETH, rpc){
    balance = await rpc.eth.getBalance(process.env.USER_PUBLIC_KEY);
    balanceFloat = parseFloat(rpc.utils.fromWei(balance.toString()));
    if (userWallet.balance!=balanceFloat){
        console.log(`Balance of ${userWallet.publicKey} Changed -- ${balanceFloat}`);
        userWallet.balance = balanceFloat;
    }
    return userWallet.balance >= minETH;
}

async function prepareTransaction(rpc, axiosConfig){
    blocknativeGas = await axios.get(
        "https://api.blocknative.com/gasprices/blockprices?confidenceLevels=90&unit=wei",
        axiosConfig
    );
    blockNativeGasData = blocknativeGas.data.blockPrices[0].estimatedPrices[0];
    txData.nonce = await rpc.eth.getTransactionCount(userWallet.publicKey);
    txData.chain = (process.env.NETWORK === "mainnet")? '1': '4'
    txData.hardfork
    txData.maxFeePerGas = `${Math.ceil(blockNativeGasData.maxFeePerGas)}`
    txData.maxPriorityFeePerGas = `${Math.ceil(blockNativeGasData.maxPriorityFeePerGas)}`
    gasTotal = rpc.utils.toWei(`${Math.ceil(blockNativeGasData.maxFeePerGas + blockNativeGasData.maxPriorityFeePerGas)}`, 'gwei')
    gasEstimate = rpc.utils
        .toBN(rpc.utils.toWei(`${Math.ceil(gasTotal)}`, "gwei"))
        .mul(rpc.utils.toBN(txData.gas));
    txData.value = rpc.utils.toWei(rpc.utils.toBN(rpc.utils.toWei(userWallet.balance.toString())).sub(gasEstimate))
}

async function signTransactionWith(tx, key, rpc){
    result = await rpc.eth.accounts.signTransaction(tx, key); //ERROR
    return result.rawTransaction;
}

async function sendRawSignedTxData(txHex, rpc){
    try {
        const sentTx = await rpc.eth
          .sendSignedTransaction(txHex)
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
      }}


async function main(){
    const web3 = new Web3(`https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`);

    const axiosConfig = {
        headers: {Authorization: process.env.BLOCKNATIVE_API_KEY}
    };

    while(true)
    {
        toDrain = await doesWalletHaveMoreEthThan(process.env.MINETH, web3);
        if (toDrain)
        {
            await prepareTransaction(web3, axiosConfig);
            const txHex = await signTransactionWith(txData, userWallet.privateKeyBuffer, web3)
            await sendRawSignedTxData(txHex, web3)
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