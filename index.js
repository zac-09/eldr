require('dotenv').config() // configure environment variables in .env file at the root of the app
const errorHandler = require("./controllers/errorController");
const catchAsync = require('./utils/catchAsync');
const express = require('express')
const cors = require('cors')
const cron = require('node-cron');
const { createAlchemyWeb3 } = require("@alch/alchemy-web3");
const NFTs = require('./models/nft')
const NFT_Loader = require('./nft_load');
const EthPrice = require('./models/eth_price')
const Eth = require('./models/eth')
const app = express()


const blockchainQueryRate = process.env.ETH_QUERY_RATE  //rate for querying blockchain read in .env
const NUM_BLOCKS = process.env.NUM_BLOCKS;
const expectedApiKey = process.env.API_KEY;
const alchemy_url  = process.env.ALCHEMY_URL
// Using WebSockets
const web3 = createAlchemyWeb3(
  alchemy_url, // can be moved to .env
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
    if (gasFee < minimum) minimum = gasFee;
  }
  avgGasFee = avgGasFee / NUM_BLOCKS;
  avgGasFee = Math.round(avgGasFee / 10 ** 9)
  maximum = Math.round(maximum / 10 ** 9)
  minimum = Math.round(minimum / 10 ** 9)
  let medianValue = median(gasValues)
  medianValue = Math.round(medianValue / 10 ** 9)
  return { avgGasFee, medianValue, minimum, maximum };
}

const getPercentile = async (startDate) => {
  let totalEntries = await EthPrice.count({ lastUpdated: { $gte: startDate } }).exec();

  //determine median in date range
  let medianEntry = await EthPrice.find({ lastUpdated: { $gte: startDate }}).sort( {"ethPrice":1} ).skip(totalEntries / 2 - 1).limit(1).exec();
  let medianValue = medianEntry[0].ethPrice;

  // let entriesLower = await EthPrice.count({ lastUpdated: { $gte: startDate }, ethPrice: { $lt: medianValue }, deleted: false }).exec(); 
  // let percentile = (entriesLower / totalEntries) * 100;
  let latest = await EthPrice.findOne({}, {}, { sort: { 'lastUpdated': -1 } }).exec();
  let presentValue = latest.ethPrice;
  // (1 - Median/Present) * 100
  let percentile = (1 - medianValue/presentValue) * 100;
  return percentile
}

const is_maintenance = process.env.MAINTENANCE_MODE
app.get('/api/getdata', catchAsync(async (request, response) => {
  if (request.headers.apikey == expectedApiKey) {
    // Authorize access (will be improved)
  } else {
    response.status(401).send('unauthorized');
  }
  if(is_maintenance === "true"){
    response.status(401).send('api is under  maintenance');

  }
  var data = {}
  let gasPriceEntry = await Eth.findOne({}, {}, { sort: { 'lastUpdated': -1 } }).exec();
  delete gasPriceEntry._id;
  delete gasPriceEntry.__v;

  data = { ...gasPriceEntry.toJSON() }

  let last100 = await EthPrice.find({'deleted': false}, {}, {sort: {'lastUpdated': -1} }).limit(100);
  let values = last100.map(p => p.ethPrice);
  values.sort((a, b) => a - b);
  let lowest = values[0]
  let highest = values[values.length - 1]

  let currentMedium = median(values);
  let date = new Date()
  let percentile24H = await getPercentile(date.setDate(date.getDate() - 1));
  let percentile7Days = await getPercentile(new Date(new Date() - 7 * 60 * 60 * 24 * 1000));
  let percentile30Days = await getPercentile(new Date(new Date() - 30 * 60 * 60 * 24 * 1000));
  let eth_price = await NFT_Loader.getEthUsdprice();
  data['ethPriceLow'] = lowest;
  data['ethPriceMedium'] = currentMedium;
  data['ethPriceHigh'] = highest;
  data['percentile24Hours'] = percentile24H
  data['percentile7Days'] = percentile7Days
  data['percentile30Days'] = percentile30Days
  data['twitterLink'] = process.env.TWITTER_LINK
  data['discordLink'] = process.env.DISCORD_LINK

  let topNFTs = await NFTs.find({}).sort({ Rarity: -1 }).limit(5).exec();
  let nfts = {};
  for (let i = 0; i < topNFTs.length; i++) {
    let entry = topNFTs[i];
    let link = entry.link;
    if(link === ''){
        link = await NFT_Loader.getOpenseaUrl(entry.address, entry.token_id);
    }
    nfts[`rank${i+1}`] = {
      metadata: entry.metadata,
      name: entry.name,
      image: entry.image,
      link: link
    }
  }
  data['top5NFTSByRarityOpensea'] = nfts;
  data['ethPrice'] = eth_price;

  response.json(data)

}))

app.get('/api/getdata/:collection/:token_id', catchAsync(async (request, response)=>{
    if (request.headers.apikey == expectedApiKey) {
      // Authorize access (will be improved)
    } else {
      response.status(401).send('unauthorized');
    }
    if(is_maintenance === "true"){
      response.status(401).send('api is under  maintenance');

    }
    let collection = request.params.collection.toLowerCase();
    let token_id = request.params.token_id;
    let result = {}

    let addresses = {
      'byc': '0xBC4CA0Eda7647A8aB7C2061c2E118A18a936f13D',  // Bored Ape Yact
      'doodles': '0x8a90cab2b38dba80c64b7734e58ee1db38b8992e',
      'azuki': '0xed5af388653567af2f388e6224dc7c4b3241c544',
      'moonbirds': '0x23581767a106ae21c074b2276d25e5c3e136a68b',
      'coolcats': '0x1a92f7381b9f03921564a437210bb9396471050c'
    }

    if( collection in addresses){
      let address = addresses[collection].trim();
    console.log("the addresses",address,token_id)

      let nft = await NFTs.findOne( {address, token_id });
      // console.log('ranking:', nft.Rank);
      result = nft;
    }
    else{
      result['message'] = "Collection not found";
    }

    response.json(result)
}));

// Task running every minute
cron.schedule('* * * * *', async () => {
  //update opensea Urls
  await NFT_Loader.updateUrlOf10()

  //hard delete after 90 days
  let today = new Date();
  let past90Days = new Date(new Date().setDate(today.getDate() - 90));
  EthPrice.deleteMany({ lastUpdated: { $lt: past90Days } }).then(function () {
    console.log("delted");
  });
  Eth.deleteMany({ lastUpdated: { $lt: past90Days } }).then(function () {
    console.log("delted");
  });

  // soft delete after 30 days
  let past30Days = new Date(new Date().setDate(today.getDate() - 30));
  EthPrice.updateMany({ lastUpdated: { $lt: past30Days } }, { deleted: true })
    .then(function () {
      console.log("Soft delete completed");
    });
  Eth.updateMany({ lastUpdated: { $lt: past30Days } }, { deleted: true })
  .then(function () {
    console.log("Soft delete completed");
  });
 
});

// query every blockchainQueryRate seconds
cron.schedule(`*/${blockchainQueryRate} * * * * *`, async () => {
    console.log('querying for eth price')
    let ethPrice = await NFT_Loader.getEthUsdprice();
    let entry = new EthPrice({
      ethPrice: ethPrice,
      lastUpdated: new Date(),
      deleted: false,
    });
    entry.save().then((result) => {
      console.log(`added ${result.ethPrice}, on ${result.lastUpdated} to database`)
    }).catch(error => {
      console.log('error saving to MongoDB:', error.message)
    });

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
      }).catch(error => {
        console.log('error saving to MongoDB:', error.message)
      });
    });
});

cron.schedule('*/5 * * * *', async () => {
  //running every five minutes to update nfts
  await NFT_Loader.updateAllNFTS()

});

app.use("*", (req, res) => {
  res.status(404).json({
    status: "error end point not found",
    message: req.originalUrl,
  });
});
app.use(errorHandler);

const PORT = process.env.PORT || 8000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
});