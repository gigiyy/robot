'use strict';

// native
var util = require('util');

// 3rd party
var log4js = require('log4js');
var async = require('async');

// local
var orchestratorHelper = require('./orchestratorHelper');
var csvHelper = require('./csvHelper');

var logger = log4js.getLogger();

/**
 * @param {number} unitId
 * @param {RobotDefinition} robotDefinition
 * @param {RobotEntry} robotEntry
 * @param {function(Error=)} callback
 */
function updateRobotName(unitId, robotDefinition, robotEntry, callback) {
    async.waterfall([
        function (next) {
            orchestratorHelper.setRobotName(
                unitId,
                robotDefinition,
                robotEntry.newName,
                next
            );
        },
        function (next) {
            orchestratorHelper.getRobotInfo(
                unitId,
                robotEntry,
                robotEntry.newName,
                next
            );
        },
        /**
         * @param {RobotDefinition} newRobotDefinition
         * @param next
         */
        function (newRobotDefinition, next) {
            if (newRobotDefinition.Id !== robotDefinition.Id) {
                next(new Error('Unexpected robot name mismatch: ' + robotDefinition.Id + ' / ' + newRobotDefinition.Id));
                return;
            }
            logger.info("Updated Robot name to %s for %s", robotEntry.newName, robotEntry.oldName);
            next();
        }
    ], callback);
}

function robotEntryHandlerFactory(dryRun, useUnit) {
    return function (robotEntry, callback) {
        /** @type {number} */
        var organizationUnitId;

        async.waterfall([
            function (next) {
                if (useUnit) {
                    orchestratorHelper.getOrganizationUnitByName(robotEntry.unit, next);
                } else {
                    next(undefined, 0);
                }
            },
            /**
             * @param {number} unitId
             * @param next
             */
            function (unitId, next) {
                organizationUnitId = unitId;
                orchestratorHelper.getRobotInfo(
                    unitId,
                    robotEntry,
                    robotEntry.oldName,
                    next
                );
            },
            /**
             * @param {RobotDefinition} robotDefinition
             * @param next
             */
            function (robotDefinition, next) {
                if (robotDefinition.Name === robotEntry.newName) {
                    logger.info("Robot name already up-to-date: " + robotEntry.newName);
                    next();
                    return;
                }
                if (dryRun) {
                    logger.info("Dry-run: skipping rename: " + robotEntry.newName);
                    next();
                    return;
                }
                updateRobotName(organizationUnitId, robotDefinition, robotEntry, next);
            }
        ], function (err) {
            if (err) {
                console.error(
                    "Failed handling robot %s\\\\%s\\%s %s",
                    robotEntry.unit, 
                    robotEntry.machine, 
                    robotEntry.userName, 
                    robotEntry.newName
                );
                logger.error('Failed handling robot: ' +
                    robotEntry.unit + '\\\\' +
                    robotEntry.machine + '\\' + robotEntry.userName +
                    ' (' + robotEntry.newName + ')');
            }
            callback(err);
        });
    };
}

/** @param {RobotUpdaterConfiguration} config */
module.exports.run = function (config) {
    /** @type {boolean} */
    var dryRun = true;
    var useUnit = true;

    log4js.configure(config.log);
    orchestratorHelper.setup(config.orchestrator);
    if (config.prod === true) { // be extra safe
        dryRun = false;
    }
    if (config.unitEnabled === false) {
        useUnit = false;
    }

    logger.info('Updater configuration: ' + util.inspect(config.orchestrator));

    async.waterfall([
        function (next) {
            var csv = config.csv;
            csvHelper.read(csv.file, csv.from, csv.count, next);
        },
        /**
         * @param {Array.<RobotEntry>} robotEntries
         * @param {function()} next
         */
        function (robotEntries, next) {
            async.eachSeries(robotEntries, robotEntryHandlerFactory(dryRun, useUnit), next);
        }
    ], function (err) {
        if (err) {
            logger.error(err.message);
        }
        logger.info('Done');
    });
};

/**
 * @typedef {Object} RobotUpdaterConfiguration
 * @property {OrchestratorHelperConfiguration} orchestrator
 * @property {Configuration} log
 * @property {{file: string, from: number, count: number|string}} csv
 * @property {boolean} prod
 */

 /**
 * @typedef {Object} RobotDefinition
 * @property {string} Id
 * @property {string} LicenseKey
 * @property {string} MachineName
 * @property {string} Username
 * @property {string} Type
 * @property {string} Name
 */
