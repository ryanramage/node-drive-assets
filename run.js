var readDirFiles = require('read-dir-files');
var hash_file = require('hash_file');
var async = require('async');
var fs = require('fs');
var util = require('util');
var uuid = require('node-uuid');
var request = require('request');

var DRIVEIDFILENAME = '.driveid';

var folder = process.argv[2];
var couch_url = process.argv[3];


var results = {
    provided_path: folder,
    process_path: __dirname,
    started : new Date().getTime(),
    files : []
};


// Work starts here.
locate_or_create_driveid(folder, function(err, driveid){
   results.driveid = driveid;
   findDriveAssets(folder, function(err, assets){
       if (couch_url) {
           save_to_couch(assets,couch_url, function(err){
               console.log('complete');
           });
       }
   })

});


function save_to_couch(assets, couch_url, callback){
    request.post({
          uri : couch_url
        , json: true
        , body : assets


    }, function(err, response, body){
        callback(null);
    });

}


function hash(filename, callback) {

    fs.stat(filename, function(err, stats){
        if (err) return callback(null);
        if (stats.isDirectory()) return callback(null);
        try {
            hash_file(filename, 'md5', function(err, hash) {
                if (err) return callback(null);
                var info = stats;
                var data = {
                    hash: hash,
                    full_filename : filename,
                    relative_filename: relative_filename(folder, filename),
                    size : info.size,
                    mtime : info.mtime.getTime()
                }

                results.files.push(data);
                callback(null);
            })
        } catch(e){
            return console.log('err hash: ' + filename);
        }

    });
}

function readUUID(filename, callback) {
    fs.readFile(filename, 'UTF-8', function(err,data){
      if(err) {}
      callback(null, data);
    });
}

function writeUUID(filename, callback) {
    var new_uuid = uuid.v1();
    fs.writeFile(filename, new_uuid, 'UTF-8', function(err){
        callback(null, new_uuid);
    })
}

function locate_or_create_driveid (folder, callback) {
    var filename = folder + '/' + DRIVEIDFILENAME;
    fs.stat(filename, function(err, stats){
        if (err) {
            return writeUUID(filename, callback);
        }
        if (stats.isFile()) {
            readUUID(filename, callback);
        } else {
            writeUUID(filename, callback);
        }
    });
}

function findDriveAssets(folder, callback) {
    readDirFiles.list(folder, {recursive: true, normalize: true }, function (err, filenames) {
      if (err) return console.dir(err);
      async.forEachLimit(filenames, 20, hash, function(err){
        if (err) return console.log(err);
        results.completed = new Date().getTime();
        callback(null, results);
      });
    });
}


function relative_filename(initialPath, full_filename) {
    return full_filename.substring(initialPath.length);
}