// require('dotenv').config();
const Moralis = require('moralis/node');

const serverUrl = process.env.MORALIS_URL;
const appId = process.env.MORALIS_APP_ID;
Moralis.start({serverUrl, appId});

const collectionAddress = process.env.NFT_COLLECTION;

const resolveLink = (url) => {
    if (!url || !url.includes("ipfs://")) return url;
    return url.replace("ipfs://", "https://gateway.ipfs.io/ipfs/");
  };

const generateRality = async () =>
{
    let NFTs = await Moralis.Web3API.token.getAllTokenIds({address: collectionAddress});
    const totalNum = NFTs.total
    const pageSize = NFTs.page_size
    
    let allNFTs = NFTs.result;

    let response = NFTs;

    // const timer = (ms) => new Promise((res) => setTimeout(res, ms));
    // for (let i = pageSize; i < totalNum; i = i + pageSize) {
    //     response = await response.next();
    //     if (response.result.length == 0) break;
    //     allNFTs = allNFTs.concat(response.result);
    //     await timer(6000);
    // }
    
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

    nftArr.push({
      metadata: allNFTs[j].metadata,
      Rarity: totalRarity,
      token_id: allNFTs[j].token_id,
      name: allNFTs[j].name,
      token_uri: allNFTs[j].token_uri,
      image: allNFTs[j].image,
    });
  }

  nftArr.sort((a, b) => b.Rarity - a.Rarity);

  let top5 = []
  for (let i = 0; i < 5; i++) {
    nftArr[i].Rank = i + 1;
    top5.push(nftArr[i])
  }
  console.log(top5);

  return top5
}



module.exports = {generateRality}
