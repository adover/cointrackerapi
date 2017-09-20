const express = require('express');
const { getFullCoinList, getCoinImages, getTopCoins, getPriceHistoricalAndSave } = require('../controllers/api');
const { getCachedCoins, getCommands } = require('../controllers/redis');
const router = express.Router();

const config = require('../config.json');

router.get('/', (req, res, next) => {
  res.render('index', { title: 'Express' });
});

router.get('/api/:param', (req, res, next) => {

	res.setHeader('Content-Type', 'application/json');

});

router.get('/coins', async (req, res, next) => {
 	const coinList = await getCachedCoins();

 	res.json(coinList);
});

router.get('/redis', async (req, res, next) => {
	const commands = await getCommands();
	res.json(commands);
});
router.get('/historical', async (req, res, next) => {
	let coinList;
	let history;

	try{
		coinList = await getCachedCoins();
	}catch(e) {
		res.status(500).send(e);
	}

	try{
		history = await getPriceHistoricalAndSave(coinList);
	}catch(e) {
		console.log(e);
		res.status(500).send(e);
	}

	res.json(history);
})
router.get('/install', async (req, res, next) => {

	const coinList = getFullCoinList();

	if(!config.hasCoinImages) {
		getCoinImages(coinList);
	}

	getPriceHistoricalAndSave(finalCoinList);

	res.json('Set some coins in the cache');


});

module.exports = router;
