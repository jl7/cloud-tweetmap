import { Meteor } from 'meteor/meteor';
import { Template } from 'meteor/templating';
import { Tracker } from 'meteor/tracker';
import { Session } from 'meteor/session';
import { Geolocation } from 'meteor/mdg:geolocation';
import { GoogleMaps } from 'meteor/dburles:google-maps';

import { Tweets } from '../imports/api/tweets.js';

import './main.html';

Meteor.subscribe('tweets');
Meteor.startup(() => {
  GoogleMaps.load({key: 'api_key'});
  $('select').selectize({
    dropdownParent: 'body',
    onItemAdd(value, $item) {
      if (value === 'all') {
        Meteor.call('searchAll', (err) => {
          if (err) {
            console.log(err.message);
          } else {
            deleteMarkers();
            Tweets.find({}, {sort: {'_source.date': -1}, limit: 100}).forEach((hit) => {
              addMarker(hit._source.text, hit._source.coordinates.coordinates, hit._source.sentiment);
            });
          }
        });
      } else {
        let qArr = value.split(' ');
        let query = qArr[0] + ' AND ' + qArr[1];
        Meteor.call('searchFor', query, (err, result) => {
          if (err) {
            console.log(err.message);
          } else {
            deleteMarkers();
            Tweets.find({_id: {$in: result}}).forEach((hit) => {
              addMarker(hit._source.text, hit._source.coordinates.coordinates, hit._source.sentiment);
            });
          }
        });
      }
    }
  });
});

Tracker.autorun((computation) => {
  let latLng = Geolocation.latLng();
  if (latLng == null) {
    let err = Geolocation.error();
    if (err) {
      console.log(err.message);
      computation.stop();
    }
  } else if (latLng) {
    Session.set('userLoc', latLng);
    GoogleMaps.maps.tweetMap.instance.panTo(latLng);
    computation.stop();
  }
});

Template.body.helpers({
  mapOptions() {
    if (GoogleMaps.loaded()) {
      let center = {lat: 40.8075, lng: -73.9619};
      let loc = Session.get('userLoc');
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
const iconBase = 'http://maps.google.com/mapfiles/ms/icons/';
const icons = {
  positive: {
    name: 'Positive',
    icon: iconBase + 'blue-dot.png'
  },
  negative: {
    name: 'Negative',
    icon: iconBase + 'red-dot.png'
  },
  neutral: {
    name: 'Neutral',
    icon: iconBase + 'purple-dot.png'
  }
};

// Adds a marker to the map and push to the array.
function addMarker(tweetText, tweetCoor, tweetSent) {
  let map = GoogleMaps.maps.tweetMap.instance;
  let location = {lat: tweetCoor[1], lng: tweetCoor[0]};
  let marker = new google.maps.Marker({
    position: location,
    icon: icons[tweetSent].icon,
    animation: google.maps.Animation.DROP,
    map: map
  });
  let infowindow = new google.maps.InfoWindow({
    content: tweetText,
    maxWidth: 180
  });
  marker.addListener('click', () => {
    infowindow.open(map, marker);
    map.setZoom(8);
    map.panTo(marker.getPosition());
  });
  markers.push(marker);
}

// Removes the markers from the map, but keeps them in the array.
function clearMarkers() {
  for (let i = 0; i < markers.length; i++) {
    markers[i].setMap(null);
  }
}

// Deletes all markers in the array by removing references to them.
function deleteMarkers() {
  clearMarkers();
  markers = [];
}

function getDistance() {
  let distance = $('#distance').val();
  if (distance) {
    if($.isNumeric(distance) && Math.floor(distance) == distance) {
      return distance+'km';
    }
  }
  return '1000km';
}

Template.body.onCreated(function bodyOnCreated() {
  GoogleMaps.ready('tweetMap', (map) => {
    let $legend = $('#legend');
    for (let key in icons) {
      let type = icons[key];
      let name = type.name;
      let icon = type.icon;
      let $div = $(document.createElement('div'));
      $div.html('<img src="' + icon + '"> ' + name);
      $legend.append($div);
    }
    map.instance.controls[google.maps.ControlPosition.RIGHT_BOTTOM].push(legend);
    map.instance.addListener('click', (e) => {
      Meteor.call('searchFrom', e.latLng.toJSON(), getDistance(), (err, result) => {
        if (err) {
          console.log(err.message);
        } else {
          deleteMarkers();
          Tweets.find({_id: {$in: result}}).forEach((hit) => {
            addMarker(hit._source.text, hit._source.coordinates.coordinates, hit._source.sentiment);
          });
        }
      });
    });
    Meteor.call('searchAll', (err) => {
      if (err) {
        console.log(err.message);
      } else {
        deleteMarkers();
        Tweets.find({}, {sort: {'_source.date': -1}, limit: 100}).forEach((hit) => {
          addMarker(hit._source.text, hit._source.coordinates.coordinates, hit._source.sentiment);
        });
      }
    });
  });
});
