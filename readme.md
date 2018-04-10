# README

## how to run

In command concole, run below command to start the updator. Run `npm install` once to get all dependent packages if necessary.

```
node index.js
```

## configuration

### orchestrator
Update the server info as needed. the user should have Robt/view and Robot/update privileges and Unit/view privileges if organization unit is enabled in orchestrator server.
```
    "orchestrator": {
        "tenant": "default",
        "server": "192.168.225.20",
        "user": "namechanger",
        "password": "1q2w3e4r",
        "safe": false,
        "port": 80
```

### csv
csv config has 3 proprties.
* `file` property specify the target csv file name. 
* `from` specify the starting row in csv file, it is 0 based.
* `count` specify the number of records to be processed. set to `all` when all remaining records should be processed.
```
    "csv": {
        "file": "myupdate.csv",
        "from": 1,
        "count": 1
    },
```

### prod
Set to `false` for dry run only, robot name will not be updated.
```
    "prod": true,
```

### unitEnabled
If organization unit is enabled in Orchestrator, please set to `true` accordingly.
```
    "unitEnabled": true
```

### log
there is two log files generated.
* `update.lot` detailed execution logs.
* `update_result.csv` CSV formated update result file.