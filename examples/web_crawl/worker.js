#!/usr/bin/env node

// example - web crawler worker
// simple, just start the web scrape worker

var worker = require('../../index').worker;
var link_scrape = require('../../index').builtin.tasks.get_hrefs;

// register a job handler for the scraping
worker.registerJobHandler('link_scrape', link_scrape);

// start the worker
var forerunnerLocation = process.env.FR_LOCATION || 'http://localhost:2718';
worker.start(forerunnerLocation);
