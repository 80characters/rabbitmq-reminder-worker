var chalk = require("chalk");
var cluster = require("cluster");
var os = require("os");

if (cluster.isMaster) {
    console.log(chalk.red("[Cluster]"), "Start master process on PID: ", process.pid);
    for (var i = 0, coreCount = os.cpus().length; i < coreCount; i++) {
        var worker = cluster.fork();
    }

    cluster.on(
        "exit",
        function handleExit(worker, code, signal) {
            console.log(chalk.yellow("[Cluster]"), "Worker stopping...", worker.process.pid);
            console.log(chalk.yellow("[Cluster]"), "Stopped.", worker.exitedAfterDisconnect);

            if (!worker.exitedAfterDisconnect) {
                var worker = cluster.fork();
            }
        }
    );

} else {
    require("./worker");
    console.log(chalk.red("[Worker]"), "Worker running on PID: ", process.pid);
}
