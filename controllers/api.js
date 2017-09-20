/**
 * CryptoCompare API Caller
 */

const request = require('superagent');

const each = require('lodash/each');
const orderBy = require('lodash/orderBy');
const uniqBy = require('lodash/uniqBy');
const merge = require('lodash/merge');

const url = 'https://min-api.cryptocompare.com/';
const cmcUrl = 'https://api.coinmarketcap.com/v1/ticker/';
const mainUrl = 'cryptocompare.com';
const http = require('http');
const fs = require('fs');
const moment = require('moment');

const endpoints = {
	'priceMultiFull': '/data/pricemultifull',
	'dayAvg': 'data/dayAvg'
}

const { saveCoin } = require('./redis');

let config = require('../config.json');

/**
 * The core request builder for all of the functions below
 * Params: Args {requestString, coinList, query }
 */
const buildRequest = (args = {}) => {
	return new Promise((resolve, reject) => {
		request
		.get(args.requestString)
		.query(args.query)
		.end(function(err, res){
			if(err || !res){
				reject(err);
				throw err;
			}

			resolve(res.text);

		});
	});
}

const getFullCoinList = async () => {

	const cryptoCompareCoins = await getSingleCoinList('CryptoCompare');
	const coinMarketCapCoins = await getSingleCoinList('CoinMarketCap');

	return getMergedCoinList(JSON.parse(cryptoCompareCoins), JSON.parse(coinMarketCapCoins));

}

/**
 * Gets a list of all coins on CryptoCompare
 * https://www.cryptocompare.com/api/#-api-data-coinlist-
 */
const getSingleCoinList = (whereFrom) => {

	if(whereFrom == 'CryptoCompare') {
		return buildRequest({
			requestString: 'https://www.cryptocompare.com/api/data/coinlist/'
		});
	}else if(whereFrom == 'CoinMarketCap' ) {
		return buildRequest({
			requestString: 'https://api.coinmarketcap.com/v1/ticker/'
		});
	}

}

/**
 * Returns a merge of the two coin objects
 */
const getMergedCoinList = (cryptoCompareCoins, coinMarketCapCoins) => {

	cryptoCompareCoins = cryptoCompareCoins.Data;
	each(coinMarketCapCoins, (c, k) => {
		if(typeof cryptoCompareCoins[c.symbol] !== 'undefined'){
			c = Object.assign(c, cryptoCompareCoins[c.symbol]);
		}else {
			coinMarketCapCoins[k] = null;
		}
	})

	return coinMarketCapCoins.filter(Boolean).slice(0, config.coinsToGet - 1);

}

const setConfig = (key, val) => {

	return new Promise((resolve, reject) => {

		// If it's already been stringified
		if(typeof config === 'string'){
			config = JSON.parse(config);
		}

		config[key] = val;
		config = JSON.stringify(config, null, 4);

		fs.writeFile('./config.json', config, 'utf8', (err) => {
			if(err) reject(err);
			resolve('Config file written');
		});
	})
}

/**
 * Save all coin images
 */
const getCoinImages = (coinList) => {

	each(coinList, coin => {
		getCoinImage(coin);
	})

	// Update configuration file with savedImage array
	setConfig('hasCoinImages', true).then(data => {
		return true;
	}).catch(err => {
		console.log(err)
		return false;
	});

}

const getCoinImage = (coin) => {

	if(coin.ImageUrl) {
		const imageUrl = coin.ImageUrl;
		const options = {
		    host: mainUrl,
		    port: 80,
		    path: imageUrl
		}

		// Save images
		const request = http.get(options, res => {

			let fileName = imageUrl.split('/');
			fileName = fileName[fileName.length - 1];

			let imageData = '';
			res.setEncoding('binary');

			res.on('data', chunk => {
				imageData += chunk;
			});

			res.on('end', () => {
				fs.writeFile((config.imageFolder + fileName), imageData, 'binary', err =>{
					if(err) console.log(err);

					console.log(coin.CoinName + ' Logo saved');
				})
			})
		}).on('error', function(e) {
    		console.log("Got error: " + e.message);
		});
	}

}

/**
 * Initially to be used to build up a list of historical prices so
 * we can begin running computations against them
 * https://www.cryptocompare.com/api/#-api-data-pricehistorical-
 */
const getPriceHistoricalAndSave = (coinList) => {
// REFACTOR OUT SO THE SAVE PART IS SEPERATE
// 
	return new Promise((resolve,reject) => {
		const daysSince = getDaysSinceCoinUpdate();
		const limit = daysSince ? daysSince : 60;

		if(!coinList) {
			reject('No coins');
		}
			// As this is an object in some situations
		let promises = [];

		each(coinList, (coin, key) => {

			const args = [
				'tsym=USD',
				'limit=' + limit,
				'aggregate=1',
				'toTs=' + moment().valueOf(),
				'fsym=' + coin.symbol
			];

			const req = buildRequest({
				requestString: 'https://min-api.cryptocompare.com/data/histoday',
				query: args.join('&')
			})
			.then(data => {
				data = JSON.parse(data);

				const currentHistory = coinList[currentCoin]['History'];
				let newHistory = merge(currentHistory, data.Data);
				newHistory = uniqBy(newHistory, 'time');
				newHistory = orderBy

				coinList[currentCoin]['History'] = newHistory;

				saveCoin(coinList[currentCoin]);
			});

			promises.push(req);

		});

		Promise.all(promises).then(values => {
			setConfig('coinsLastUpdated', moment().format('YYYY-MM-DD')).then(data => {
				if(!daysSince) {
					setConfig('hasHistorical', 'true').then(data => {
						resolve('Coins updated');
					}).catch(err => {
						reject(err);
					});
				}else {
					resolve('Coins updated');
				}

			}).catch(err => {
				reject(err);
			});				
		})

	})
}

const getDaysSinceCoinUpdate = () => {

	if(!config.coinsLastUpdated) {
		// it's initial, just get the last 7 days
		return false;
	}

	return moment().subtract(moment(config.coinsLastUpdated, 'YYYY-MM-DD').format()).days();

}
/**
 * Gets the daily average of each coin. This will need to be run
 * at the same time each day for each coin so we can run
 * computations against it
 */
const getDayAvg = (coinList) => {

}

/**
 * Save all historical pricing for future comparisons
 */
const setDayAvg = (coinList) => {

}

module.exports = {
	getSingleCoinList: getSingleCoinList,
	getFullCoinList: getFullCoinList,
	getMergedCoinList: getMergedCoinList,
	getCoinImages: getCoinImages,
	getPriceHistoricalAndSave: getPriceHistoricalAndSave,
	getDayAvg: getDayAvg,
	setDayAvg: setDayAvg
}
