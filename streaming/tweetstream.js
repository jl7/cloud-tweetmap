var AWS = require('aws-sdk');
var sqs = new AWS.SQS({region: 'REGION'});
var queueURL = 'QUEUE_URL';

var Twit = require('twit');

var T = new Twit({
  consumer_key: 'CONSUMER_KEY',
  consumer_secret: 'CONSUMER_SECRET',
  access_token: 'ACCESS_TOKEN',
  access_token_secret: 'ACCESS_TOKEN_SECRET'
});

var stream = T.stream('statuses/filter', { language: 'en', track: ['Hillary Clinton', 'Bernie Sanders', 'Donald Trump'] });

stream.on('tweet', function(tweet) {
  if (tweet.coordinates) {
    sqs.sendMessage({
      MessageBody: JSON.stringify(tweet),
      QueueUrl: queueURL,
      DelaySeconds: 0,
      MessageAttributes: {
        tweet: {
          DataType: 'String',
          StringValue: 'json'
        }
      }
    }, function(err, data) {
      if (err) {
        console.log(err.message);
      }
      else {
        console.log(data);
      }
    });
  }
});
