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
    data: [
      {
        Rank: Number,
        name: String,
        image: String,
        metadata: Object,
        link: String
       }
      ],
    lastUpdated: Date,
    delete: Boolean,
})

nftSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v
  }
})

module.exports = mongoose.model('Nfts', nftSchema)