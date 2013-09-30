// word_count.js
// tokenizes and word counts a file

var fs = require('fs');
var _ = require('underscore');

module.exports = function(id, data, callback) {
  var inputFiles = data.location;
  var encoding = data.encoding || 'utf8';
  var splitToken = data.token || ' ';

  fs.readFile(inputFiles, encoding, function(err, data) {
    if (err) {
      return callback(err);
    }

    var tokens = data.split(splitToken);
    var output = {};

    _.each(tokens, function(token) {
      if (!output[token]) {
        output[token] = 0;
      }
      output[token]++;
    });

    callback(null, {count: output});
  });
};