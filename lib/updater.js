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
var csvLogger = log4js.getLogger("result");

/**
 * @param {RobotEntry} robotEntry 
 */
function getRobotString(robotEntry) {
    var str = util.format(
        "Robot entry: %s\\\\%s\\%s %s=>%s",
        robotEntry.unit,
        robotEntry.machine,
        robotEntry.userName,
        robotEntry.oldName,
        robotEntry.newName
    );
    return str;
}
function logResult(robotEntry, result) {
    var str = util.format(
        "%s,%s,%s,%s,%s,%s",
        robotEntry.unit,
        robotEntry.oldName,
        robotEntry.machine,
        robotEntry.userName,
        robotEntry.newName,
        result
    );
    csvLogger.info(str);
}
/**
 * @param {number} unitId
 * @param {RobotDefinition} robotDefinition
 * @param {RobotEntry} robotEntry
 * @param {function(Error=)} callback
 */
function updateRobotName(unitId, robotDefinition, robotEntry, callback) {
    async.waterfall([
        function (next) {
            logger.trace("Getting back the detailed information about the robot");
            orchestratorHelper.getRobotDetailInfo(unitId, robotDefinition.Id, next);
        },
        function (newRobotDefinition, next) {
            logger.trace("update the robot name.");
            orchestratorHelper.setRobotName(
                unitId,
                newRobotDefinition,
                robotEntry.newName,
                next
            );
        },
        function (next) {
            logger.trace("checking update result.");
            orchestratorHelper.getRobotInfo(
                unitId,
                robotEntry.userName,
                robotEntry.machine,
                next
            );
        },
        /**
         * @param {RobotDefinition} newRobotDefinition
         * @param next
         */
        function (newRobotDefinition, next) {
            if (newRobotDefinition.Name !== robotEntry.newName) {
                next(new Error('Unexpected robot name mismatch: ' + robotEntry.newName + ' / ' + newRobotDefinition.Name));
                logResult(robotEntry, "Failed update-mismatch");
                return;
            }
            logger.info("Updated Robot name to %s for %s", robotEntry.newName, robotEntry.oldName);
            logResult(robotEntry, "OK");
            next();
        }
    ], callback);
}

function robotEntryHandlerFactory(dryRun, useUnit) {
    return function (robotEntry, callback) {
        /** @type {number} */
        var organizationUnitId;
        logger.info("Processing %s", getRobotString(robotEntry));

        async.waterfall([
            function (next) {
                logger.trace("Getting Organization Unit ID.");
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
                logger.trace("Find robot definiation from orchestrator");
                organizationUnitId = unitId;
                orchestratorHelper.getRobotInfo(
                    unitId,
                    robotEntry.userName,
                    robotEntry.machine,
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
                    logResult(robotEntry, "Skipped-already updated");
                    next();
                    return;
                }
                if (dryRun) {
                    logger.info("Dry-run: skipping rename: " + robotEntry.newName);
                    logResult(robotEntry, "Skipped-dry run");
                    next();
                    return;
                }
                updateRobotName(organizationUnitId, robotDefinition, robotEntry, next);
            }
        ], function (err) {
            if (err) {
                console.error("Failed processing %s", getRobotString(robotEntry));
                logger.error('Failed handling robot.');
                logger.error(err.stack);
                logResult(robotEntry, "Failed-" + err.message);
            }
            // we'll continue process the next record instead of quick whole processes
            callback();
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

    logger.info("##############################################");
    logger.info("# Starting Orchestrator Robt name updator...");
    logger.info("##############################################");
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
            logger.error(err.stack);
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
