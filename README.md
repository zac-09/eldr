# eldr-api
>NOTE: You must have **Node 16+ and npm** installed.

1- SSH into your server and install node and pm2  

```sh
sudo apt-get install nodejs

```
2- Install pm2  

```sh
sudo npm install -g pm2
```

3- Copy the repository to your server and move into the repository
```sh
git clone  https://gitlab.com/m2m-node-react-projects/nodejs/eldr-labs-api
cd eldr-labs-api
```

4- Edit the .env file and make the changes below

 | Variable | Type | Description |
| --- | --- | --- |
| `PORT` | int | API key for making requests to the backend |
| `ETH_QUERY_RATE` | number | rate for querying blockchain in seconds|
| `MONGODB_URI` | string | connect URI to your mongo instance |
| `API_KEY` | string | Auth API KEY to access the backend endpoints |
| `TWITTER_LINK` | string | link returned in api json format for twitter|
| `DISCORD_LINK` | string | link returned in api json format for discord|
| `MORALIS_URL` | string | URL to moralis server|
| `MORALIS_URL` | string | URL to moralis server|
| `ALCHEMY_URL` | string | websocket url from alchemy|
| `NFT_COLLECTION` | string | Collection name to choose the rare nfts from|
| `NUM_BLOCKS` | number | number of blocks to query from block chain|
| `MAINTENANCE_MODE` | boolean | toggle api between maintenance mode|

*Example*
```
API_KEY=371687a8-8006-4987-bbcf-29d41c56695b
```


5- Install  modules

```sh
npm install
```
6- start application

```sh
pm2 start index.js
```
7- The startup subcommand generates and configures a startup script to launch PM2 and its managed processes on server boots

```sh
pm2 startup systemd
```


# End
