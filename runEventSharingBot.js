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
/*
let key = process.env.consumer_key;
let keysecret = process.env.consumer_secret;
let token = process.env.access_token;
let tokensecret = process.env.access_token_secret;
var Twitter = new twit({
    consumer_key:         key,
    consumer_secret:      keysecret,
    access_token:         token,
    access_token_secret:  tokensecret,
});*/
//====================================================

//Local Node Setup
let config = require('../.configLifeBot.js');
let Twitter = new twit(config);

/*=============
BEGIN runEventSharingBot.js
===============*/
//id for @bottestinglol
let id = '830885846375034880';
let ids = [];
//--------------------
let meetupList = [];
let eventURLsJSON = null;
let eventURLsSharedList = [];
let numberOfEventbriteActivityURLs = 2;
let numberOfEventsToSharePerMeetupGroup = 2;
let hoursAgo = 2;
//---------------------
runEventSharingTask();
function runEventSharingTask() {
	fs.readFile("EventListing.json", 'utf8', function(err, data){
		if (!err) {
			meetupList = JSON.parse(data).eventListing;
			fs.readFile("EventURLsShared.json", 'utf8', function(err, data){
				if (!err) {
					eventURLsJSON = JSON.parse(data);
					eventURLsSharedList = eventURLsJSON.eventURLsShared;
					addEventbriteURLs();
				}
				else {
					console.log("failed to load the event url json");
				}
			});
		}
		else {
			console.log("CRITICAL ERROR: reading the words/hashtags to look for json file Failed.");
		}
	});
}


function addEventbriteURLs() {
	fs.readFile("wordsAndHashTagsToLookFor.json", 'utf8', function(err, data){
		if (!err) {
			let eventBriteOptions = JSON.parse(data).EventBriteOptions;
			//TODO: PICK RANDOM EVENTS FROM THE LISTING
			for (let i = 0; i < numberOfEventbriteActivityURLs; i++) {
				if (i < eventBriteOptions.length) {
					meetupList.push("https://www.eventbrite.com/d/co--denver/" + eventBriteOptions[i] + "/?crt=regular&sort=best");
				}
				else {
					break;
				}
			}
			handleRateLimit();
		}
		else {
			console.log("failed to load the eventBriteOptions");
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
	  		scrapeForEvents();	  		
	  	}
	  	else {
	  		console.log("CRITICAL ERROR: handleRateLimit() Failed.");
	  	}
  	});
}


function scrapeForEvents() {
	for (let i = 0; i < meetupList.length; i++){
		let filterToUse = [];
		if (meetupList[i].includes("meetup.com")) {
    		filterToUse = ["#ajax-container .event-item .hoverLink"];
    	}
    	else if (meetupList[i].includes("eventbrite.com")) {
    		filterToUse = [".js-event-list-container .list-card-v2"];
        }
        else if (meetupList[i].includes("colorado.com")) {
    		filterToUse = [".item-list ul li ", "h3 a", "article section img"];
        }
		scrapeURL(meetupList[i], filterToUse, (err, data) => {
			if (!err && (data != false) && data.eventArray.length != 0) {
				for (let i = 0; i < numberOfEventsToSharePerMeetupGroup; i++){
					if (i < data.eventArray.length && (typeof data.eventArray[i] != "undefined")){
						if (filterToUse.indexOf("h3 a") != -1) {
							//console.log("co events to tweet: " + data.eventArray[i] + ", " + data.titleArray[i] + ", " + data.imgSrcArray[i]);
							tweetWithText(data.eventArray[i], data.titleArray[i], data.imgSrcArray[i]);
						}
						else {
							//console.log("mu/eb events to tweet: " + data.eventArray[i]);
							tweetWithText(data.eventArray[i]);
						}
						console.log("-----------");
					}
					else {
						break;
					}
				}
			}
			if (err) {
				console.log("The scrape on this url: " + meetupList[i] + " failed. Incorrect URL?");
			}
		});
	}
}
function scrapeURL(url, filter, cb) {
	// 1. Create the request
    req({url: url, headers: {"user-agent": "Chrome/51.0.2704.103"} }, (err, body) => {
        if (err) { return cb(err); }

        // 2. Parse the HTML
        let $ = cheerio.load(body)
          , pageData = { "eventArray": [], "titleArray": [], "imgSrcArray": []}
          ;
        let eventsFound = $(filter[0]);
        //TODO: should not use the $ as much?
        console.log("Scraping URL: " + url);
        console.log("found " + eventsFound.length + " events with filter: " + filter[0]);
        for (let i = 0; i < eventsFound.length; i++) {
        	//if the url has not already been shared
    		if (filter.indexOf("h3 a") != -1) {
    			if (eventURLsSharedList.indexOf("http://www.colorado.com" + $(eventsFound[i]).find($(filter[1]))) == -1) {
        			pageData.eventArray.push("http://www.colorado.com" + $(eventsFound[i]).find($(filter[1])).attr("href"));
        			pageData.titleArray.push($(eventsFound[i]).find($(filter[1])).attr("title"));
        			pageData.imgSrcArray.push($(eventsFound[i]).find($(filter[2])).attr("src"));
        		}
        		else {
	          		console.log("event at url: " + "http://www.colorado.com" + $(eventsFound[i]).attr("href") + " already tweeted.");
	          	}
    		}
    		else if (filter.indexOf(".js-event-list-container .list-card-v2") != -1) {
    			if (eventURLsSharedList.indexOf($(eventsFound[i]).data("share-url")) == -1) {
    				pageData.eventArray.push($(eventsFound[i]).data("share-url"));
    			}
    		}
    		else {
    			if (eventURLsSharedList.indexOf($(eventsFound[i]).attr("href")) == -1) {
					pageData.eventArray.push($(eventsFound[i]).attr("href"));
				}
				else {
	          		console.log("event at url: " + $(eventsFound[i]).attr("href") + "already tweeted.");
	          	}
    		}
        }
        if (eventsFound.length === 0) {
        	console.log("This event URL does not have any events or (if meetup) has its event details hidden.");
        	pageData = false;
        }
        console.log("-------------------");
	    cb(null, pageData);
    });
}

//Perform a tweet, pass the function a string
function tweetWithText(tweetURL, text, image) {
	let tweetContent = tweetURL;
	//what happens when title is longer than characters available for tweet?
	if (typeof text != "undefined") {
		tweetContent = tweetURL + " " + text;
	}

	Twitter.post('statuses/update', { status: tweetContent }, function(err, data, response) {
		if (!err) {
			console.log("-------------------\ntweet time: " + data.created_at);
			console.log("Event tweet text: " + data.text);
			eventURLsSharedList.push(tweetURL);
			fs.writeFile("EventURLsShared.json", JSON.stringify(eventURLsJSON), 'utf8', function(err, data) {
				if (!err) {
					console.log("updated url json file with event urls that we shared.");
				}
				else {
					console.log(err.message);
				}
				console.log("-------------------");
			});
		}
		else {
			console.log(err.message);
		}
	});
}