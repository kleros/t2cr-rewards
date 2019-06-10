const fetch = require('node-fetch')
const level = require('level')
const _t2cr = require('../../contracts/t2cr.json')

const T2CR_CACHE = 'T2CR_CACHE'

const t2crData = JSON.parse(process.env.T2CR_DATA)
const initialState = {
  latestBlock: t2crData.blockNumber + 1,
  fundAppealTxs: []
}

// Fetches all contribution transactions sent to the t2cr contract and
// uses the addresses to check if there are pending withdraws. If there are,
// withdraws for the user.
// Additionally, use cache to only analyze from the latest block onwards.
module.exports = async (web3) => {
  // Load or create cache
  const db = level('./storage/DB_T2CR')
  let cache
  try {
    cache = JSON.parse(await db.get(T2CR_CACHE))
  } catch (err) {
    if (err.message === `Key not found in database [${T2CR_CACHE}]`) {
      cache = initialState
    } else console.error(err)
  }

  // Check for unprocessed transactions.
  const query = `https://${
    process.env.ETHERSCAN_NETWORK_SUBDOMAIN
  }.etherscan.io/api?module=account&action=txlist&address=${
    t2crData.address
  }&startblock=${
    cache.latestBlock
  }&endblock=99999999&sort=asc&apikey=${process.env.ETHERSCAN_API_KEY}`

  const FUND_APPEAL_ID = '0x2baf80'
  const fundAppealTxs = (await (await fetch(query)).json()).result
    .filter(receipt =>receipt.input.slice(0,8) === FUND_APPEAL_ID)

  cache.latestBlock = fundAppealTxs[fundAppealTxs.length - 1]

  const itemsContributors = fundAppealTxs.reduce((acc, curr) => {
    const input = web3.eth.abi.decodeParameters(['bytes32', 'uint8'], curr.input)
    if (!acc[input[0]]) acc[input[0]] = {}
    if (!acc[input[0]][curr.from] || acc[input[0]][curr.from] < curr.blockNumber)
      acc[input[0]][curr.from] = curr.blockNumber

    return acc
    },
    {}
  )

  // Object.keys(itemsContributors)
  //   .map(async tokenID => itemsContributors[tokenID])

  // Save cache
  await db.put(T2CR_CACHE, JSON.stringify(cache))
  await db.close()
}
