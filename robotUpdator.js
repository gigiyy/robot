/**
 * Robot name updater for UiPath Orchestrator.
 * require(uipath-orchestrator, csv-parse, nconf)
 *   -to install dependencies
 *     npm install
 *
 *   -orchestrator config in file: orchestrator.json
 *   -target robot info etc configured through command line.
 *
 * Guixin Zhu 2018/03/26 v1.00
 */

'use strict';

var nconf = require('nconf').argv()
    .file({file: './orchestrator.json'});

var csvFile;
var logFile = 'update.log';
var from;
var count;
var dryRun = true;

var path = require('path');
if (process.argv.length === 2) {
    console.log('USAGE: node %s --file csvFile [--log logFile] [--from 1] [--count 1] [--prod].', path.basename(__filename));
    console.log('       csvFile: Robots information file');
    console.log('       logFile: update log file, default=update.log');
    console.log('       from: starting line number, default=1');
    console.log('       count: record counts to be processed, default=1, set to \'all\' to process all remaining records');
    console.log('       prod: acutally update in Orchestrator server or not, default=false(dry run only)');
    process.exit(0);
}

csvFile = nconf.get('file');
if (csvFile === undefined) {
    console.log('please specify the csv file for Robot name change tasks!');
    process.exit(-1);
}
logFile = nconf.get('log');
if (logFile === undefined) {
    logFile = 'update.log';
}
from = nconf.get('from');
if (from === undefined) {
    from = 1;
}
count = nconf.get('count');
if (count === undefined) {
    count = 1;
}
dryRun = nconf.get('prod');
if (dryRun === undefined) {
    dryRun = true;
} else {
    dryRun = !!dryRun;
}

console.log('we are processing %s from line %d for %s records.', csvFile, from, count);
if (dryRun) {
    console.log('  DRY RUNNING, no Robots will be actually changed!');
}

console.log('Below are the server info: \n  Tenant: %s \n  Server: %s \n  User: %s \n ',
        nconf.get('tenant'), nconf.get('server'), nconf.get('user'));

var Orchestrator = require('uipath-orchestrator');
var fs = require('fs');
var util = require('util');

var orchestrator = new Orchestrator({
    tenancyName: nconf.get('tenant'),
    usernameOrEmailAddress: nconf.get('user'),
    password: nconf.get('password'),
    hostname: nconf.get('server'),
    //isSecure: true,
    isSecure: nconf.get('safe'),
    //port: 443,
    port: nconf.get('port'),
    invalidCertificate: false,
    connectionPool: 5
});

var units = {};

function findUnitId(unitName, cb) {
    var unitId = units[unitName];
    if (unitId === undefined) {
        var apiPath = '/odata/OrganizationUnits';
        var apiData = {
            '$filter': '(contains(DisplayName,\'' + unitName + '\'))',
            '$orderby': 'DisplayName',
            '$top': 10
        };

        orchestrator.get(apiPath, apiData, function (err, data) {
            if (err) {
                console.error('Error: ' + err.message);
                console.error('Not able to find Unit from Orchestrator');
            } else {
                if (data.value.length !== 1) {
                    console.error('We are expecting to find only one Unit for name ' + unitName);
                } else {
                    var unit = data.value[0];
                    units[unitName] = unit.Id;
                    cb();
                }
            }
        });
    } else {
        cb();
    }
}

function logMessage(user, machine, newName, msg) {
    fs.appendFile(
        logFile,
        util.format('%s::%s::%s::%s::%s\n', new Date().toISOString(), user, machine, newName, msg),
        function (err) {
            if (err) {
                console.error('Error while try to log message: ' + err.message);
            }
        }
    );
}

function checkName(ignore, robot, newName) {
    if (robot.Name === newName) {
        logMessage(robot.Username, robot.MachineName, newName, 'OK-Robot name updated.');
    } else {
        logMessage(robot.Username, robot.MachineName, newName, 'ERROR-Robot name not changed. current: ' + robot.Name);
    }
}

var getRobotName;

function doUpdate(unit, robot, newName) {
    var id = robot.Id;
    var key = robot.LicenseKey;
    var machine = robot.MachineName;
    var user = robot.Username;
    var type = robot.Type;

    var apiPath = '/odata/Robots(' + id + ')?OrganizationUnitId=' + units[unit];
    var apiData = {
        'Id': id,
        'LicenseKey': key,
        'MachineName': machine,
        'Username': user,
        'Name': newName,
        'Type': type
    };

    orchestrator.put(apiPath, apiData, function (err, ignore) {
        if (err) {
            console.error('Error: ' + err);
            console.error('Robot name change failed for %s, %s', user, machine);
            logMessage(user, machine, newName, 'ERROR-Server failure!');
        } else {
            console.log('Changed Robot name for ' + id + ' to ' + newName);
            getRobotName(unit, user, machine, newName, checkName);
        }
    });
}

// nextProcess = (true|checkName|doUpdate)
getRobotName = function (unit, user, machine, newName, nextProcess) {
    var apiPath = '/odata/Robots';
    var apiData = {
        'OrganizationUnitId': units[unit],
        '$count': true,
        '$filter': '(Username eq \'' + user + '\' and MachineName eq \'' + machine + '\')'
    };

    orchestrator.get(apiPath, apiData, function (err, data) {
        if (err) {
            console.error(err.message);
            logMessage(user, machine, newName, 'ERROR-Orchestrator access failure.');
        } else {
            if (data.value.length !== 1) {
                console.error('we expect to found only 1 target robot for %s, %s', user, machine);
                logMessage(user, machine, newName, 'ERROR-more than one robot found');
            } else {
                var robot = data.value[0];
                if (nextProcess === checkName || nextProcess === doUpdate) {
                    nextProcess(unit, robot, newName);
                    return;
                }
                //we are dry running, so log a message only
                console.info('Update Robot name to %s for (%s, %s, %s)',
                        newName, robot.Username, robot.MachineName, robot.Name);
            }
        }
    });
};

var parse = require('csv-parse');

var output = [];
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
//console.debug(options);
var parser = parse(options);

var record;
parser.on('readable', function () {
    do {
        record = parser.read();
        output.push(record);
    } while (record);
});

parser.on('error', function (err) {
    console.error(err.message);
});

function findRobotUnitId(robot) {
    findUnitId(
        robot.unit,
        function () {
            var nextProcess;

            if (!dryRun) {
                nextProcess = doUpdate;
            }
            getRobotName(
                robot.unit,
                robot.userName,
                robot.machine,
                robot.newName,
                nextProcess
            );
        }
    );
}

parser.on('finish', function () {
    var i;
    //console.log(util.inspect(output))
    for (i = 0; i < output.length; i += 1) {
        findRobotUnitId(output[i]);
    }
});

/*
fs.readFile(csvFile, 'utf8', function (err, data) {
    if (err) {
        console.error(err.message);
    } else {
        //console.log(data);
        parser.write(data);
        parser.end();
    }
});
*/

var file = fs.createReadStream(csvFile, 'utf8');
file.on('error', function (err) {
    console.error('Failed while reading csv file. ' + err.message);
    parser.end();
});

file.pipe(parser);
