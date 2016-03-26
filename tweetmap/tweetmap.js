Tweets = new Mongo.Collection('tweets');

if (Meteor.isClient) {
  Meteor.subscribe('tweets');
  Meteor.startup(function() {
    GoogleMaps.load({key: 'api_key'});
    $('select').selectize({
      dropdownParent: 'body',
      onItemAdd: function(value, $item) {
        if (value === 'all') {
          Meteor.call('searchAll', function(err, result) {
            if (err) {
              console.error(err.message);
            } else {
              deleteMarkers();
              Tweets.find({}).forEach(function(hit) {
                addMarker(hit._source.position);
              });
            }
          });
        } else {
          var qArr = value.split(' ');
          var query = qArr[0]+' AND '+qArr[1];
          Meteor.call('searchFor', query, function(err, result) {
            if (err) {
              console.error(err.message);
            } else {
              deleteMarkers();
              Tweets.find({_id: {$in: result}}).forEach(function(hit) {
                addMarker(hit._source.position);
              });
            }
          });
        }
      }
    });
  });

  Tracker.autorun(function (computation) {
    var latLng = Geolocation.latLng();
    if (latLng == null) {
      var err = Geolocation.error();
      if (err) {
        console.error(err.message);
        computation.stop();
      }
    } else if (latLng) {
      Session.set('userLoc', latLng);
      GoogleMaps.maps.tweetMap.instance.panTo(latLng);
      computation.stop();
    }
  });

  Template.body.helpers({
    mapOptions: function() {
      if (GoogleMaps.loaded()) {
        var center = {lat: 40.8075, lng: -73.9619};
        var loc = Session.get('userLoc');
        if (loc) {
          center = loc;
        }
        return {
          center: center,
          zoom: 3
        };
      }
    }
  });

  var markers = [];

  // Adds a marker to the map and push to the array.
  function addMarker(tweetCoor) {
    var map = GoogleMaps.maps.tweetMap.instance;
    var location = {lat: tweetCoor[1], lng: tweetCoor[0]};
    var marker = new google.maps.Marker({
      position: location,
      animation: google.maps.Animation.DROP,
      map: map
    });
    marker.addListener('click', function() {
      if (marker.getAnimation() !== null) {
        marker.setAnimation(null);
      } else {
        marker.setAnimation(google.maps.Animation.BOUNCE);
      }
      map.setZoom(8);
      map.panTo(marker.getPosition());
    });
    markers.push(marker);
  }

  // Removes the markers from the map, but keeps them in the array.
  function clearMarkers() {
    for (var i = 0; i < markers.length; i++) {
      markers[i].setMap(null);
    }
  }

  // Deletes all markers in the array by removing references to them.
  function deleteMarkers() {
    clearMarkers();
    markers = [];
  }

  function getDistance() {
    var distance = $('#distance').val();
    if (distance) {
      if($.isNumeric(distance) && Math.floor(distance) == distance) {
        return distance+'km';
      }
    }
    return '1000km';
  }

  Template.body.onCreated(function() {
    GoogleMaps.ready('tweetMap', function(map) {
      var map = GoogleMaps.maps.tweetMap.instance;
      map.addListener('click', function(e) {
        Meteor.call('searchFrom', e.latLng.toJSON(), getDistance(), function(err, result) {
          if (err) {
            console.error(err.message);
          } else {
            deleteMarkers();
            Tweets.find({_id: {$in: result}}).forEach(function(hit) {
              addMarker(hit._source.position);
            });
          }
        });
      });
      Meteor.call('searchAll', function(err, result) {
        if (err) {
          console.error(err.message);
        } else {
          deleteMarkers();
          Tweets.find({}).forEach(function(hit) {
            addMarker(hit._source.position);
          });
        }
      });
    });
  });
}

if (Meteor.isServer) {
  Meteor.publish('tweets', function() {
    return Tweets.find({});
  });
  Meteor.startup(function() {
    var elasticsearch = Meteor.npmRequire('elasticsearch');
    var client = new elasticsearch.Client({
      host: 'elasticsearch_host',
      log: 'trace'
    });
    Meteor.methods({
      'searchAll': function() {
        var response = Async.runSync(function(done) {
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
          }, function (error, response) {
            done(error, response)
          });
        });
        if (response.error) {
          console.error(response.error.message);
        } else {
          var tweets = response.result.hits.hits;
          tweets.forEach(function(tweet) {
            if (!Tweets.findOne(tweet._id)) {
              Tweets.insert(tweet);
            }
          });
        }
      },
      'searchFor': function(query) {
        var response = Async.runSync(function(done) {
          client.search({
            index: 'candidatetweets',
            type: 'tweet',
            size: 100,
            sort: 'date:desc',
            q: query
          }, function (error, response) {
            done(error, response);
          });
        });
        if (response.error) {
          console.error(response.error.message);
        } else {
          var tweetIds = [];
          var tweets = response.result.hits.hits;
          tweets.forEach(function(tweet) {
            tweetIds.push(tweet._id);
            if (!Tweets.findOne(tweet._id)) {
              Tweets.insert(tweet);
            }
          });
          return tweetIds;
        }
      },
      'searchFrom': function(latLng, distance) {
        var response = Async.runSync(function(done) {
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
                      position: [latLng.lng, latLng.lat]
                    }
                  }
                }
              }
            }
          }, function (error, response) {
            done(error, response);
          });
        });
        if (response.error) {
          console.error(response.error.message);
        } else {
          var tweetIds = [];
          var tweets = response.result.hits.hits;
          tweets.forEach(function(tweet) {
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
}
