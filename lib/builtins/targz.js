// builtin - targz
// tars and gzs a directory

var path = require('path');
var tar = require('tar');
var zlib = require('zlib');
var fstream = require('fstream');
var _ = require('underscore');

module.exports = function(id, type, data, callback) {
  // dooiit
  var stream = fstream.Reader({ path: data.origin, type: 'Directory' })
  .pipe(tar.Pack({noProprietary: true})).pipe(zlib.createGzip());

  stream.pipe(fstream.Writer(data.destination));

  stream.on('end', function() {
    callback(null, true);
  });

};