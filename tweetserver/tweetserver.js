var Twit = require('twit');
var elasticsearch = require('elasticsearch');
var moment = require('moment');

var T = new Twit({
  consumer_key: 'consumer_key',
  consumer_secret: 'consumer_secret',
  access_token: 'access_token',
  access_token_secret: 'access_token_secret'
});

var client = new elasticsearch.Client({
  host: 'elasticsearch_host',
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
              position: {
                type: 'geo_point'
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
  if (tweet.coordinates) {
    tweet.position = tweet.coordinates.coordinates;
    tweet.date = moment(tweet.created_at, 'ddd MMM DD HH:mm:ss ZZ YYYY', 'en').valueOf();
    client.index({
      index: 'candidatetweets',
      type: 'tweet',
      id: tweet.id_str,
      body: tweet
    }, function(error) {
      if (error) {
        console.error(error.message);
      }
    });
  }
});
