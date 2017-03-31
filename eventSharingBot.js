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
//RageLife Datastore
var datastore = require('@google-cloud/datastore')({
  //projectId: '<PROJECTID>',
  // The path to your key file: 
  //keyFilename: '</path/to/keyfile.json>',
  // Or the contents of the key file: 
  //credentials: require('./path/to/keyfile.json')
});
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

//==================================================
//Local Node Setup
let config = require('../.configLifeBot.js');
let Twitter = new twit(config);

//==================================================
//Configuration Variables
//id for @bottestinglol
let id = '830885846375034880';
let ids = [];
//--------------------
let eventListingData; //json data for the meetup group urls, colorado.com events page
let eventUrlsSharedData; //json data for event urls that have already been shared
let wordsAndHashTagsToLookForData; //json data for eventbrite keywords for use in search
let meetupList = [];
let eventURLsJSON = null;
let numberOfEventbriteActivityURLs = 2;
let numberOfEventsToSharePerMeetupGroup = 2;
let logLine = 		"\n-----------------------------------\n";
let startLine = 	"\n===================================\n";
let logErrorLine = 	"\n***********************************\n";

beginBotActions();

function beginBotActions() {
	//this line for cron
	let botRunning = scheduler.scheduleJob('0 * * * *', runBot);
	//this line for manual testing
	//runBot();
}

function runBot() {
	console.log(startLine + "Beginning event sharing bot!" + startLine);
	eventListingData = loadJson("EventListing.json");
	eventUrlsSharedData = loadJson("EventURLsShared.json");
	wordsAndHashTagsToLookForData = loadJson("wordsAndHashTagsToLookFor.json");
	if (eventListingData !== false && eventUrlsSharedData !== false && wordsAndHashTagsToLookForData !== false) {
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
				//conduct event sharing here
				meetupList = eventListingData.eventListing;
				let eventBriteOptions = wordsAndHashTagsToLookForData.activityTypes;
				for (let i = 0; i < numberOfEventbriteActivityURLs; i++) {
					let randomActivityType = Math.floor(Math.random() * (eventBriteOptions.length-1 - 0) + 0);
					meetupList.push("https://www.eventbrite.com/d/co--denver/" + eventBriteOptions[randomActivityType] + "/?crt=regular&sort=best");
				}
				scrapeForEvents();			
			},
			function(){
				//stop the process
			}
		);
	}
	else {
		console.log(logErrorLine + "json files (EventListing.json and EventURLsShared.json) failed to load. No events have been shared." + logErrorLine);
	}
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
		scrapeURL(meetupList[i], filterToUse, (err, data) => {
			if (!err && (data != false) && data.eventArray.length != 0) {
				for (let i = 0; i < numberOfEventsToSharePerMeetupGroup; i++){
					if (i < data.eventArray.length && (typeof data.eventArray[i] != "undefined")){
						tweetWithText(data.eventArray[i]);
					}
					else {
						break;
					}
				}
			}
			else if(err){
				console.log(logErrorLine + "The scrape on this url: " + meetupList[i] + " failed. Incorrect URL?" + logErrorLine);
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
        console.log(logLine + "Scraping URL: " + url);
        console.log(eventsFound.length + " events found.");
        for (let i = 0; i < eventsFound.length; i++) {
        	//if the url has not already been shared
    		if (filter.indexOf(".js-event-list-container .list-card-v2") != -1) {
    			if (eventUrlsSharedData.eventURLsShared.indexOf($(eventsFound[i]).data("share-url")) == -1) {
    				pageData.eventArray.push($(eventsFound[i]).data("share-url"));
    			}
    			else {
	          		//console.log("The event at url: " + $(eventsFound[i]).data("share-url").attr("href") + " has already been tweeted.");
	          	}
    		}
    		else {
    			if (eventUrlsSharedData.eventURLsShared.indexOf($(eventsFound[i]).attr("href")) == -1) {
					pageData.eventArray.push($(eventsFound[i]).attr("href"));
				}
				else {
	          		//console.log("The event at url: " + $(eventsFound[i]).attr("href") + " has already been tweeted.");
	          	}
    		}
        }
        if (eventsFound.length === 0) {
        	//console.log("This event URL does not have any events or (if meetup) has its event details hidden.");
        	pageData = false;
        }
        console.log(logLine);
	    cb(null, pageData);
    });
}

//Perform a tweet, pass the function a string
function tweetWithText(tweetURL, text, image) {
	let delayMillis = 5000; //5 seconds
	setTimeout(function() {
		let tweetContent = tweetURL;
		//todo: what happens when title is longer than characters available for tweet?
		if (typeof text != "undefined") {
			tweetContent = tweetURL + " " + text;
		}
		Twitter.post('statuses/update', { status: tweetContent }, function(err, data, response) {
			if (!err) {
				console.log(logLine + "Event tweet created: " + data.created_at);
				console.log("Event tweet text: " + data.text);
				console.log("Event tweet url: https://twitter.com/statuses/" + data.id_str + logLine);
				eventUrlsSharedData.eventURLsShared.push(tweetURL);
				fs.writeFile("EventURLsShared.json", JSON.stringify(eventUrlsSharedData), 'utf8', function(err, data) {
					if (!err) {
						//console.log("updated url json file with event urls that we shared.");
					}
					else {
						console.log(logErrorLine + err.message + " Failed to write to eventURLsShared.json" + logErrorLine);
					}
				});
			}
			else {
				console.log(logErrorLine + "Tweeting the event failed. tweetWithText() \n" + err.message + logErrorLine);
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

function getFromDatastore() {
	var key = datastore.key(['Company', 'Google']);

	datastore.get(key, function(err, entity) {
	  // entity = The record.
	  // entity[datastore.KEY] = The key for this entity.
	});
	//query option also available, and paginating results might be
	// a thing to figure out.
}