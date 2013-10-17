#!/usr/bin/env node

// example - forerunner web crawl

var forerunner = require('../../index').forerunner;
var redisQueue = require('forerunner-redis-queue');
var pgStore = require('forerunner-postgres-store');
var _ = require('underscore');
var derconf = require('derconf');

var config = derconf();

// set up the db
var dbOpts = {db: config.postgres};

var store = new pgStore(dbOpts, function(err) {

  var forerunnerOpts = {
    queue: (new redisQueue()),
    store: store
  };

  forerunner.start(forerunnerOpts);

  forerunner.onComplete('link_scrape', function(id, data) {
    console.log('link_scrape is done: ' + id);
    for (var i = 0; i < data.links.length; i++) {
      forerunner.assignJob('link_scrape', {url: data.links[i], timeout: 10000});
    }
  });

  forerunner.assignJob('link_scrape', {url: 'https://news.ycombinator.com/', timeout: 10000});
});

