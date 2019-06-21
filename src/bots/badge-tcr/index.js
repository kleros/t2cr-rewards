const fetch = require('node-fetch')
const delay = require('delay')
const _arbitrableAddressList = require('../../contracts/arbitrable-address-list.json')

const BADGES_CACHE = 'BADGES_CACHE'

const badgesData = JSON.parse(process.env.BADGES_DATA)
const initialState = {}
Object.keys(badgesData).map(badgeTCRAddr => {
  initialState[badgeTCRAddr] = badgesData[badgeTCRAddr] + 1
})

// Fetches all contribution transactions sent to the t2cr contract and
// uses the addresses to check if there are pending withdraws. If there are,
// withdraws for the user.
// Additionally, use cache to only analyze from the latest block onwards.
module.exports = async (web3, batchedSend, db) => {
  // Load or create cache
  let cache
  try {
    cache = JSON.parse(await db.get(BADGES_CACHE))
  } catch (err) {
    if (err.message === `Key not found in database [${BADGES_CACHE}]`) {
      console.info('Key not found in database. Creating...')
      cache = initialState
    } else console.error(err)
  }

  const pendingWithdrawals = []
  let totalPending = web3.utils.toBN(0)

  for (let badgeTCRAddr of Object.keys(badgesData)) {
    // To find pending withdrawals, the address of contributors must be known.
    // We learn this by scraping all addresses that sent transactions to the TCR and then
    // filter out those which are not contributions to appeal fees crowdfunding.
    const query = `https://${process.env.ETHERSCAN_NETWORK_SUBDOMAIN}.etherscan.io/api?module=account&action=txlist&address=${badgeTCRAddr}&startblock=${cache[badgeTCRAddr]}&endblock=99999999&sort=asc&apikey=${process.env.ETHERSCAN_API_KEY}`

    const FUND_APPEAL_ID = web3.eth.abi.encodeFunctionSignature(
      _arbitrableAddressList.abi[25] // fundAppeal(address, uint8)
    )
    const fundAppealTxs = (await (await fetch(query)).json()).result.filter(
      receipt => receipt.input.slice(0, 10) === FUND_APPEAL_ID
    ) // Remove non contribution txs.

    cache[badgeTCRAddr] = fundAppealTxs.length > 0 ? fundAppealTxs[fundAppealTxs.length - 1].blockNumber : cache[badgeTCRAddr]

    // Extract contributor address to each item.
    const itemsContributions = fundAppealTxs.reduce((acc, curr) => {
      const encodedFunctionParams = `0x${curr.input.slice(10)}` // Removes function ID
      const inputParams = web3.eth.abi.decodeParameters(
        ['address', 'uint8'],
        encodedFunctionParams
      )

      if (!acc[inputParams[0]]) acc[inputParams[0]] = new Set()
      acc[inputParams[0]].add(curr.from)

      return acc
    }, {})

    // Search for pending withdrawals and queue them.
    const badgeTCR = new web3.eth.Contract(
      _arbitrableAddressList.abi,
      badgeTCRAddr
    )    
    await Promise.all(
      Object.keys(itemsContributions).map(async address => {
        await Promise.all(
          [...itemsContributions[address]].map(async contributor => {
            const numberOfRequests = (await badgeTCR.methods
              .getAddressInfo(address)
              .call()).numberOfRequests.toNumber()

            for (let request = 0; request < numberOfRequests; request++) {
              const amountWithdrawable = web3.utils.toBN(
                await badgeTCR.methods
                  .amountWithdrawable(address, contributor, request)
                  .call()
              )
              if (amountWithdrawable.gt(web3.utils.toBN(0))) {                
                totalPending = totalPending.add(amountWithdrawable)
                if (!pendingWithdrawals[address])
                  pendingWithdrawals[address] = {}
                if (!pendingWithdrawals[address][contributor])
                  pendingWithdrawals[address][contributor] = []

                // Add pending withdrawl to queue.
                pendingWithdrawals.push({
                  args: [contributor, address, request, 0, 0],
                  method: badgeTCR.methods.batchRoundWithdraw,
                  to: badgeTCR.options.address
                })
              }
            }
          })
        )
      })
    )    
  }

  // Batch withdraw funds.
  if (pendingWithdrawals.length > 0) {
    console.info('Badge TCRs ======')
    console.info('Pending withdraws: ', pendingWithdrawals.length)
    console.info('Total ETH value', web3.utils.fromWei(totalPending))
    console.info()
    batchedSend(pendingWithdrawals)
  }  

  // Save cache
  await db.put(BADGES_CACHE, JSON.stringify(cache))
  await delay(60 * 60 * 1000) // Run the bot every 60 minutes.
}
