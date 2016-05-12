var AWS = require('aws-sdk');
var sns = new AWS.SNS({region: 'REGION'});
var AlchemyAPI = require('./alchemyapi');
var alchemyapi = new AlchemyAPI();

var moment = require('moment');

var Consumer = require('sqs-consumer');

var app = Consumer.create({
  queueUrl: 'QUEUE_URL',
  region: 'REGION',
  batchSize: 10,
  handleMessage: function(message, done) {
    var tweet = JSON.parse(message.Body);
    alchemyapi.sentiment('text', tweet.text, {}, function(response) {
      if (response.status === 'OK') {
        tweet.sentiment = response.docSentiment.type;
        tweet.date = moment(tweet.created_at, 'ddd MMM DD HH:mm:ss ZZ YYYY', 'en').valueOf();
        sns.publish({
          Message: JSON.stringify(tweet),
          MessageAttributes: {
            tweet: {
              DataType: 'String',
              StringValue: 'json'
            }
          },
          Subject: 'New Processed Tweet',
          TopicArn: 'TOPIC_ARN'
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
    done();
  }
});
 
app.on('error', function(err) {
  console.log(err.message);
});
 
app.start();
