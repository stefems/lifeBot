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
BEGIN runRetweetBot.js
===============*/
//id for @bottestinglol
let id = '830885846375034880';
let ids = [];
let badWords = [];
let tweetFilter = "";
let currentDay = new Date();
//--------------------

let numberOfLocationsIncluded = 1;
let numberOfActivitiesIncluded = 1;
let numberOfTweetsToFavorite = 7;
let favsAndRetweetsNeededForFavoriting = 0;
let hoursAgo = 2;
//---------------------
runFavoriteRandomTask();

function runFavoriteRandomTask() {
	let currentMonth = "";
	//Setting the current day
	if (currentDay.getMonth() < 10) {
		currentMonth = "0" + (currentDay.getMonth() + 1);
	}
	currentDate = currentDay.getFullYear() + "-" + currentMonth + "-" + currentDay.getDate();

	fs.readFile("badWords.json", 'utf8', function(err, data){
		if (!err) {
			badWords = JSON.parse(data).badWords;
			wordfilter.addWords(badWords);
			fs.readFile("wordsAndHashTagsToLookFor.json", 'utf8', function(err, data){
				if (!err) {
					tweetFilter = makeArrayString(JSON.parse(data));
					//hashTagsToLookFor = JSON.parse(data).hashTagsToLookFor;
					handleRateLimit();
				}
				else {
					console.log("CRITICAL ERROR: reading the words/hashtags to look for json file Failed.");
				}
			});
		}
		else {
			console.log("CRITICAL ERROR: reading the bad words json file Failed.");
		}
	});
}
function makeArrayString(jsonWordListing) {
	let locations = jsonWordListing.locationList;
	let activities = jsonWordListing.activityList;
	let returnString = "";
	for (let i = 0; i < numberOfLocationsIncluded; i++) {
		let randomLocationNumber = Math.floor(Math.random() * (locations.length-1 - 0) + 0);
		returnString += locations[randomLocationNumber] + "+";
	}
	for (let i = 0; i < numberOfActivitiesIncluded; i++) {
		let randomLocationNumber = Math.floor(Math.random() * (activities.length-1 - 0) + 0);
		if (i == numberOfActivitiesIncluded - 1) {
			returnString += activities[randomLocationNumber] + " ";
		}
		else {
			returnString += activities[randomLocationNumber] + "+";
		}
	}
	return returnString;
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
	  		console.log("current date: " + currentDate + "\nwords: " + tweetFilter);
	  		Twitter.get('search/tweets', { q: tweetFilter + "since:" + currentDate, count: 30, lang:"en" }, function(err, data) {
	  			if (!err) {
	  				handleTweets(data);
	  			}
	  			else {
					console.log("CRITICAL ERROR: failed to get the tweets from the search.");
	  			}
	  		});
	  	}
	  	else {
	  		console.log("CRITICAL ERROR: handleRateLimit() Failed.");
	  	}
  	});
}


function handleTweets(data) {
	console.log("statuses found: " + data.statuses.length + "\n-------------------");
	if (data.statuses.length > 0) {
		let max = 0;
		let bestTweetId = "";
		let bestTweetIndex = 0;
		let currentHour = currentDay.getUTCHours();
		console.log("current hour: " + currentHour);
		for (let i = 0; i < data.statuses.length; i++) {
			let tweetHour = data.statuses[i].created_at.substring(11, 13);
			//TODO: what if the current hour is less than hoursAgo?  
			//if popular, if not blacklisted, if within last hour
			if ( (favsAndRetweetsNeededForFavoriting <= (data.statuses[i].retweet_count + data.statuses[i].favorite_count) )
				&& (wordfilter.blacklisted(data.statuses[i].text) == false)
				&& (tweetHour >= currentHour - hoursAgo) ) {
				//-------------
				//NEXT FUNCTION ------>
				//-------------
				favorite(data.statuses[i].id_str);
			}
			else {
				console.log("-------------------\nTweet was not favorited because of it being blacklisted, old, or not popular.\n-------------------");
			}
		}
	}
	else {
		console.log("Found no statuses given the search terms.");
	}
	
}
function favorite(tweetToFavorite) {
	Twitter.post("favorites/create", {id: tweetToFavorite}, function(err, data) {
		if (!err) {
			console.log("-------------------\nfavorited tweet at time: " + data.created_at);
			console.log("favorited tweet containing text: " + data.text);
			console.log("favorited tweet from user: " + data.user.screen_name);
			console.log("favorited tweet url: https://twitter.com/statuses/" + tweetToFavorite + "\n-------------------");
		}
		else {
			console.log("-------------------\nCRITICAL ERROR: favorite() failed.");
			console.log(err.message + "\n-------------------");
		}
	});
}