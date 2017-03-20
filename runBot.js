// Import the dependencies
const cheerio = require("cheerio")
    , req = require("tinyreq")
    ;
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


Twitter.get('application/rate_limit_status', handleRateLimit);

function tweetWithText(tweetText) {
	Twitter.post('statuses/update', { status: tweetText }, function(err, data, response) {
		if (!err) {
		 	console.log(data.text);
		}
		else {
			console.log(err);
		}
	});
}


function handleRateLimit(err, data, response) {
  //console.log(data.resources.friends);
	for (var key in data.resources) {
		if (data.resources.hasOwnProperty(key)) {
		  for (var smallerKey in data.resources[key]) {
		    if (data.resources[key].hasOwnProperty(smallerKey)) {
		        console.log(smallerKey + " || Remaining:  " + data.resources[key][smallerKey].remaining);
		        if (data.resources[key][smallerKey].remaining < 5) {
		          console.log(smallerKey + " has " + data.resources[key][smallerKey].remaining + " remaining requests. Please wait 15 minutes.");
		          return;
		        }
		    }
		  }
		}
	}
  	console.log("api rate was checked, we're good.");
}

