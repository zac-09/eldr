const mongoose = require('mongoose')
const url = process.env.MONGODB_URI

console.log('connecting to', url)
mongoose.connect(url)
  .then(result => {
    console.log('connected to MongoDB')
  })
  .catch((error) => {
    console.log('error connecting to MongoDB:', error.message)
  })
const nftSchema = new mongoose.Schema({
    name: Number,
    link: String,
    lastUpdated: Date,
    delete: Boolean,
})

module.exports = mongoose.model('Nft', nftSchema)