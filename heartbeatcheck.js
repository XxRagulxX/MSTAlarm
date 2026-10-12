
(() => {
    const LOG_KEY = "teamsAlarmHeartbeatLogs";
    const MAX_LOGS = 1000;

    function saveLog(message) {
        const logs = JSON.parse(localStorage.getItem(LOG_KEY) || "[]");

        logs.push({
            time: new Date().toLocaleString(),
            message
        });

        if (logs.length > MAX_LOGS) {
            logs.splice(0, logs.length - MAX_LOGS);
        }

        localStorage.setItem(LOG_KEY, JSON.stringify(logs));
        console.log(message);
    }

    if (window.teamsAlarmHeartbeat) {
        clearInterval(window.teamsAlarmHeartbeat);
    }

    saveLog("Heartbeat started.");

    window.teamsAlarmHeartbeat = setInterval(() => {
        if (typeof window.teamsAlarm === "undefined") {
            saveLog("SCRIPT NOT FOUND — alarm script is missing.");
            clearInterval(window.teamsAlarmHeartbeat);
            window.teamsAlarmHeartbeat = null;
            return;
        }

        const status = window.teamsAlarm.status();

        saveLog(
            `Script ACTIVE | Monitoring: ${status.monitoring ? "ON" : "OFF"} | Alarm: ${status.alarmActive ? "RINGING" : "OFF"}`
        );
    }, 60000);

    console.log("Heartbeat logs are being saved in localStorage.");
})();
