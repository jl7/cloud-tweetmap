import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { check } from 'meteor/check';
import { Async } from 'meteor/meteorhacks:async';
import { Router } from 'meteor/iron:router';

import { Tweets } from '../imports/api/tweets.js';

Meteor.publish('tweets', function tweetsPublication() {
  return Tweets.find({});
});
Meteor.startup(() => {
  let elasticsearch = require('elasticsearch');
  let AWS = require('aws-sdk');
  let credentials = new AWS.SharedIniFileCredentials();
  let client = new elasticsearch.Client({
    host: 'AWS_ELASTICSEARCH_HOST',
    connectionClass: require('http-aws-es'),
    amazonES: {
      region: 'REGION',
      credentials: credentials
    },
    log: 'trace'
  });
  let sns = new AWS.SNS({region: 'REGION'});
  let MessageValidator = require('./sns-validator');
  let validator = new MessageValidator();
  validator.encoding = 'utf8';

  Router.route('/notify', function() {
    let req = this.request;
    let res = this.response;
    if (req.method === 'POST' && 'x-amz-sns-message-type' in req.headers) {
      validator.validate(JSON.parse(this.request.body), (err, message) => {
        if (err) {
          console.log(err.message);
          res.statusCode = 403;
          res.end('Invalid message\n');
        } else if (message['Type'] === 'SubscriptionConfirmation') {
          sns.confirmSubscription({
            Token: message['Token'],
            TopicArn: message['TopicArn']
          }, (err, data) => {
            if (err) {
              console.log(err.message);
            }
            else {
              console.log(data);
            }
          });
        } else if (message['Type'] === 'Notification') {
          let tweet = JSON.parse(message['Message']);
          Meteor.call('indexTweet', tweet, (err) => {
            if (err) {
              console.log(err.message);
            }
          });
        }
      });
      res.statusCode = 200;
      res.end('Received SNS message\n');
    } else {
      res.statusCode = 400;
      res.end('Bad request\n');
    }
  }, {where: 'server', onBeforeAction: Iron.Router.bodyParser.text()});

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
          throw error;
        } else {
          let hits = response.hits.hits;
          hits.forEach((hit) => {
            if (!Tweets.findOne(hit._id)) {
              Tweets.insert(hit);
            }
          });
        }
      }, (err) => { throw err; }));
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
        throw response.error;
      } else {
        let ids = [];
        let hits = response.result.hits.hits;
        hits.forEach((hit) => {
          ids.push(hit._id);
          if (!Tweets.findOne(hit._id)) {
            Tweets.insert(hit);
          }
        });
        return ids;
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
        throw response.error;
      } else {
        let ids = [];
        let hits = response.result.hits.hits;
        hits.forEach((hit) => {
          ids.push(hit._id);
          if (!Tweets.findOne(hit._id)) {
            Tweets.insert(hit);
          }
        });
        return ids;
      }
    },
    'indexTweet'(tweet) {
      client.index({
        index: 'candidatetweets',
        type: 'tweet',
        id: tweet.id_str,
        body: tweet
      }, Meteor.bindEnvironment((error) => {
        if (error) {
          throw error;
        } else {
          client.get({
            index: 'candidatetweets',
            type: 'tweet',
            id: tweet.id_str,
          }, Meteor.bindEnvironment((error, response) => {
            if (error) {
              throw error;
            } else {
              Tweets.insert(response);
            }
          }, (err) => { throw err; }));
        }
      }, (err) => { throw err; }));
    }
  });
});
