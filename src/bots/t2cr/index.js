const fetch = require('node-fetch')
const delay = require('delay')
const _t2cr = require('../../contracts/t2cr.json')

const T2CR_CACHE = 'T2CR_CACHE'

const t2crData = JSON.parse(process.env.T2CR_DATA)
const initialState = {
  lastQueriedBlock: t2crData.blockNumber + 1
}

// Fetches all contribution transactions sent to the t2cr contract and
// uses the addresses to check if there are pending withdraws. If there are,
// withdraws for the user.
// Additionally, use cache to only analyze from the latest block onwards.
module.exports = async (web3, batchedSend, db) => {
  // Load or create cache
  let cache
  try {
    cache = JSON.parse(await db.get(T2CR_CACHE))
  } catch (err) {
    if (err.message === `Key not found in database [${T2CR_CACHE}]`)
      cache = initialState
    else console.error(err)
  }

  // To find pending withdrawals, the address of contributors must be known.
  // We learn this by scraping all addresses that sent transactions to the TCR and then
  // filter out those which are not contributions to appeal fees crowdfunding.
  const query = `https://${process.env.ETHERSCAN_NETWORK_SUBDOMAIN}.etherscan.io/api?module=account&action=txlist&address=${t2crData.address}&startblock=${cache.lastQueriedBlock}&endblock=99999999&sort=asc&apikey=${process.env.ETHERSCAN_API_KEY}`

  const FUND_APPEAL_ID = web3.eth.abi.encodeFunctionSignature(_t2cr.abi[26]) // fundAppeal(bytes32, uint8)
  const fundAppealTxs = (await (await fetch(query)).json()).result.filter(
    receipt => receipt.input.slice(0, 10) === FUND_APPEAL_ID 
  ) // Remove non contribution txs.

  cache.lastQueriedBlock = fundAppealTxs[fundAppealTxs.length - 1].blockNumber

  // Extract contributor address to each item.
  const itemsContributions = fundAppealTxs.reduce((acc, curr) => {
    const encodedFunctionParams = `0x${curr.input.slice(10)}` // Removes function ID
    const inputParams = web3.eth.abi.decodeParameters(
      ['bytes32', 'uint8'],
      encodedFunctionParams
    )

    if (!acc[inputParams[0]]) acc[inputParams[0]] = new Set()
    acc[inputParams[0]].add(curr.from)

    return acc
  }, {})

  // Search for pending withdrawals and queue them.
  const t2cr = new web3.eth.Contract(_t2cr.abi, t2crData.address)
  const pendingWithdrawals = []
  let totalPending = web3.utils.toBN(0)
  await Promise.all(
    Object.keys(itemsContributions).map(async tokenID => {
      await Promise.all(
        [...itemsContributions[tokenID]].map(async contributor => {
          const numberOfRequests = (await t2cr.methods
            .getTokenInfo(tokenID)
            .call()).numberOfRequests.toNumber()

          for (let request = 0; request < numberOfRequests; request++) {
            const amountWithdrawable = web3.utils.toBN(
              await t2cr.methods
                .amountWithdrawable(tokenID, contributor, request)
                .call()
            )
            if (amountWithdrawable.gt(web3.utils.toBN(0))) {
              totalPending = totalPending.add(amountWithdrawable)
              if (!pendingWithdrawals[tokenID]) pendingWithdrawals[tokenID] = {}
              if (!pendingWithdrawals[tokenID][contributor])
                pendingWithdrawals[tokenID][contributor] = []

              // Add pending withdrawl to queue.
              pendingWithdrawals.push({
                args: [contributor, tokenID, request, 0, 0],
                method: t2cr.methods.batchRoundWithdraw,
                to: t2cr.options.address
              })
            }
          }
        })
      )
    })
  )

  // Withdraw funds.
  if (pendingWithdrawals.length > 0) {
    console.info('Pending withdraws: ', pendingWithdrawals.length)
    console.info('Total ETH value', web3.utils.fromWei(totalPending))
    batchedSend(pendingWithdrawals)
  }

  // Save cache
  await db.put(T2CR_CACHE, JSON.stringify(cache))
  await delay(60 * 60 * 1000) // Run the bot every 60 minutes.
}
