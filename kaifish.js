const axios = require("axios").default;
const { Buffer } = require("buffer");
const Web3 = require("web3");
require("dotenv").config();
const fs = require("fs");

const axiosConfig = {
  headers: { Authorization: process.env.BLOCKNATIVE_API_KEY }
};

const userWallet = {
  privateKeyBuffer: process.env.USER_PRIVATE_KEY,
  publicKey: process.env.USER_PUBLIC_KEY,
  balance: 0, //Wei
  previousBalanceFloat: 0, //KFISH
  latestNonceUsed: 0
};

const blockNativeGasData = {};

const txData = {
  from: process.env.USER_PUBLIC_KEY,
  to: process.env.RECEIVER,
  value: "0", //Topopulate
  gas: 21000,
  type: 2,
  maxFeePerGas: "0", //Topopulate
  maxPriorityFeePerGas: "0", //Topopulate
  data: "0x",
  nonce: "0", //ToPopulate
  chain: "0", //Topopulate
  hardfork: "london"
};

async function sleep(millis) {
  return new Promise((resolve) => setTimeout(resolve, millis));
}

async function doesWalletHaveMoreEthThan(minETH, rpc) {
  //KFISH did a bunch of shit here that needs cleaning, just keep balance as a BN from wei of response
  userWallet.balance = await rpc.eth.getBalance(process.env.USER_PUBLIC_KEY);
  const balanceFloat = parseFloat(rpc.utils.fromWei(userWallet.balance));
  userWallet.balance = rpc.utils.toBN(`${userWallet.balance}`);
  if (userWallet.previousBalanceFloat != balanceFloat) {
    userWallet.previousBalanceFloat = balanceFloat;
    console.log(
      `Balance of ${userWallet.publicKey} Changed -- ${balanceFloat}`
    );
    userWallet.previousBalanceFloat = balanceFloat;
  }
  return userWallet.previousBalanceFloat >= minETH;
}

async function prepareTransaction(rpc) {
  // TODO
  //track pending tx
  //total eth - eth from pending tx = eth to drain in new tx
  txData.nonce = await rpc.eth.getTransactionCount(userWallet.publicKey);
  txData.chain = process.env.NETWORK === "mainnet" ? "1" : "4";
  txData.maxFeePerGas = rpc.utils.toWei(
    `${Math.ceil(blockNativeGasData.maxFeePerGas)}`,
    "gwei"
  );
  txData.maxPriorityFeePerGas = rpc.utils.toWei(
    `${Math.ceil(blockNativeGasData.maxPriorityFeePerGas)}`,
    "gwei"
  );
  const gasTotal = rpc.utils.toWei(
    `${Math.ceil(
      blockNativeGasData.maxFeePerGas + blockNativeGasData.maxPriorityFeePerGas
    )}`,
    "gwei"
  );
  gasEstimate = rpc.utils.toBN(gasTotal).mul(rpc.utils.toBN(txData.gas));
  console.log(gasEstimate.toString());
  txData.value = userWallet.balance.sub(gasEstimate);
}

async function signTransactionWith(tx, key, rpc) {
  result = await rpc.eth.accounts.signTransaction(tx, key); //ERROR
  return result.rawTransaction;
}

async function sendRawSignedTxData(txHex, rpc) {
  try {
    rpc.eth
      .sendSignedTransaction(txHex)
      .once("sending", (payload) => {
        userWallet.latestNonceUsed = txData.nonce;
        console.log("Tx Payload: ", payload);
      })
      .once("transactionHash", (transactionHash) => {
        console.log("sent Tx: https://etherscan.io/tx/" + transactionHash);
      })
      .on("receipt", (receipt) => {
        console.log("Tx RECEIPT: ", receipt);
      })
      .on("error", (error) => {
        console.log("Tx ERROR: ", error.toString());
      });

  } catch (error) {
    console.log(error);
  }
}

async function fetchGas() {
  const res = await axios.get(
    "https://api.blocknative.com/gasprices/blockprices?confidenceLevels=90&unit=wei",
    axiosConfig
  );
  const gasData = res.data.blockPrices[0].estimatedPrices[0];
  blockNativeGasData.maxFeePerGas = gasData.maxFeePerGas;
  blockNativeGasData.maxPriorityFeePerGas = gasData.maxPriorityFeePerGas;
}

async function main() {
  const web3 = new Web3(
    `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
  );


  setInterval(fetchGas, 3000);

  while (true) {
    toDrain = await doesWalletHaveMoreEthThan(process.env.MINETH, web3);
    if (toDrain) {
      await prepareTransaction(web3);
      const txHex = await signTransactionWith(
        txData,
        userWallet.privateKeyBuffer,
        web3
      );
      sendRawSignedTxData(txHex, web3);
    } else {
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


// fallback method
// subscribe to new block headers
// on new block, getBalance
// if getBalance > pending drain amount
// --> drain balance
// --> pending drain amount = getBalance
// currentBalance = sum of all pending
// we assume that pending have failed their copygas
// we start from getTransactionCount nonce
// drain balance
//  --> save pending drain amount

// the copygas method
// Incomings
// Out
// Orchestrator
//  -> inProgress = {}
//  -> nonce
//  -> does pendingTransactions event subscription emit if eth is sent through private mempool?
//  -> general event subscriptions
//  -> instantiating incomings
//    --> would handle all cases of that incoming txn
//    --> emits confirmation
//  -> instantiating outs
//    --> handleIncomingConfirmed
//      --> if incoming confirmed and out still pending
//        --> fail copygas and rely on fallback method
//    --> respond to incoming event emits
