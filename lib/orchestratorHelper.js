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
 * @param {string} user
 * @param {string} machine
 * @param {function(Error|undefined, RobotDefinition=)} callback
 */
module.exports.getRobotInfo = function (unitId, user, machine, callback) {
    var apiPath = '/odata/Robots';
    var apiData = {
        'OrganizationUnitId': unitId,
        '$count': true,
        '$filter': '(Username eq \'' + user + '\' and MachineName eq \'' + machine + '\')'
    };

    orchestrator.get(apiPath, apiData, function (err, data) {
        /** @type {RobotDefinition} */
        var robot;

        if (err) {
            callback(err);
            return;
        }
        if (data.value.length !== 1) {
            callback(new Error('Unexpected number of robots found: ' + data.value.length));
        }
        robot = data.value[0];
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

    var apiPath = '/odata/Robots(' + id + ')?OrganizationUnitId=' + unitId;
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
