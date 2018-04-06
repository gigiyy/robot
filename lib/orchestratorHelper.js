'use strict';

// 3rd party
var Orchestrator = require('uipath-orchestrator');

var orchestrator;

/** @param {OrchestratorHelperConfiguration} config */
module.exports.setup = function (config) {
    orchestrator = new Orchestrator({
        tenancyName: config.tenant,
        usernameOrEmailAddress: config.user,
        password: config.password,
        hostname: config.server,
        //isSecure: true,
        isSecure: config.safe,
        //port: 443,
        port: config.port,
        invalidCertificate: false,
        connectionPool: 5
    });
};

/** @type {Object.<number>} */
var unitIdCache = {};

/**
 * @param {string} unitName
 * @param {function(Error|undefined, id: number=)} callback
 */
module.exports.getOrganizationUnitByName = function (unitName, callback) {
    /** @type {string} */
    var apiPath;
    /** @type {Object} */
    var apiData;

    if (unitIdCache[unitName] !== undefined) {
        callback(undefined, unitIdCache[unitName]);
        return;
    }
    apiPath = '/odata/OrganizationUnits';
    apiData = {
        '$filter': '(contains(DisplayName,\'' + unitName + '\'))',
        '$orderby': 'DisplayName',
        '$top': 10
    };
    orchestrator.get(apiPath, apiData, function (err, data) {
        /** @type {{Id: number}} */
        var unit;

        if (err) {
            callback(err);
            return;
        }
        if (data.value.length !== 1) {
            callback(new Error('Unexpected number of organization units: ' + data.value.length));
            return;
        }
        unit = data.value[0];
        unitIdCache[unitName] = unit.Id;
        callback(undefined, unitIdCache[unitName]);
    });
};

/**
 * @param {number} unitId
 * @param {RobotEntry} robotEntry
 * @param {string} withName
 * @param {function(Error|undefined, RobotDefinition=)} callback
 */
module.exports.getRobotInfo = function (unitId, robotEntry, withName, callback) {
    // var user = robotEntry.userName;
    // var machine = robotEntry.machine;
    var apiPath = '/odata/Robots';
    var apiData = {
        // 'OrganizationUnitId': unitId,
        '$count': true,
        '$filter': '(Name eq \'' + withName + '\')'
        // '$filter': '(Username eq \'' + user + '\' and MachineName eq \'' + machine + '\')'
    };
    if (unitId !== 0) {
        apiData.OrganizationUnitId = unitId;
    }

    orchestrator.get(apiPath, apiData, function (err, data) {
        /** @type {RobotDefinition} */
        var robot;

        if (err) {
            callback(err);
            return;
        }
        if (data.value.length !== 1) {
            callback(new Error('Unexpected number of robots found: ' + data.value.length + ' with name ' + withName));
            return;
        }
        robot = data.value[0];
        if (robot.Username !== robotEntry.userName || robot.MachineName !== robotEntry.machine) {
            callback(new Error('Got a different robot than we expected: ' +
                robot.Username + '/' + robotEntry.userName + ', ' + robot.MachineName + '/' + robotEntry.machine));
            return;
        }
        callback(undefined, robot);
    });
};

/**
 * @param {number} unitId
 * @param {RobotDefinition} robotData
 * @param {string} newName
 * @param {function(Error=)} callback
 */
module.exports.setRobotName = function (unitId, robotData, newName, callback) {
    var id = robotData.Id;
    var key = robotData.LicenseKey;
    var machine = robotData.MachineName;
    var user = robotData.Username;
    var type = robotData.Type;

    var apiPath; 
    if (unitId !== 0) {
        apiPath = '/odata/Robots(' + id + ')?OrganizationUnitId=' + unitId;
    } else {
        apiPath = '/odata/Robots(' + id + ')';
    }
    var apiData = {
        'Id': id,
        'LicenseKey': key,
        'MachineName': machine,
        'Username': user,
        'Password': "",
        'Name': newName,
        'Type': type
    };

    orchestrator.put(apiPath, apiData, function (err, ignore) {
        if (err) {
            callback(err);
        } else {
            callback();
        }
    });
};

/**
 * @typedef {Object} RobotDefinition
 * @property {string} Id
 * @property {string} LicenseKey
 * @property {string} MachineName
 * @property {string} Username
 * @property {string} Type
 * @property {string} Name
 */

/**
 * @typedef {Object} OrchestratorHelperConfiguration
 * @property {string} tenant
 * @property {string} server
 * @property {string} user
 * @property {string} password
 * @property {boolean} safe
 * @property {number} port
 */

/**
 * @typedef {Object} RobotEntry
 * @property {string} unit
 * @property {string} oldName
 * @property {string} enabled
 * @property {string} machine
 * @property {string} userName
 * @property {string} newName
 */