import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { check } from 'meteor/check';
import { Async } from 'meteor/meteorhacks:async';

import { Tweets } from '../imports/api/tweets.js';

Meteor.publish('tweets', function tweetsPublication() {
  return Tweets.find({});
});
Meteor.startup(() => {
  let elasticsearch = require('elasticsearch');
  let client = new elasticsearch.Client({
    host: 'elasticsearch_host',
    connectionClass: require('http-aws-es'),
    amazonES: {
      region: 'aws_region',
      accessKey: 'accessKey',
      secretKey: 'secretKey'
    },
    log: 'trace'
  });

  Meteor.methods({
    'searchAll'() {
      client.search({
        index: 'candidatetweets',
        type: 'tweet',
        size: 100,
        sort: 'date:desc',
        body: {
          query: {
            match_all: {}
          }
        }
      }, Meteor.bindEnvironment((error, response) => {
        if (error) {
          console.log(error.message);
        } else {
          let tweets = response.hits.hits;
          tweets.forEach((tweet) => {
            if (!Tweets.findOne(tweet._id)) {
              Tweets.insert(tweet);
            }
          });
        }
      }, (err) => { console.log(err.message); }));
    },
    'searchFor'(query) {
      check(query, String);

      let response = Async.runSync((done) => {
        client.search({
          index: 'candidatetweets',
          type: 'tweet',
          size: 100,
          sort: 'date:desc',
          q: query
        }, (error, response) => {
          done(error, response);
        });
      });
      if (response.error) {
        console.log(response.error.message);
      } else {
        let tweetIds = [];
        let tweets = response.result.hits.hits;
        tweets.forEach((tweet) => {
          tweetIds.push(tweet._id);
          if (!Tweets.findOne(tweet._id)) {
            Tweets.insert(tweet);
          }
        });
        return tweetIds;
      }
    },
    'searchFrom'(latLng, distance) {
      check(latLng, {lat: Number, lng: Number});
      check(distance, String);

      let response = Async.runSync((done) => {
        client.search({
          index: 'candidatetweets',
          type: 'tweet',
          size: 100,
          sort: 'date:desc',
          body: {
            query: {
              filtered: {
                query: {
                  match_all: {}
                },
                filter: {
                  geo_distance: {
                    distance: distance,
                    'coordinates.coordinates': [latLng.lng, latLng.lat]
                  }
                }
              }
            }
          }
        }, (error, response) => {
          done(error, response);
        });
      });
      if (response.error) {
        console.log(response.error.message);
      } else {
        let tweetIds = [];
        let tweets = response.result.hits.hits;
        tweets.forEach((tweet) => {
          tweetIds.push(tweet._id);
          if (!Tweets.findOne(tweet._id)) {
            Tweets.insert(tweet);
          }
        });
        return tweetIds;
      }
    }
  });
});
