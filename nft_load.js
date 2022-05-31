// require('dotenv').config();
const Moralis = require('moralis/node');
const axios = require('axios').default;
const NFTs = require('./models/nft')

const serverUrl = process.env.MORALIS_URL;
const appId = process.env.MORALIS_APP_ID;
Moralis.start({serverUrl, appId});

const collectionAddresses = process.env.NFT_COLLECTIONS;
const openSeaKey = process.env.OPENSEA_KEY;

const resolveLink = (url) => {
    if (!url || !url.includes("ipfs://")) return url;
    return url.replace("ipfs://", "https://gateway.ipfs.io/ipfs/");
  };

  const getOpenseaUrl = async (name, token_id) =>
  {
      const addresses = {
        'BoredApeYachtClub': '0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D',
        'Doodles': '0x8a90cab2b38dba80c64b7734e58ee1db38b8992e',
        'Azuki': '0xed5af388653567af2f388e6224dc7c4b3241c544',
        'Moonbirds': '0x23581767a106ae21c074b2276d25e5c3e136a68b', 
        'Cool Cats': '0x1a92f7381b9f03921564a437210bb9396471050c'
      };
      let address = addresses[name]
      token_url = 'n/a';
      try {
        let options = {
          headers: { 'X-API-KEY': openSeaKey }
        }
        let resource = `https://api.opensea.io/api/v1/asset/${address}/${token_id}?include_orders=false`
        let response = await axios.get(resource, options);
        let obj = response.data;
        token_url = obj.permalink;     
      } catch (error) {
        console.log(`error getting url for ${token_id}`);
      }
      return token_url;
  }

// read as CSV from .ENV
//Bored Ape Yact - 0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D
//Doodles: 0x8a90cab2b38dba80c64b7734e58ee1db38b8992e
//Azuki: 0xed5af388653567af2f388e6224dc7c4b3241c544
//Moonbirds: 0x23581767a106ae21c074b2276d25e5c3e136a68b
//Coolcats: 0x1a92f7381b9f03921564a437210bb9396471050c

const getCollectionNFTS = async (collectionAddress) =>{
  console.log('Getting for:', collectionAddress)
  let NFTs = await Moralis.Web3API.token.getAllTokenIds({address: collectionAddress});
  const totalNum = NFTs.total
  
  let allNFTs = NFTs.result;
  console.log('Name: ', allNFTs[0].name)
  if(allNFTs[0].name == 'Cool Cats')
    console.log(allNFTs[0])
  let response = NFTs;
  
  const timer = (ms) => new Promise((res) => setTimeout(res, ms));
  let retrieved = allNFTs.length;
  while (retrieved < totalNum) {
    if(response.next){
      response = await response.next();
    }
    else{
      break;
    }
      

    if (response.result.length != 0){
      allNFTs = allNFTs.concat(response.result);
      console.log(`---------------(got: ${response.result.length})-------done batch(${allNFTs.length} of ${totalNum})--------------------------`)
      await timer(1000);
      retrieved = allNFTs.length
    }
    else{
      console.log("Failed to get all data-------------------------------")
      break;
    }
      
  }
  
  return allNFTs
}

const updateAllNFTS = async() => {
    const addresses = collectionAddresses.split(',');
    for(let i=0; i<addresses.length; i++){
      let nfts = await generateRality(addresses[i]);
      console.log('Completed: ', nfts)
    }
    return true;
}

const generateRality = async (collectionAddress) =>
{
    let lastUpdated = new Date();
    let allNFTs = await getCollectionNFTS(collectionAddress);
    const totalNum = allNFTs.length

    console.log('******************************Done fetching**********************************')
    let upserted = 0
    try 
    {
        allNFTs = allNFTs.filter(e => JSON.parse(e.metadata) != null)
        let metadata = allNFTs.map((e) => JSON.parse(e.metadata).attributes)

        let tally = {"TraitCount":{}}
        for (let j = 0; j < metadata.length; j++) {
            let nftTraits = metadata[j].map((e) => e.trait_type);
            let nftValues = metadata[j].map((e) => e.value);
        
            let numOfTraits = nftTraits.length;
        
            if (tally.TraitCount[numOfTraits]) {
              tally.TraitCount[numOfTraits]++;
            } else {
              tally.TraitCount[numOfTraits] = 1;
            }

            for (let i = 0; i < nftTraits.length; i++) {
                let current = nftTraits[i];
                if (tally[current]) {
                  tally[current].occurences++;
                } else {
                  tally[current] = { occurences: 1 };
                }
          
                let currentValue = nftValues[i];
                if (tally[current][currentValue]) {
                  tally[current][currentValue]++;
                } else {
                  tally[current][currentValue] = 1;
                }
            }
        }

        const collectionAttributes = Object.keys(tally);
        let nftArr = [];
        for (let j = 0; j < metadata.length; j++) {
          let current = metadata[j];
          let totalRarity = 0;
          for (let i = 0; i < current.length; i++) {
            let rarityScore =
              1 / (tally[current[i].trait_type][current[i].value] / totalNum);
            current[i].rarityScore = rarityScore;
            totalRarity += rarityScore;
          }

          let rarityScoreNumTraits =
            8 * (1 / (tally.TraitCount[Object.keys(current).length] / totalNum));
          current.push({
            trait_type: "TraitCount",
            value: Object.keys(current).length,
            rarityScore: rarityScoreNumTraits,
          });
          totalRarity += rarityScoreNumTraits;

          if (current.length < collectionAttributes.length) {
            let nftAttributes = current.map((e) => e.trait_type);
            let absent = collectionAttributes.filter(
              (e) => !nftAttributes.includes(e)
            );

            absent.forEach((type) => {
              let rarityScoreNull =
                1 / ((totalNum - tally[type].occurences) / totalNum);
              current.push({
                trait_type: type,
                value: null,
                rarityScore: rarityScoreNull,
              });
              totalRarity += rarityScoreNull;
            });
          }

          if (allNFTs[j].metadata) {
            allNFTs[j].metadata = JSON.parse(allNFTs[j].metadata);
            allNFTs[j].image = resolveLink(allNFTs[j].metadata.image);
          } else if (allNFTs[j].token_uri) {
            try {
              await fetch(allNFTs[j].token_uri)
                .then((response) => response.json())
                .then((data) => {
                  allNFTs[j].image = resolveLink(data.image);
                });
            } catch (error) {
              console.log(error);
            }
          }
          let _token_id = allNFTs[j].token_id
          let nftDoc = {
            metadata: allNFTs[j].metadata,
            Rarity: totalRarity,
            token_id: _token_id,
            name: allNFTs[j].name,
            link: '',  // update later
            image: allNFTs[j].image,
            lastUpdated: lastUpdated
          }
          // Each document should look like this: (note the 'upsert': true)
          let upsertDoc = {
            'updateOne': {
              'filter': { 'name': nftDoc.name, 'token_id': nftDoc.token_id },
              'update': nftDoc,
              'upsert': true
          }};

          nftArr.push(upsertDoc);
        }

        let bulkWriteResult = await NFTs.bulkWrite(nftArr);
        upserted = bulkWriteResult.nUpserted;
        console.log('Upserted:', upserted)
    } catch (error) {
        console.log(error)
    }
    

    return upserted;
}

const getEthUsdprice = async () =>
{
  let ethUsd = 'n/a';
  try {
    let options = {
      headers: { 
        'X-API-KEY': process.env.MOLARIS_API_KEY
     }
    }
    let resource = 'https://deep-index.moralis.io/api/v2/erc20/0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2/price'; // eth token url
    let response = await axios.get(resource, options);
    let obj = response.data;
    ethUsd = obj.usdPrice
  } 
  catch (error) {
    console.log("error:", error);
  }
  return ethUsd;
}


module.exports = {getEthUsdprice, updateAllNFTS, getOpenseaUrl}
