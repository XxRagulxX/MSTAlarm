(function() {
  function clean(s) {
    return (s || "").replace(/\s+/g, " ").trim();
  }

  function isVisible(el) {
    return !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () => console.log("Copied to clipboard."),
        () => console.log("Could not copy automatically. Output is in console.")
      );
    } else if (typeof copy === "function") {
      copy(text);
    } else {
      console.log("Copy not supported. Please copy from console output.");
    }
  }

  function getInputValueFromContainer(container) {
    if (!container) return "";
    const fields = [...container.querySelectorAll('input:not([type="hidden"]), textarea, select')].filter(isVisible);
    for (const field of fields) {
      if (field.tagName === "SELECT") {
        const txt = clean(field.options[field.selectedIndex].text || field.value);
        if (txt) return txt;
      } else {
        const val = clean(field.value || field.getAttribute("value") || "");
        if (val) return val;
      }
    }
    return "";
  }

  function getFieldValueByLabel(labelText) {
    const nodes = [...document.querySelectorAll("label, div, span")];
    for (const el of nodes) {
      const txt = clean(el.innerText || el.textContent);
      if (!txt) continue;
      const normalized = txt.replace(/\*\s*$/, "");
      if (normalized.toLowerCase() !== labelText.toLowerCase()) continue;
      const row = el.closest("tr, .form-group, .row, .sc-form-group, .question") || el.parentElement;
      if (!row) continue;
      let val = getInputValueFromContainer(row);
      if (val) return val;
      let next = el.nextElementSibling;
      while (next) {
        val = getInputValueFromContainer(next);
        if (val) return val;
        const nextText = clean(next.innerText || next.textContent || "");
        if (nextText) return nextText;
        next = next.nextElementSibling;
      }
    }
    return "";
  }

  function findValueByExactLabel(labelText) {
    return getFieldValueByLabel(labelText);
  }

  function findByPattern(pattern) {
    const els = [...document.querySelectorAll("input, textarea, select, div, span")];
    for (const el of els) {
      let val = "";
      if (el.tagName === "SELECT") {
        val = clean(el.options[el.selectedIndex]?.text || el.value);
      } else {
        val = clean(el.value || el.innerText || el.textContent || "");
      }
      if (pattern.test(val)) return val;
    }
    return "";
  }

  function getSelectedOptionByLabel(labelText) {
    const nodes = [...document.querySelectorAll("label, div, span")];
    for (const el of nodes) {
      const txt = clean(el.innerText || el.textContent);
      if (!txt) continue;
      const normalized = txt.replace(/\*\s*$/, "");
      if (normalized.toLowerCase() !== labelText.toLowerCase()) continue;
      const row = el.closest("tr, .form-group, .row, .sc-form-group, .question") || el.parentElement;
      if (!row) continue;
      const selects = [...row.querySelectorAll("select")].filter(isVisible);
      for (const select of selects) {
        if (select.selectedIndex >= 0) {
          const option = select.options[select.selectedIndex];
          return {
            text: clean(option?.text || ""),
            value: clean(option?.value || "")
          };
        }
      }
      const inputs = [...row.querySelectorAll('input:not([type="hidden"]), textarea')].filter(isVisible);
      for (const input of inputs) {
        const val = clean(input.value || input.getAttribute("value") || "");
        if (val) {
          return {
            text: val,
            value: val
          };
        }
      }
    }
    return {
      text: "",
      value: ""
    };
  }

  function getAppSvc() {
    const fields = [...document.querySelectorAll("input, textarea, select")];
    for (const el of fields) {
      const val = clean(el.value);
      if (/^APPSVC/i.test(val)) return val;
    }
    const pageText = clean(document.body.innerText);
    const m = pageText.match(/\bAPPSVC\d+\b/);
    return m ? m[0] : "APPSVC_NOT_FOUND";
  }

  function isBreakGlassSelected() {
    const serviceStream = getSelectedOptionByLabel("Service Stream");
    const typeOfRequest = getSelectedOptionByLabel("Type of Request");
    const values = [
      serviceStream.value.toLowerCase(), serviceStream.text.toLowerCase(),
      typeOfRequest.value.toLowerCase(), typeOfRequest.text.toLowerCase()
    ];
    return values.some(v =>
      v === "break_glass" || v === "break glass" ||
      v.includes("break glass") || v.includes("break_glass")
    );
  }

  function isPenaltyBoxSelected() {
    const serviceStream = getSelectedOptionByLabel("Service Stream");
    const typeOfRequest = getSelectedOptionByLabel("Type of Request");
    const values = [
      serviceStream.value.toLowerCase(), serviceStream.text.toLowerCase(),
      typeOfRequest.value.toLowerCase(), typeOfRequest.text.toLowerCase()
    ];
    return values.some(v =>
      v === "penalty_box" || v === "penalty box" ||
      v.includes("penalty box") || v.includes("penalty_box")
    );
  }

  function getTaskSubCategory() {
    const serviceStream = getSelectedOptionByLabel("Service Stream");
    const typeOfRequest = getSelectedOptionByLabel("Type of Request");
    const combined = [serviceStream.text, typeOfRequest.text, typeOfRequest.value, serviceStream.value]
      .map(clean).join(" ").toUpperCase();
    if (combined.includes("DAST")) return "DAST";
    if (combined.includes("SAST")) return "SAST";
    if (combined.includes("SCA")) return "SCA";
    return "NOT_FOUND";
  }

  function getTool(taskSubCategory) {
    const map = {
      DAST: "AppScan",
      SAST: "Checkmarx",
      SCA: "Checkmarx"
    };
    return map[taskSubCategory] || "NOT_FOUND";
  }

  function getRedNoteToolLabel(taskSubCategory) {
    if (taskSubCategory === "DAST") return "Appscan";
    if (taskSubCategory === "SAST") return "Checkmarx";
    return "";
  }

  function getVulnerabilityBreakdown(taskSubCategory) {
    if (taskSubCategory === "SCA") {
      return "Using Components with known vulnerabilities | Severity | 0 FP | 0 Confirmed;";
    }
    return "Vulnerability name | Severity | 0 FP | 0 Confirmed;";
  }

  function getRepoType(virtualRepo) {
    const v = (virtualRepo || "").toLowerCase();
    if (v.includes("npm")) return "npm";
    if (v.includes("maven")) return "maven";
    if (v.includes("pypi") || v.includes("python") || v.includes("-py-") || v.includes("_py_") || /\bpy\b/.test(v)) {
      return "pypi";
    }
    return "name";
  }

  function buildRedNote(requestedFor, taskSubCategory) {
    const toolLabel = getRedNoteToolLabel(taskSubCategory);
    if (!toolLabel) return "";
    const userName = requestedFor || "User";
    return `Hi ${userName}

False Positive Analysis has been completed.

${toolLabel}: URL
Issues: NA
Severity: NA
Count: 0

Comment:

Recommendation: `;
  }

  function getGLAPILevel() {
    const input = prompt("Please enter GLAPI_Level:", "");
    return clean(input || "");
  }

  // ── Main body ─────────────────────────────────────────────────────────────

  const pageText = clean(document.body.innerText || "");
  const appsvc = getAppSvc();
  const breakGlassSelected = isBreakGlassSelected();
  const penaltyBoxSelected = isPenaltyBoxSelected();
  const taskSubCategory = getTaskSubCategory();
  const impactedTool = getTool(taskSubCategory);
  const vulnerabilityBreakdown = getVulnerabilityBreakdown(taskSubCategory);

  const applicationServiceName = findValueByExactLabel("Application Service Name") || "NOT_FOUND";
  const applicationServiceID =
    findByPattern(/^APPSVC\d+\b/i) ||
    findValueByExactLabel("Application Service ID") ||
    findByPattern(/^APPSVC/i) ||
    "NOT_FOUND";

  const currentAppServiceID =
    appsvc && appsvc !== "APPSVC_NOT_FOUND"
      ? appsvc
      : applicationServiceID && applicationServiceID !== "NOT_FOUND"
        ? applicationServiceID
        : "NOT_FOUND";

  if (currentAppServiceID && currentAppServiceID !== "NOT_FOUND") {
    localStorage.setItem("ApplicationServiceID", currentAppServiceID);
    console.log("Updated ApplicationServiceID in localStorage:", currentAppServiceID);
    const portalUrl =
      "https://e3-appsvc-portal-ui-prod-eastus2.az3-cfes-eastus2-prd-asev3.appserviceenvironment.net/?appsvc=" +
      encodeURIComponent(currentAppServiceID);
    window.open(portalUrl, "_blank");
  } else {
    localStorage.removeItem("ApplicationServiceID");
    console.log("No valid APPSVC found. Removed old ApplicationServiceID from localStorage.");
  }

  let glapiLevel = getGLAPILevel() || "";
  if (glapiLevel && glapiLevel !== "NOT_PROVIDED") {
    localStorage.setItem("GLAPI_LEVEL", glapiLevel);
    console.log("Updated GLAPI_LEVEL in localStorage:", glapiLevel);
  } else {
    localStorage.removeItem("GLAPI_LEVEL");
    console.log("No valid GLAPI_LEVEL provided. Removed old GLAPI_LEVEL from localStorage.");
  }

  const assignmentGroup =
    findValueByExactLabel("Assignment Group Name (in Service Now)") ||
    findValueByExactLabel("Assignment group") ||
    "NOT_FOUND";

  const number =
    findValueByExactLabel("Number") ||
    findByPattern(/^SCTASK\d+$/i) ||
    (pageText.match(/\bSCTASK\d+\b/) || [])[0] ||
    "NOT_FOUND";

  if (number && number !== "NOT_FOUND") {
    localStorage.setItem("SCTASK", number);
    console.log("Updated SCTASK in localStorage:", number);
  } else {
    localStorage.removeItem("SCTASK");
    console.log("No valid SCTASK found. Removed old SCTASK from localStorage.");
  }

  const requestItem =
    findValueByExactLabel("Request item") ||
    findByPattern(/^RITM\d+$/i) ||
    (pageText.match(/\bRITM\d+\b/) || [])[0] ||
    "NOT_FOUND";

  const virtualRepo = getFieldValueByLabel("Virtual Repository") || "VIRTUAL_REPOSITORY_NOT_FOUND";
  const repoType = getRepoType(virtualRepo);
  const packageName =
    findValueByExactLabel("Description of Request") ||
    findValueByExactLabel("Artifact Name(s)") ||
    "PACKAGE_NOT_FOUND";

  const penalty = appsvc !== "APPSVC_NOT_FOUND"
    ? `penalty-${appsvc}-${repoType}-local`
    : "penalty-APPSVC-NAME-local";

  const requestedFor = findValueByExactLabel("Requested for") || "User";

  let output = "";

  if (penaltyBoxSelected) {
    output = `This VIT was created for SCTASK ${number}.

Resolution notes = Unblocked the Components
Repository Name: ${virtualRepo}
Penalty: ${penalty}
Package: ${packageName}`;

  } else if (breakGlassSelected) {
    output = `$$$
AppSVC ID: ${appsvc};
Task_Sub_Category: Scanning_Bypass;
Impacted_Scan: ${taskSubCategory};
GLAPI_Level: ${glapiLevel};
Branch: main;
Number_of_VIT_Created: 1;
Severity_of_the_VITs: 1 High;
$$$`;

  } else {
    output = `$$$
AppSVC ID: ${appsvc};
Task_Sub_Category: ${taskSubCategory};
Impacted_Tool: ${impactedTool};
Manual_Scan_Performed: No;
GLAPI_Level: ${glapiLevel};
Remediation_Guidance_Provided: No;
Triaging done: Yes;
Comments: NA;
Number Vulnerability Triaged: 0 FP | 0 Confirmed;
Vulnerability Breakdown:
${vulnerabilityBreakdown}
$$$`;
  }

  const redNote = !penaltyBoxSelected && !breakGlassSelected &&
    (taskSubCategory === "DAST" || taskSubCategory === "SAST")
    ? buildRedNote(requestedFor, taskSubCategory)
    : "";

  const detailsOutput = `Application Service Name: ${applicationServiceName}
Application Service ID: ${applicationServiceID}
Assignment Group Name: ${assignmentGroup}
Number: ${number}
Request Item: ${requestItem}
Requested for: ${requestedFor}
Break Glass Selected: ${breakGlassSelected ? "Yes" : "No"}
Penalty Box Selected: ${penaltyBoxSelected ? "Yes" : "No"}
Task Sub Category Detected: ${taskSubCategory}
GLAPI_Level: ${glapiLevel}`;

  console.log("=== YELLOW NOTE ===");
  console.log(output);
  if (redNote) {
    console.log("=== RED NOTE ===");
    console.log(redNote);
  }
  console.log("=== DETAILS OUTPUT ===");
  console.log(detailsOutput);
  copyText(output);
  console.log("Thanks for using King Script. Have a good day :)");
  if (redNote) {
    console.log("Red Note available above. Copy manually if needed.");
  }

})();
