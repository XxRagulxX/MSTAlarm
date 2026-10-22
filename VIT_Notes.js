(async function () {
  const ask = (label, defaultValue = "") => {
    const value = prompt(label, defaultValue);
    if (value === null) throw new Error("Input cancelled by user.");
    return value.trim();
  };

  async function copyText(text) {
    if (typeof copy === "function") {
      try { copy(text); return true; } catch (_) {}
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;opacity:0;top:0;left:0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch (_) {}
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {}
    return false;
  }

  try {
    // ── Step 1: Choose VIT type ───────────────────────────────────────────
    const vitChoice = ask(
      "Select VIT type:\n\n1. Penalty Box\n2. Break Glass VIT",
      "1"
    );

    if (vitChoice !== "1" && vitChoice !== "2") {
      throw new Error("Invalid selection. Enter 1 for Penalty Box or 2 for Break Glass VIT.");
    }

    const isPenaltyBox  = vitChoice === "1";
    const isBreakGlass  = vitChoice === "2";

    // ── Step 2: Common inputs from localStorage / prompt ─────────────────
    let appSvcId = (localStorage.getItem("APPServiceId") || "").trim();
    if (!appSvcId) {
      appSvcId = ask(
        "APPServiceId not found in local storage. Enter AppSVC_ID:",
        "APPSVC1J3100"
      );
    }

    let sctask = (localStorage.getItem("SCTASK") || "").trim();
    if (!sctask) {
      sctask = ask(
        "SCTASK not found in local storage. Enter SCTASK number:",
        "SCTASK4B7G690"
      );
    }

    let glapiLevel = (localStorage.getItem("GLAPI_Level") || "").trim();
    if (!glapiLevel) {
      glapiLevel = ask("GLAPI_LEVEL not found in local storage. Enter GLAPI Level:", "3");
      localStorage.setItem("GLAPI_Level", glapiLevel);
    }

    const cve                 = ask("Enter CVE ID:", "CVE-2026-93690");
    const vitSeverityReported = ask("Enter VIT Severity Reported By Tool:", "High");
    const securityProfile     = ask("Enter Security Profile Tier:", "SP1");
    const vitSeverityAfter    = ask("Enter VIT Severity After Risk Realignment:", "High");

    // ── Step 3: Build template ────────────────────────────────────────────
    let finalOutput = "";

    if (isPenaltyBox) {
      const repositoryName = ask("Enter Repository Name:", "dha-maven-virtual");
      const penaltyName    = ask("Enter Penalty Name:", "penalty-APPSVC115088-maven-local");
      const packageFile    = ask("Enter Package (file name):", "bcprov-jdk18on-1.81.jar");

      const comment1 = `This VIT was created for SCTASK ${sctask}.

Resolution notes = Unblocked the Components
Repository Name: ${repositoryName}
Penalty: ${penaltyName}
Package: ${packageFile}`;

      const comment2 = `$$$
AppSVC_ID:${appSvcId};
GLAPI_Level:${glapiLevel};
CVE Number/CWE:${cve};
VIT severity reported by the tool: ${vitSeverityReported};

Risk Realignment Parameters:
Security Profile Tier: ${securityProfile}
VIT severity after risk realignment: ${vitSeverityAfter};
$$$`;

      finalOutput = `${comment1}\n\n${comment2}`;

      console.log("========== VIT - Comment - 1 ==========");
      console.log(comment1);
      console.log("========== VIT - Comment - 2 ==========");
      console.log(comment2);
    }

    if (isBreakGlass) {
      const packageName = ask("Enter package name:", "url-js");
      const version     = ask("Enter package version:", "4.4.1");

      const breakGlassTemplate = `Summary: ${sctask} Scanning Bypass
Defect: Scanning Bypass
TR: Scanning Bypass
CO: Scanning Bypass
Defect Description:
${cve}
${packageName}
@
${version}
(T)`;

      const riskRealignmentTemplate = `$$$
AppSVC_ID: ${appSvcId};
GLAPL_level: ${glapiLevel};
CVE_Number_CWE: ${cve};
VIT_Severity_Reported_By_Tool: ${vitSeverityReported};

Risk_Realignment_Parameters:
Security_Profile_Tier: ${securityProfile};
VIT_Severity_After_Risk_Realignment: ${vitSeverityAfter};
$$$`;

      finalOutput = `${breakGlassTemplate}\n\n${riskRealignmentTemplate}`;

      console.log("========== BREAK GLASS VIT TEMPLATE ==========");
      console.log(breakGlassTemplate);
      console.log("========== RISK REALIGNMENT TEMPLATE ==========");
      console.log(riskRealignmentTemplate);
    }

    const copied = await copyText(finalOutput);
    if (copied) {
      alert("VIT template generated and copied to clipboard. Check console as well.");
    } else {
      alert("VIT template generated. Clipboard copy failed, please copy from the console.");
    }

  } catch (err) {
    console.error(err.message);
    alert(err.message);
  }
})();
