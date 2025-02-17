'use strict';
require('dotenv').config();

const AxelarGatewayContract = require('../artifacts/@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IAxelarGateway.sol/IAxelarGateway.json');
const AxelarGasServiceContract = require('../artifacts/@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IAxelarGasService.sol/IAxelarGasService.json');
const IERC20 = require('../artifacts/@axelar-network/axelar-gmp-sdk-solidity/contracts/interfaces/IERC20.sol/IERC20.json');
const { testnetInfo } = require('@axelar-network/axelar-local-dev');
const { Wallet, Contract, getDefaultProvider } = require('ethers');
const { getGasPrice, getDepositAddress } = require('./utils.js');

// Test has to be run after ${env}postDeploy.json has been written through deployment
const POSTDEPLOY = "-postDeploy"

async function test(env, chains, args, wallet, example) {

    function wrappedGetGasPrice(source, destination, tokenAddress) {
        return getGasPrice(env, source, destination, tokenAddress);
    }

    function wrappedGetDepositAddress(source, destination, destinationAddress, symbol) {
        return getDepositAddress(env, source, destination, destinationAddress, symbol);
    }

    for(const chain of chains) {
      const provider = getDefaultProvider(chain.rpc);

      for(const key of Object.keys(chain)) {
        if(chain[key].abi) {
          const contract = chain[key];
          chain[key] = new Contract(contract.address, contract.abi, wallet.connect(provider));
        }
      }

      chain.provider = provider;
      chain.gateway = new Contract(chain.gateway, AxelarGatewayContract.abi, wallet.connect(provider));
      chain.gasReceiver = new Contract(chain.gasReceiver, AxelarGasServiceContract.abi, wallet.connect(provider));
      var tokenAddress
      if (chain.chainId == 1) {
        // On ethereum, it's USDC not axlUSDC
        tokenAddress = await chain.gateway.tokenAddresses('USDC')
        console.log("usdc", tokenAddress)
      }else{
        tokenAddress = await chain.gateway.tokenAddresses('axlUSDC')
      }
      chain.usdc = new Contract(tokenAddress, IERC20.abi, wallet.connect(provider))
    }

    await example.test(chains, wallet, {
        getGasPrice: wrappedGetGasPrice,
        getDepositAddress: wrappedGetDepositAddress,
        args,
    });
}

module.exports = {
    test,
    POSTDEPLOY
};

function getChains(env) {
    try {
        return require(`../info/${env}${POSTDEPLOY}.json`)
    } catch{
        // Default to testnetInfo
        return testnetInfo;
    }
}

if (require.main === module) {
    const privateKey = process.env.EVM_PRIVATE_KEY;
    const wallet = new Wallet(privateKey);

    const example = require(`../${process.argv[2]}/index.js`);
    const env = process.argv[3];
    if (env == null || (env !== 'testnet' && env !== 'local' && env != 'mainnet-fork'))
        throw new Error('Need to specify tesntet or local as an argument to this script.');

    const chains = getChains(env)

    const args = process.argv.slice(4);

    test(env, chains, args, wallet, example);
}
