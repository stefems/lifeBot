# RageLife Twitter Bot Source Code

<u>File Descriptions:</u>
* badWords.json contains words that are used to filter tweets from being favorited or retweeted
* EventListing.json contains meetup.com group urls, used for sharing event links
* EventURLsShared.json contains a list of URLS of events that we've already shared on twitter
* wordsAndHashTagsToLookFor.json contains the activity types and corresponding hype tags for finding and favoriting tweets
* tweetIdsRetweeted.json contains a list of tweet Ids so that we don't retweet the same tweet (the api won't allow it anyway)
* tweetIdsFavorited.json contains a list of tweet Ids so that we don't favorite the same tweet (the api won't allow it anyway)
* retweetingFavoritingBot.js contains the code that favorites and retweets
* eventSharingBot.js contains the code that shares events from eventbrite and meetup.com (and soon to be ragelife)
* Procfile configures what commands should be run by the heroku app (in this case: the two *Bot.js files)
* don't mess with the other files...




