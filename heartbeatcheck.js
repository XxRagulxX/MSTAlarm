
(() => {
    if (window.teamsAlarmHeartbeat) {
        clearInterval(window.teamsAlarmHeartbeat);
    }

    window.teamsAlarmHeartbeat = setInterval(() => {
        const active = typeof window.teamsAlarm !== "undefined";

        if (active) {
            const status = window.teamsAlarm.status();

            console.log(
                `%c[Teams Alarm Heartbeat] ${new Date().toLocaleTimeString()} | Script ACTIVE | Monitoring: ${status.monitoring ? "ON" : "OFF"} | Alarm: ${status.alarmActive ? "RINGING" : "OFF"}`,
                "color: #4ade80; font-weight: bold;"
            );
        } else {
            console.error(
                `[Teams Alarm Heartbeat] ${new Date().toLocaleTimeString()} | SCRIPT NOT FOUND`
            );

            clearInterval(window.teamsAlarmHeartbeat);
            window.teamsAlarmHeartbeat = null;
        }
    }, 60000);

    console.log(
        "%cTeams Alarm heartbeat started — checking every 60 seconds.",
        "color: #60a5fa; font-weight: bold;"
    );
})();
