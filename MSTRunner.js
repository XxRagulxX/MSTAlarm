(() => {
    if (window.teamsAlarm) {
        console.log("%c[Teams Alarm] Already running.", "color:orange;font-weight:bold");
        console.log("Use teamsAlarm.status() to check status.");
        return;
    }

    const CONFIG = {

        frequency: 880,
        beepDuration: 700,
        beepPause: 300,
        scanInterval: 1000,
        maxKnownTexts: 500,
        debug: true
    };

    let monitoring = true;
    let alarmActive = false;
    let audioContext = null;
    let alarmTimer = null;
    let scanTimer = null;
    let observer = null;

    const knownElements = new WeakSet();
    const knownTexts = new Set();

    function getAudioContext() {

        if (!audioContext) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) {throw new Error("Web Audio API is not supported by this browser.");}
            audioContext = new AudioContextClass();
        }
        if (audioContext.state === "suspended") {audioContext.resume().catch(error => {console.error("[Teams Alarm] Unable to resume AudioContext:", error);});}
        return audioContext;
    }

    function beep() {

        if (!alarmActive)
            return;

        try {

            const ctx = getAudioContext();
            const oscillator = ctx.createOscillator();
            const gain = ctx.createGain();

            oscillator.type = "square";
            oscillator.frequency.value = CONFIG.frequency;

            const startTime = ctx.currentTime;
            const endTime = startTime + CONFIG.beepDuration / 1000;

            gain.gain.setValueAtTime(0.0001, startTime);
            gain.gain.exponentialRampToValueAtTime(0.25, startTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

            oscillator.connect(gain);
            gain.connect(ctx.destination);
            oscillator.start(startTime);
            oscillator.stop(endTime + 0.05);


        } catch (error) {console.error("[Teams Alarm] Audio error:", error);}
    }

    function startAlarm(reason = "Notification detected") {

        if (!monitoring)
            return;

        if (alarmActive)
            return;

        alarmActive = true;
        console.warn(`%c🚨 TEAMS ALARM: ${reason}`, "color:red;font-size:16px;font-weight:bold");
        beep();

        alarmTimer = setInterval(() => {if (!alarmActive) {clearInterval(alarmTimer);alarmTimer = null;return;}beep();}, CONFIG.beepDuration + CONFIG.beepPause);
    }

    function stopAlarm() {

        alarmActive = false;
        if (alarmTimer) {clearInterval(alarmTimer); alarmTimer = null;}
        console.log("%c🔕 Teams alarm stopped.", "color:#4ade80;font-weight:bold");
    }

    function testAlarm() {

        console.log("%c🔊 Testing Teams alarm...", "color:#60a5fa;font-weight:bold");

        try {
            getAudioContext();

        } catch (error) {
            console.error(error);
            return;
        }

        const previousState = alarmActive;
        if (alarmActive) {stopAlarm();}
        alarmActive = true;
        beep();

        const testTimer = setInterval(() => {if (!alarmActive) {clearInterval(testTimer); return;}beep();}, CONFIG.beepDuration + CONFIG.beepPause);

        setTimeout(() => {clearInterval(testTimer);

            if (alarmActive) {alarmActive = false;console.log("%c🔊 Alarm test finished.", "color:#60a5fa;font-weight:bold");}}, 3000);
    }

    function looksLikeNotification(element) {

        if (!element)
            return false;

        if (element.nodeType !== Node.ELEMENT_NODE)
            return false;

        const text = (element.innerText || "").trim();
        const ariaLabel = element.getAttribute("aria-label") || "";
        const title = element.getAttribute("title") || "";
        const role = element.getAttribute("role") || "";
        const combined = `${text} ${ariaLabel} ${title} ${role}`.toLowerCase();

        if (!combined)
            return false;

        const keywords = ["unread","new message","new messages","message notification","notification","mentions","mentioned you","activity"];
        return keywords.some(keyword => combined.includes(keyword));
    }

    function rememberText(text) {

        if (!text)
            return;

        knownTexts.add(text);
        if (knownTexts.size > CONFIG.maxKnownTexts) {const first = knownTexts.values().next().value;knownTexts.delete(first);}
    }

    function inspectElement(element) {

        if (!monitoring)
            return;

        if (!element)
            return;

        if (element.nodeType !== Node.ELEMENT_NODE)
            return;

        if (knownElements.has(element))
            return;

        if (!looksLikeNotification(element))
            return;

        knownElements.add(element);

        const text = (element.innerText || "").trim();

        if (!text)
            return;

        if (knownTexts.has(text))
            return;

        rememberText(text);
        if (CONFIG.debug) {console.log("[Teams Alarm] Possible notification:", text);}
        startAlarm("Possible new Teams notification");
    }


    function inspectNode(node) {

        if (!monitoring)
            return;

        if (!node || node.nodeType !== Node.ELEMENT_NODE)
            return;

        inspectElement(node);

        if (!node.querySelectorAll)
            return;

        const children = node.querySelectorAll("*");

        for (const element of children) {inspectElement(element);}
    }

    observer = new MutationObserver(mutations => {

                if (!monitoring)
                    return;

                for (const mutation of mutations) {

                    if (mutation.type === "childList") {

                        for (const node of mutation.addedNodes) {inspectNode(node);}
                    }

                    else if (mutation.type === "attributes") {

                        inspectElement(mutation.target);
                    }
                }
            }
        );


    observer.observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ["aria-label", "title", "class"]});

    scanTimer = setInterval(() => {

            if (!monitoring)
                return;

            const candidates = document.querySelectorAll(["[aria-label]", "[title]", '[role="status"]', '[role="alert"]'].join(","));
            for (const element of candidates) {inspectElement(element);}

        }, CONFIG.scanInterval);

    function enable() {monitoring = true; console.log("%c▶ Teams monitoring ENABLED", "color:#4ade80;font-weight:bold");}
    function disable() {monitoring = false; stopAlarm(); console.log("%c⏸ Teams monitoring DISABLED", "color:#facc15;font-weight:bold");}
    function status() {
        console.log("%c========== Teams Alarm Status ==========", "font-weight:bold");
        console.log("Monitoring:", monitoring ? "🟢 ENABLED" : "🔴 DISABLED");
        console.log("Alarm:", alarmActive ? "🚨 ACTIVE" : "🔕 OFF");
        console.log("Known notification texts:", knownTexts.size);
        console.log("Audio:", audioContext ? audioContext.state : "Not initialized");
        console.log("========================================");
        return {monitoring, alarmActive, knownNotifications: knownTexts.size, audioState: audioContext ? audioContext.state : "not initialized"};
    }
    function destroy() {

        stopAlarm();

        if (observer) {observer.disconnect(); observer = null;}

        if (scanTimer) {clearInterval(scanTimer);

            scanTimer = null;
        }

        if (audioContext) {

            try {audioContext.close();} catch (error) {console.warn("[Teams Alarm] AudioContext close error:", error);}
            audioContext = null;
        }
        delete window.teamsAlarm;
        console.log("%c🛑 Teams Message Alarm completely terminated.", "color:red;font-weight:bold");
    }

    window.teamsAlarm = {test: testAlarm, stop: stopAlarm, enable: enable, disable: disable, status: status, destroy: destroy};
    console.log("%c🔔 Teams Message Alarm started", "color:#4ade80;font-size:16px;font-weight:bold");
    console.log("%cAvailable commands:", "font-weight:bold");
    console.log("teamsAlarm.test()    → Test alarm");
    console.log("teamsAlarm.stop()    → Stop alarm");
    console.log("teamsAlarm.disable() → Disable monitoring");
    console.log("teamsAlarm.enable()  → Enable monitoring");
    console.log("teamsAlarm.status()  → Show status");
    console.log("teamsAlarm.destroy() → Completely stop script");
    console.log("%cMonitoring Teams for notifications...", "color:#60a5fa");

})();