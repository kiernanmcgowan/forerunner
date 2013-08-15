// builtin - download file
// downloads a file to the local worker dir

var http = require('http');
var fs = require('fs');
var path = require('path');


module.exports = function(id, type, data, callback) {
  var outPath = path.join(data.destination, id);
  var file = fs.createWriteStream(outPath);
  var request = http.get(data.origin, function(response) {
    response.pipe(file);
    response.on('end', function() {
      console.log('file downloaded');
      callback(null, {location: outPath});
    });
  });
};