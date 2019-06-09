const delay = require('delay')
const _t2cr = require('../contracts/t2cr.json')

module.exports = async (web3, batchedSend) => {
  // Instantiate the T2CR contract.
  const t2crData = JSON.parse(process.env.T2CR_DATA)
  const tcrContract = new web3.eth.Contract(_t2cr.abi, t2crData.address)

  let latestBlockNumber = t2crData.blockNumber
  while (true) {
    // TODO:
    // 1- Fetch txs sending contributions to the contract;
    // 2- Use the accounts to check for pending withdraws;
    // 3- Batch withdraw.
    // 4- Cache latest block to speed up future queries.

    await delay(1000 * 60 * 10) // Every 10 minutes
  }
}
