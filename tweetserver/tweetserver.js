var Twit = require('twit');
var elasticsearch = require('elasticsearch');
var moment = require('moment');
var AlchemyAPI = require('./alchemyapi');
var alchemyapi = new AlchemyAPI();

var T = new Twit({
  consumer_key: 'consumer_key',
  consumer_secret: 'consumer_secret',
  access_token: 'access_token',
  access_token_secret: 'access_token_secret'
});

var client = new elasticsearch.Client({
  host: 'elasticsearch_host',
  connectionClass: require('http-aws-es'),
  amazonES: {
    region: 'aws_region',
    accessKey: 'accessKey',
    secretKey: 'secretKey'
  },
  log: 'trace'
});

client.indices.exists({
  index: 'candidatetweets'
}, function(error, response) {
  if (error) {
    console.error(error.message);
  } else if (!response) {
    client.indices.create({
      index: 'candidatetweets',
      body: {
        mappings: {
          tweet: {
            properties: {
              date: {
                type: 'date'
              },
              coordinates: {
                properties: {
                  coordinates: {
                    type: 'geo_point'
                  }
                }
              }
            }
          }
        }
      }
    }, function(error) {
      if (error) {
        console.error(error.message);
      } 
    });
  }
});

var stream = T.stream('statuses/filter', { track: ['Hillary Clinton', 'Bernie Sanders',
                                                    'Ben Carson', 'Ted Cruz', 'John Kasich', 'Marco Rubio', 'Donald Trump'] });

stream.on('tweet', function(tweet) {
  if (tweet.coordinates && tweet.lang === 'en') {
    tweet.date = moment(tweet.created_at, 'ddd MMM DD HH:mm:ss ZZ YYYY', 'en').valueOf();
    alchemyapi.sentiment('text', tweet.text, {}, function(response) {
      if (response.status === 'OK') {
        tweet.sentiment = response.docSentiment.type;
        client.index({
          index: 'candidatetweets',
          type: 'tweet',
          id: tweet.id_str,
          body: tweet
        }, function(error) {
          if (error) {
            console.log(error.message);
          }
        });
      }
    });
  }
});
