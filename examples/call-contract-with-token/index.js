'use strict';

const {
    getDefaultProvider,
    Contract,
    constants: { AddressZero },
} = require('ethers');
const {
    utils: { deployContract },
} = require('@axelar-network/axelar-local-dev');

const { sleep } = require('../../utils');
const DistributionExecutable = require('../../artifacts/examples/call-contract-with-token/DistributionExecutable.sol/DistributionExecutable.json');
const Gateway = require('../../artifacts/@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IAxelarGateway.sol/IAxelarGateway.json');
const IERC20 = require('../../artifacts/@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IERC20.sol/IERC20.json');

// Note: deploy mutates chain object in place
async function deploy(chain, wallet) {
    console.log(`Deploying DistributionExecutable for ${chain.name}.`);
    const provider = getDefaultProvider(chain.rpc);
    chain.wallet = wallet.connect(provider);
    chain.contract = await deployContract(wallet, DistributionExecutable, [chain.gateway, chain.gasReceiver]);
    const gateway = new Contract(chain.gateway, Gateway.abi, chain.wallet);
    var usdcAddress
    if (chain.chainId == 1) {
        // usdc for Axelar has symbol USDC on Ethereum 
        usdcAddress = await gateway.tokenAddresses('USDC');
    }else{
        usdcAddress = await gateway.tokenAddresses('axlUSDC');
    }
    chain.usdc = new Contract(usdcAddress, IERC20.abi, chain.wallet);
    console.log(`Deployed DistributionExecutable for ${chain.name} at ${chain.contract.address}.`);
}

async function test(chains, wallet, options) {
    // Read chains info with deployed contract

    const args = options.args || [];
    const getGasPrice = options.getGasPrice;
    const source = chains.find((chain) => chain.name === (args[0] || 'Ethereum'));
    const destination = chains.find((chain) => chain.name === (args[1] || 'Polygon'));
    const amount = Math.floor(parseFloat(args[2])) * 1e6 || 5e6;
    const accounts = args.slice(3);

    if (accounts.length === 0) accounts.push(wallet.address);

    async function logAccountBalances() {
        for (const account of accounts) {
            console.log(`${account} has ${(await destination.usdc.balanceOf(account)) / 1e6} aUSDC`);
        }
    }

    console.log('--- Initially ---');
    await logAccountBalances();

    const gasLimit = 6e6;
    const gasPrice = await getGasPrice(source, destination, AddressZero);

    const balance = await destination.usdc.balanceOf(accounts[0]);
    console.log(source.usdc.address)
    const approveTx = await source.usdc.approve(source.contract.address, amount);
    console.log(approveTx)
    await approveTx.wait();
    // console.log(approveTx);
    console.log(source.contract.address);
    console.log(gasLimit * gasPrice);
    const sendTx = await source.contract.sendToMany(destination.name, destination.contract.address, accounts, 'axlUSDC', amount, {
        maxFeePerGas: BigInt("60000000000"), //to change if flashbots are not used, defaults to the mean network gas price
        maxPriorityFeePerGas: BigInt("40000000000"), //to determine at execution time
        gasLimit: gasLimit, //to change
        value: BigInt(Math.floor(gasLimit * gasPrice)),
    });
    console.log(sendTx);
    await sendTx.wait();

    while (true) {
        const updatedBalance = await destination.usdc.balanceOf(accounts[0]);
        console.log(updatedBalance.toString(), balance.toString());
        if (updatedBalance.gt(balance)) break;
        await sleep(1000);
    }

    console.log('--- After ---');
    await logAccountBalances();
}

module.exports = {
    deploy,
    test,
};
