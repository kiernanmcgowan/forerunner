#!/usr/bin/env node

// example - harbinger web crawl

var harbinger = require('../../index').harbinger;
var redisQueue = require('harbinger-redis-queue');
var pgStore = require('harbinger-postgres-store');
var _ = require('underscore');

// set up the db
var dbOpts = {
  db: {
    user: 'data',
    password: 'moardata',
    database: 'data'
  }
};

var store = new pgStore(dbOpts, function(err) {

  var harbingerOpts = {
    queue: (new redisQueue()),
    store: store
  };

  harbinger.start(harbingerOpts, function() {

   harbinger.postJob('link_scrape', function(id, data) {
     console.log('link_scrape is done: ' + id);
     for (var i = 0; i < data.length; i++) {
       harbinger.assignJob('link_scrape', {url: data[i]});
     }
   });

   harbinger.assignJob('link_scrape', {url: 'http:///news.ycombinator.com/news'});

 });

});

