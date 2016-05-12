COMS E6998 Cloud Computing & Big Data: TweetMap

streaming contains tweetstream.js which streams tweets from Twitter into AWS SQS using Node.js
processing contains tweetprocessor.js which consumes tweets from AWS SQS, performs sentiment analysis on the tweets, and sends the analyzed tweet to AWS SNS
tweetmap contains the tweetmap client app implemented in Meteor which receives the tweets from SNS and indexes them in AWS Elasticsearch
