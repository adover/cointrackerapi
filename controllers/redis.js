/**
 * CryptoCompare API Redis Cache
 */

const redis = require("redis");
const config = require('../config.json');

const each = require('lodash/each');

const startRedis = () => {
	const client = redis.createClient();

	return new Promise ((res,rej) => {
		client.on('connect', () => {
    		res(client);
		});
	});
}

const getCommands = () => {
	
	return new Promise((resolve,reject) => {
		const commands = require('redis-commands');

		resolve(commands);
	})
}

const saveCoin = (coin) => {

	startRedis().then(client => {
		console.log(coin.id); // key
		// coin is value
		client.hset('cointracker', coin.id, JSON.stringify(coin));
	}).catch(err => {
		return false;
	})

}

const getCachedCoins = () => {
	// Update coins before getting all coins
	// Above  comment is a bad idea as it will
	// put unnnecessary strain on the server
	return new Promise((resolve,reject) => {
		
		startRedis().then(client => {

			client.hgetall('cointracker', (err, results) => {
		        if (err) reject(err);

		        each(results, (result, key) => {
		        	results[key] = JSON.parse(result);
		        });

	            resolve(results);
		    });

		}).catch(err => {
			return false;
		})

	});
}

const updateCachedCoinValue = (coin) => {
	// Updating coins requires a call to the API to fetch latest prices
}

module.exports = {
	startRedis: startRedis,
	saveCoin: saveCoin,
	getCommands: getCommands,
	getCachedCoins: getCachedCoins
}
