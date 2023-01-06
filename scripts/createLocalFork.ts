import { forkAndExport, CloneLocalOptions } from '@axelar-network/axelar-local-dev';
const dotenv = require('dotenv');

dotenv.config()

if (!process.env.ACCOUNT_PUBKEY) {
    throw new Error("please choose a main account for testing")
}
var cloneLocalOptions : CloneLocalOptions = {
    chainOutputPath: "info/mainnet-fork.json",
    accountsToFund: [process.env.ACCOUNT_PUBKEY],
}

forkAndExport(cloneLocalOptions);