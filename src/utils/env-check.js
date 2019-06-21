module.exports = () =>
  !process.env.WEB3_PROVIDER_URL ||
  !process.env.BATCH_SEND_PRIVATE_KEY ||
  !process.env.TRANSACTION_BATCHER_CONTRACT_ADDRESS ||
  !process.env.T2CR_DATA ||
  !process.env.ETHERSCAN_API_KEY ||
  !process.env.ETHERSCAN_NETWORK_SUBDOMAIN
