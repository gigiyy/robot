'use strict';

// native
var fs = require('fs');

// 3rd party
var parse = require('csv-parse');

/**
 * @param {string} path
 * @param {number} from
 * @param {number|string} count
 * @param {function(Error|undefined, Array.<RobotEntry>=)} callback
 */
module.exports.read = function (path, from, count, callback) {
    /** @type {Array.<RobotEntry>} */
    var output = [];
    /** @type {Parser} */
    var parser;
    /** @type {RobotEntry} */
    var record;
    /** @type {ReadStream} */
    var file;
    /** @type {Object} */
    var options = {
        columns: ['unit', 'oldName', 'enabled', 'machine', 'userName', 'newName'],
        //add one to from and to, so that we can skip the fisrt line, which is the column name
        // csv-parse is #1 base instead #0 based, so we only need to add 1 to 'from' varible.
        // to is inclusive, so we don't need to added 1 to 'to' variable.
        //and we are not using it for proproty name because it's not well named already
        from: from + 1
    };
    if (count !== 'all') {
        options.to = from + count;
    }
    parser = parse(options);

    //console.debug(options);
    parser.on('readable', function () {
        var record;
        while(record = parser.read()) {
            output.push(record);
        }
    });

    parser.on('error', callback);

    parser.on('finish', function () {
        //console.log(util.inspect(output))
        callback(undefined, output);
    });

    file = fs.createReadStream(path, 'utf8');
    file.on('error', function (err) {
        console.error('Failed while reading csv file. ' + err.message);
        parser.end();
    });

    file.pipe(parser);
};

/**
 * @typedef {Object} RobotEntry
 * @property {string} unit
 * @property {string} oldName
 * @property {string} enabled
 * @property {string} machine
 * @property {string} userName
 * @property {string} newName
 */
