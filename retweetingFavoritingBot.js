//==================================================
// Import the dependencies
const cheerio = require("cheerio")
    , req = require("tinyreq")
    ;
let wordfilter = require('wordfilter');
let fs = require('fs');
let twit = require('twit');
let RSVP = require('rsvp');
let scheduler = require('node-schedule');
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

//==================================================
//Local Node Setup
//let config = require('../.configLifeBot.js');
//let Twitter = new twit(config);

//==================================================
//Configuration Variables
let id = '830885846375034880'; //id for @bottestinglol, this is the bot's twitter account
let badWordsData; //json used for bad words to be added to the filter system
let wordsAndTagsData; //json for words and tags used when searching for content to like
let tweetIdsRetweeted; //json for keeping track of tweets the bot has liked
let tweetIdsFavorited; //json for keeping track of tweets the bot has retweeted
let numberOfTweetsToFavorite = 7;
let numberOfRandomTweetsToFavorite = 5;
let favsAndRetweetsNeededForFavoriting = 0;
let hoursAgo = 2;
let logLine = 		"\n-----------------------------------\n";
let startLine = 	"\n===================================\n";
let logErrorLine = 	"\n***********************************\n";
beginBotActions();

function beginBotActions() {
	badWordsData = loadJson("badWords.json");
	wordsAndTagsData = loadJson("wordsAndHashTagsToLookFor.json");
	//read in the badwords and tags to search for
	if (badWordsData !== false && wordsAndTagsData !== false) {
		//adding the list to the filter
		wordfilter.addWords(badWordsData.badWords);
		//this line for cron
		let botRunning = scheduler.scheduleJob('*/30 * * * *', runBot);
		//this line for manual testing
		//runBot();
	}
	else {
		console.log(logErrorLine + "json files (badWords.json and wordsAndHashTagsToLookFor.json) failed to load. No tweets have been favorited or retweeted." + logErrorLine);
	}
	
}

function runBot() {
	console.log(startLine + "Beginning retweeting and favoriting actions!" + startLine);
	//check the rate limit
	let rateCheckPromise = new RSVP.Promise(function(success, failure){
		Twitter.get('application/rate_limit_status', function(err, data, response) {
			if (!err) {
				for (var key in data.resources) {
					if (data.resources.hasOwnProperty(key)) {
						for (var smallerKey in data.resources[key]) {
							if (data.resources[key].hasOwnProperty(smallerKey)) {
								//console.log(smallerKey + " || Remaining:  " + data.resources[key][smallerKey].remaining);
								if (data.resources[key][smallerKey].remaining < 5) {
									console.log(logErrorLine + smallerKey + " has " + data.resources[key][smallerKey].remaining + " remaining requests. Please wait 15 minutes." + logErrorLine);
									failure();
									return;
								}
							}
						}
					}
				}
	  			console.log(logLine + "Twitter API rate was checked, we're good." + logLine);
	  			success();
		  	}
		});
	});
	rateCheckPromise.then(
		function() {
			tweetIdsFavorited = loadJson("tweetIdsFavorited.json");
			tweetIdsRetweeted = loadJson("tweetIdsRetweeted.json");
			if (tweetIdsFavorited !== false && tweetIdsRetweeted !== false) {
				//get the friends list -> like friend's tweets, retweet friend's tweets
				Twitter.get('friends/list', {user_id: id, cursor: -1}, handleFriendList);
				//conduct search for random tweets and like them too
				findRandomTweets();
			}
			else {
				console.log(logErrorLine + "Failed to load the tweetIdsFavorited.json and tweetIdsRetweeted.json files." + logErrorLine);
			}
		},
		function(){
			//stop the process
		}
	);
}

function findRandomTweets() {
	//pick activity type and corresponding hype tag
	let currentFilter = makeFilterString();
	let currentDay = new Date();
	let currentMonth = "";
	let currentHour = currentDay.getUTCHours();
	//Setting the current day
	if (currentDay.getMonth() < 10) {
		currentMonth = "0" + (currentDay.getMonth() + 1);
	}
	let currentDate = currentDay.getFullYear() + "-" + currentMonth + "-" + currentDay.getDate();

	console.log(logLine + "current date: " + currentDate + "\ncurrent hour: " + currentHour + "\ncurrent filter: " + currentFilter);
	Twitter.get('search/tweets', { q: currentFilter + " since:" + currentDate, count: 30, lang:"en" }, function(err, data) {
		if (!err) {
			if (data.statuses.length == 0) {
				console.log(logLine + "no statuses found for filter: " + currentFilter + logLine);
			}
			else {
				console.log(data.statuses.length + " statuses found." + logLine);
				for (let i = 0; i < numberOfRandomTweetsToFavorite; i++) {
					if (i < data.statuses.length) {
						let tweetHour = data.statuses[i].created_at.substring(11, 13);
						if ( (favsAndRetweetsNeededForFavoriting <= (data.statuses[i].retweet_count + data.statuses[i].favorite_count) ) &&
							 (wordfilter.blacklisted(data.statuses[i].text) === false) &&
							 (tweetHour >= currentHour - hoursAgo) ) {

							favorite(data.statuses[i].id_str);
						}
						else {
							console.log(logLine + "Random tweet selected did not meet the conditions for being favorited." + logLine);
						}
					}
					else {
						break;
					}
				}
			}
		}
		else {
			console.log(logErrorLine + "Failed to get the tweets from the search." + logErrorLine);
		}
	});
}

function makeFilterString() {
	let returnString = "";
	//random activity type
	let randomActivity = wordsAndTagsData.activityTypes[Math.floor(Math.random() * (wordsAndTagsData.activityTypes.length-1 - 0) + 0)];
	//get corresponding hype tag
	let randomHype = wordsAndTagsData.activityHypeTags[randomActivity][Math.floor(Math.random() * (wordsAndTagsData.activityHypeTags[randomActivity].length-1 - 0) + 0)];
	returnString = "#" + randomActivity + "+#" + randomHype;
	if (returnString != "") {
		return returnString;
	}
}
//Getting the bot's friends' ids
function handleFriendList(err, data, response) {
	if (!err) {
		let ids = [];
		for (let i = 0; i < data.users.length; i++) {
			ids.push(data.users[i].screen_name);
		}
		if (data.next_cursor != 0) {
			Twitter.get('friends/list', {user_id: id, cursor: data.next_cursor }, handleFriendList);
		}
		else {
			//call function for liking friends tweets
			likeFriendsTweets(ids);
			//call function for retweeting friends tweets
			rewteetFromFriends(ids);
		}
	}
	else {
		console.log(logErrorLine + "handleIdData() Failed." + logErrorLine);
	}
}
/* Given the full list of friends, choose a random friend and like one of their statuses.
   We do this as many times as we have set via the numberOfTweetsToFavorite variable. We
   also get 3 statuses from each friend and choose one given certain criteria.
*/
function likeFriendsTweets(idArray) {
	let idNumber = 0;
	for (let i = 0; i < numberOfTweetsToFavorite; i++) {
		idNumber = Math.floor(Math.random() * (idArray.length-1 - 0) + 0);
		Twitter.get('search/tweets', {q: "from:"+idArray[idNumber], count: 3}, function(err, data) {
			if(!err && data.statuses.length != 0) {
				findPopularTweet(data, tweetIdsFavorited);
			}
		});
	}
}

/* Choose a random friend, get their most recent 20 tweets, and retweet their most popular one.
*/
function rewteetFromFriends(idArray) {
	let idNumber = Math.floor(Math.random() * (idArray.length-1 - 0) + 0);
	Twitter.get('search/tweets', {q: "from:"+idArray[idNumber], count: 20}, function(err, data) {
		if (!err && data.statuses.length != 0) {
			findPopularTweet(data, tweetIdsRetweeted);
		}
		else {

		}
	});

}

function findPopularTweet(tweetsData, list) {
	let max = 0;
	let bestTweetId = '';
	//go through all of this friend's tweets
	for (let i = 0; i < tweetsData.statuses.length; i++) {
		//calculate this tweet's popularity
		currentPopularity = tweetsData.statuses[i].retweet_count + tweetsData.statuses[i].favorite_count;
		//if the current tweet is more popular, doesn't contain bad words, and hasn't been liked already
		if ( (max < currentPopularity) && 
			 (!wordfilter.blacklisted(tweetsData.statuses[i].text)) &&
			 (list.tweets.indexOf(tweetsData.statuses[i].id_str) === -1) ) {

			max = currentPopularity;
			bestTweetId = tweetsData.statuses[i].id_str;
		}
	}
	if (bestTweetId !== "") {
		//tweet or retweet
		if (list.id === "retweets") {
			retweet(bestTweetId);
		}
		else if (list.id === "favorites") {
			favorite(bestTweetId);
		}
	}	
}

function retweet(idToRetweet) {
	let delayMillis = 5000; //5 seconds
	setTimeout(function() {
		Twitter.post('statuses/retweet/:id', {id: idToRetweet}, function (err, data, response) { 
			if (!err) {
				console.log(logLine + "retweet time: " + data.created_at);
				console.log("retweet text: " + data.text);
				console.log("retweeted tweet from user: " + data.user.screen_name);
				console.log("retweeted tweet url: https://twitter.com/statuses/" + idToRetweet + logLine);
				tweetIdsRetweeted.tweets.push(idToRetweet);
				fs.writeFile("tweetIdsRetweeted.json", JSON.stringify(tweetIdsRetweeted), 'utf8', function(err, data) {
					if (!err) {
						//console.log("updated url json file with event urls that we shared.");
					}
					else {
						console.log(logErrorLine + err.message + " Failed to write to tweetIdsRetweeted.json" + logErrorLine);
					}
				});
			}
			else {
				console.log(logErrorLine + "retweet() failed.\n" + err.message + logErrorLine);
			}
		});
	}, delayMillis);
}
function favorite(idToFavorite) {
	let delayMillis = 5000; //5 seconds
	setTimeout(function() {
		Twitter.post("favorites/create", {id: idToFavorite}, function(err, data, response) {
			if (!err) {
				console.log(logLine + "favorited time: " + data.created_at);
				console.log("favorited tweet text: " + data.text);
				console.log("favorited tweet from user: " + data.user.screen_name);
				console.log("favorited tweet url: https://twitter.com/statuses/" + idToFavorite + logLine);
				tweetIdsFavorited.tweets.push(idToFavorite);
				fs.writeFile("tweetIdsFavorited.json", JSON.stringify(tweetIdsFavorited), 'utf8', function(err, data) {
					if (!err) {
						//console.log("updated url json file with event urls that we shared.");
					}
					else {
						console.log(logErrorLine + err.message + " Failed to write to tweetIdsFavorited.json" + logErrorLine);
					}
				});
			}
			else {
				console.log(logErrorLine + "favorite() failed.\n" + err.message + logErrorLine);
			}
		});
	}, delayMillis);
}

function loadJson(fileName) {
	let dataLoading;
	try {
		dataLoading = fs.readFileSync(fileName, 'utf8');
	}
	catch(err) {
		return false;
	}
	return JSON.parse(dataLoading);
}