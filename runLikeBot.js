// Import the dependencies
const cheerio = require("cheerio")
    , req = require("tinyreq")
    ;
let wordfilter = require('wordfilter');
let fs = require('fs');
let twit = require('twit');
let RSVP = require('rsvp');


//==================================================
//Heroku Setup

let key = process.env.consumer_key;
let keysecret = process.env.consumer_secret;
let token = process.env.access_token;
let tokensecret = process.env.access_token_secret;
var Twitter = new twit({
    consumer_key:         key,
    consumer_secret:      keysecret,
    access_token:         token,
    access_token_secret:  tokensecret,
});
//====================================================

//Local Node Setup
//let config = require('../.configLifeBot.js');
//let Twitter = new twit(config);

/*=============
BEGIN runLikeBot.js
===============*/
//id for @bottestinglol
let id = '830885846375034880';
let ids = [];
let badWords = [];
let tweetIdsToFavorite = [];
let numberOfTweetsToFavorite = 7;
runFavoriteTask();

function runFavoriteTask() {
	fs.readFile("badWords.json", 'utf8', function(err, data){
		if (!err) {
			badWords = JSON.parse(data).badWords;
			wordfilter.addWords(badWords);
			handleRateLimit();
		}
		else {
			console.log("CRITICAL ERROR: reading the bad words json file Failed.");
		}
	});
}


//Perform the rate check, need to wait for response
function handleRateLimit() {
	Twitter.get('application/rate_limit_status', function(err, data, response) {
		if (!err) {
			for (var key in data.resources) {
				if (data.resources.hasOwnProperty(key)) {
					for (var smallerKey in data.resources[key]) {
						if (data.resources[key].hasOwnProperty(smallerKey)) {
							//console.log(smallerKey + " || Remaining:  " + data.resources[key][smallerKey].remaining);
							if (data.resources[key][smallerKey].remaining < 5) {
								console.log(smallerKey + " has " + data.resources[key][smallerKey].remaining + " remaining requests. Please wait 15 minutes.");
								return;
							}
						}
					}
				}
			}
  			console.log("-------------------\nTwitter API rate was checked, we're good.\n-------------------");
	  		//-------------
	  		//NEXT FUNCTION ------>
	  		//-------------
	  		Twitter.get('friends/list', {user_id: id}, handleIdData);
	  	}
	  	else {
	  		console.log("CRITICAL ERROR: handleRateLimit() Failed.");
	  	}
  	});
}

//Getting the bot's friends' ids
function handleIdData(err, data, response) {
	if (!err) {
		for (let i = 0; i < data.users.length; i++) {
			ids.push(data.users[i].screen_name);
		}
		//-------------
		//NEXT FUNCTION ------>
		//-------------	
		Twitter.get('friends/list', {user_id: id, cursor: data.next_cursor }, handleNextData);	
	}
	else {
		console.log("CRITICAL ERROR: handleIdData() Failed.");
	}
}

//TODO: pagination is hard stuff, so this is just another function for
//      handling the next cursor of ids. CHANGE IF FRIENDS BECOMES
//		longer that 80!
function handleNextData(err, data, response) {
	if (!err) {
		for (let i = 1; i < data.users.length; i++) {
			ids.push(data.users[i].screen_name);
		}
		/*idNumber = Math.floor(Math.random() * (ids.length-1 - 0) + 0);
		Twitter.get('search/tweets', {q: "from:"+ids[idNumber], count: 20}, handleTweets);
		*/
		for (let i = 0; i < numberOfTweetsToFavorite; i++) {
			//idNumber = Math.floor(Math.random() * (ids.length-1 - 0) + 0);
			//-------------
			//NEXT FUNCTION ------>
			//-------------
			let delayMillis = 5000; //5 seconds
			setTimeout(function() {
				idNumber = Math.floor(Math.random() * (ids.length-1 - 0) + 0);
				/*console.log("random: " + idNumber);
				console.log("id: " + ids[idNumber]);*/
				Twitter.get('search/tweets', {q: "from:"+ids[idNumber], count: 20}, handleTweets);
			}, delayMillis);
		}
	}
	else {
		console.log("CRITICAL ERROR: handleNextData() Failed.");
	}
}

//We just got the most recent tweets from the picked friend and now
//  we want to pick the most popular one and retweet it.
function handleTweets(err, data, response) {
	if (!err) {
		let max = 0;
		let bestTweetId = "";
		let bestTweetIndex = 0;
		for (let i = 0; i < data.statuses.length; i++) {
			currentPopularity = data.statuses[i].retweet_count + data.statuses[i].favorite_count;
			if (max < currentPopularity && !wordfilter.blacklisted(data.statuses[i].text) ) {
				max = currentPopularity;
				bestTweetId = data.statuses[i].id_str;
				bestTweetIndex = i;
			}
		}
		//-------------
		//NEXT FUNCTION ------>
		//-------------
		if (bestTweetId != "") {
			favorite(bestTweetId);
		}
	}
	else {
		console.log("CRITICAL ERROR: handleTweets() failed.");
	}
}
function favorite(tweetToFavorite) {
	Twitter.post("favorites/create", {id: tweetToFavorite}, function(err, data, response) {
		if (!err) {
			console.log("-------------------\nfavorite time: " + data.created_at);
			console.log("favorite text: " + data.text);
			console.log("favorited tweet from user: " + data.user.screen_name);
			console.log("favorited tweet url: https://twitter.com/statuses/" + tweetToFavorite + "\n-------------------");
		}
		else {
			console.log("-------------------\nCRITICAL ERROR: favorite() failed.");
			if (err.message == "Narrowcast id params must be integers.") {
				console.log(err.message);
			}
			else {
				console.log(err.message);
			}
			console.log("-------------------");
		}
	});
}

function retweet(tweetToRetweet) {
	Twitter.post('statuses/retweet/:id', { id: tweetToRetweet }, function (err, data, response) { 
		if (!err) {
			console.log("retweet time: " + data.created_at);
			console.log("retweet text: " + data.text);
		}
		else {
			console.log("CRITICAL ERROR: retweet() failed.");
		}
	});
}
