require('dotenv').config() // configure environment variables in .env file at the root of the app
const express = require('express')
const cors = require('cors')
const cron = require('node-cron');
const { createAlchemyWeb3 } = require("@alch/alchemy-web3");
const Eth = require('./models/eth')
const app = express()


const blockchainQueryRate = process.env.ETH_QUERY_RATE  //rate for querying blockchain read in .env
const NUM_BLOCKS = process.env.NUM_BLOCKS;
const expectedApiKey = process.env.API_KEY

// Using WebSockets
const web3 = createAlchemyWeb3(
    "wss://eth-mainnet.alchemyapi.io/v2/73RMOv-DmeRuAD-i6Yy6iUsxlJ8da87P", // can be moved to .env
);

app.use(cors())

const median = arr => {
  const mid = Math.floor(arr.length / 2),
    nums = [...arr].sort((a, b) => a - b);
  return arr.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
};

const formatOutput = (data) => {
    let avgGasFee = 0;
    let maximum = 0;
    let minimum = Infinity
    let gasValues = []

    for (let i = 0; i < NUM_BLOCKS; i++) {
      let gasFee = Number(data.reward[i][1]) + Number(data.baseFeePerGas[i])
      gasValues.push(gasFee)
      avgGasFee = avgGasFee + gasFee     
      if (gasFee > maximum) maximum = gasFee;
      if(gasFee < minimum) minimum = gasFee;
    }
    avgGasFee = avgGasFee / NUM_BLOCKS;
    avgGasFee = Math.round(avgGasFee / 10 ** 9)
    maximum = Math.round(maximum / 10 ** 9)
    minimum = Math.round(minimum / 10 ** 9)
    let medianValue = median(gasValues)
    medianValue = Math.round(medianValue / 10 ** 9)
    return {avgGasFee, medianValue, minimum, maximum};
}

const getPercentile = async (value, startDate) =>{
  let entriesLower = await Eth.count({ lastUpdated: { $gte: startDate }, gasFeeMedium:{$lt: value}  }).exec()
  let totalEntries = await Eth.count({ lastUpdated: { $gte: startDate } }).exec()
  let percentile = (entriesLower/totalEntries) * 100
  return percentile
}

app.get('/api/getdata', async (request, response) => {
  if (request.headers.apikey == expectedApiKey) {// Authorize access (will be improved)
  } else {
    response.status(401).send('unauthorized');
  }
  var data = {}
  
  let entry = await Eth.findOne({}, {}, { sort: { 'lastUpdated' : -1 } }).exec();
  delete entry._id;
  delete entry.__v;

  let currentMedium = entry.gasFeeMedium;
  let date = new Date()
  let percentile24H = await getPercentile(currentMedium, date.setDate(date.getDate() - 1));
  let percentile7Days = await getPercentile(currentMedium, new Date(new Date() - 7 * 60 * 60 * 24 * 1000));
  let percentile30Days = await getPercentile(currentMedium, new Date(new Date() - 30 * 60 * 60 * 24 * 1000));
  console.log("percentile", percentile24H)
  data = {...entry.toJSON()}
  data['percentile24Hours'] = percentile24H
  data['percentile7Days'] = percentile7Days
  data['percentile30Days'] = percentile30Days
  data['twitterLink'] = process.env.TWITTER_LINK
  data['discordLink'] = process.env.DISCORD_LINK
  response.json(data)

})

// NFT 
cron.schedule('* * * * *', () => {
    console.log('running a task every minute');
});

// query every blockchainQueryRate seconds
cron.schedule(`*/${blockchainQueryRate} * * * * *`, () => {
  console.log('querying for average Gas price')
  web3.eth.getFeeHistory(NUM_BLOCKS, "latest", [25, 50, 75]).then((data) => {
    const output = formatOutput(data);
    let entry = new Eth({
      gasFeeLow: output.minimum,
      gasFeeMedium: output.medianValue,
      gasFeeHigh: output.maximum,
      gasFeeAvg: output.avgGasFee,
      lastUpdated: new Date(),
      deleted: false,
    });

    entry.save().then((result) => {
      console.log(`added ${result.gasFeeMedium}, on ${result.lastUpdated} to database`)
    });
  });
});

// Eth.deleteMany({}).then(function(){
//   console.log("delted");
// })

const PORT = process.env.PORT || 8000
    app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})


