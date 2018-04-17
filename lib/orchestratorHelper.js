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
        isSecure: config.safe,
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
        '$filter': '(DisplayName eq \'' + unitName + '\')',
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
 * @param {number} robotId 
 * @param {function(Error|undefined, RobotDefinition=)} callback
 */
module.exports.getRobotDetailInfo = function(unitId, robotId, callback) {
    var apiPath = '/odata/Robots(' + robotId + ')';
    var apiData = { };
    if (unitId !== 0) {
        apiData.OrganizationUnitId = unitId;
    }

    orchestrator.get(apiPath, apiData, function (err, data) {
        if (err) {
            callback(err);
            return;
        }
        callback(undefined, data);
    });
};

/**
 * @param {number} unitId
 * @param {RobotEntry} robotEntry
 * @param {string} userName
 * @param {string} machineName
 * @param {function(Error|undefined, RobotDefinition=)} callback
 */
module.exports.getRobotInfo = function (unitId, userName, machineName, callback) {
    var apiPath = '/odata/Sessions';
    var apiData = {
        '$expand': 'Robot',
        '$count': true,
        '$filter': '(Robot/Username eq \'' + userName + '\' and Robot/MachineName eq \'' + machineName + '\')'
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
            callback(new Error('Unexpected number of robots found: ' + data.value.length));
            return;
        }
        robot = data.value[0].Robot;
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
    var password = robotData.Password;
    var envs = robotData.RobotEnvironments;
    var type = robotData.Type;
    var desc = robotData.Description;

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
        'Name': newName,
        'Username': user,
        'Password': password,
        'RobotEnvironments': envs,
        'Type': type,
        'Description': desc
    };

    orchestrator.put(apiPath, apiData, function (err, _data) {
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
 * @property {string} Name
 * @property {string} Username
 * @property {string} Password
 * @property {string} RobotEnvironments
 * @property {string} Type
 * @property {string} Description
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