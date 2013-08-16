// builtin - download file(s)
// downloads a set of files to a destination directory

var http = require('http');
var fs = require('fs');
var path = require('path');
var _ = require('underscore');
var async = require('async');

module.exports = function(id, type, data, callback) {
  if (!_.isArray(data.origin)) {
    data.origin = [data.origin];
  }

  var destination = data.destination;

  var fetch = function(origin, cb) {
    var outPath = path.join(destination, path.basename(origin));
    var file = fs.createWriteStream(outPath);
    var request = http.get(origin, function(response) {
      response.pipe(file);
      response.on('end', function() {
        cb(null, outPath);
      });
    });
  };

  async.map(data.origin, fetch, function(err, locations) {
    callback(err, {locations: locations});
  });

};