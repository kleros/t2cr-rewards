const Web3 = require('web3')
const delay = require('delay')
const _batchedSend = require('./utils/batched-send')
const level = require('level')
const missingEnvVariables = require('./utils/env-check')
if (missingEnvVariables()) {
  console.error(
    'Missing environment variables. Check .env.staging or .env.production.'
  )
  return
}
const bots = [require('./bots/t2cr'), require('./bots/badge-tcr')]

const db = level('./storage/DB_T2CR')
// Run bots and restart them on failures.
const run = async bot => {
  // Create an instance of `web3` and `batched-send` for each bot.
  const web3 = new Web3(process.env.WEB3_PROVIDER_URL)
  const batchedSend = _batchedSend(
    web3,
    process.env.TRANSACTION_BATCHER_CONTRACT_ADDRESS,
    process.env.BATCH_SEND_PRIVATE_KEY,
    20000 // Batch time window of 20 seconds.
  )

  while (true) {
    try {
      await bot(web3, batchedSend, db)
    } catch (err) {
      console.error('Bot error: ', err)
    }
    await delay(50000) // Wait 50 seconds before restarting failed bot.
  }
}

bots.forEach(run)
