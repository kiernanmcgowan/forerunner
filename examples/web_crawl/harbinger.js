#!/usr/bin/env node

// example - harbinger web crawl

var harbinger = require('../../index').harbinger;

// basic set up
harbinger.start({}, function() {
  var createJob = function(url) {
    console.log('adfasdf');
    process.nextTick(function() {
      console.log('creating job');
      harbinger.assignJob('link_scrape', {url: url}, function(err, status) {

      });
    });
  };

  harbinger.preJob('link_scrape', function(id, data) {
    console.log('queued: ' + data.url);
  });

  harbinger.postJob('link_scrape', function(id, data) {
    console.log('link_scrape is done: ' + id);
    for (var i = 0; i < data.length; i++) {
      harbinger.assignJob('link_scrape', {url: data[i]}, function(err, status) {

      });
    }
  });

  console.log('derp');

  createJob('http://www.cnn.com/');

});
