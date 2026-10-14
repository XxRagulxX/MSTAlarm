
(async () => {
  "use strict";

  // ServiceNow SCA / False Positive Analysis note generator.
  // Reads visible form values; never submits or edits the ticket.

  const VERSION = "1.0";
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];

  const clean = value =>
    String(value ?? "").replace(/\s+/g, " ").trim();

  const visible = el =>
    !!el && !!(el.offsetWidth || el.offsetHeight ||
      el.getClientRects().length);

  const readElement = el => {
    if (!el) return "";
    if (el.matches("select")) {
      return clean(el.selectedOptions?.[0]?.text || el.value);
    }
    return clean(el.value ?? el.innerText ?? el.textContent);
  };

  // Build a map from ServiceNow labels to their visible values.
  function readForm() {
    const data = {};

    $$("label").filter(visible).forEach(label => {
      const text = clean(label.innerText || label.textContent)
        .replace(/\s*[*?]\s*$/, "")
        .replace(/:$/, "");

      if (!text) return;

      let field = null;
      const forId = label.htmlFor || label.getAttribute("for");

      if (forId) {
        field = document.getElementById(forId);
      }

      if (!field) {
        const container = label.closest(
          ".form-group, .form-field, .question, .field, tr"
        );
        if (container) {
          field = $("input, textarea, select", container);
        }
      }

      if (field && visible(field)) {
        const value = readElement(field);
        if (value) data[text] = value;
      }
    });

    return data;
  }

  const form = readForm();

  function find(keys) {
    const entries = Object.entries(form);
    for (const key of keys) {
      const match = entries.find(([label, value]) =>
        new RegExp(key, "i").test(label) && value
      );
      if (match) return match[1];
    }
    return "";
  }

  function ask(label, initial = "", required = true) {
    while (true) {
      const value = prompt(
        `${label}${required ? " (required)" : " (optional)"}`,
        initial
      );

      if (value === null) throw new Error("Cancelled by user.");

      if (!required || clean(value)) return clean(value);

      alert(`${label} cannot be empty.`);
    }
  }

  function askYesNo(label, defaultYes = false) {
    return confirm(
      `${label}\n\nOK = Yes\nCancel = No\n\nDefault: ${
        defaultYes ? "Yes" : "No"
      }`
    );
  }

  function askCount(label, initial = "0", min = 0) {
    while (true) {
      const value = ask(label, initial);
      if (/^\d+$/.test(value) && Number(value) >= min) {
        return Number(value);
      }
      alert(`Enter a whole number greater than or equal to ${min}.`);
    }
  }

  function askSeverity(label) {
    const options = ["Critical", "High", "Medium", "Low", "Info"];
    while (true) {
      const value = ask(
        `${label}\nChoose: ${options.join(", ")}`,
        "Medium"
      );
      const match = options.find(
        option => option.toLowerCase() === value.toLowerCase()
      );
      if (match) return match;
      alert(`Choose one of: ${options.join(", ")}`);
    }
  }

  function askURL(label, initial = "") {
    while (true) {
      const value = ask(label, initial);
      try {
        const url = new URL(value);
        if (url.protocol === "https:" || url.protocol === "http:") {
          return url.href;
        }
      } catch (_) {}
      alert("Enter a valid HTTP(S) URL.");
    }
  }

  try {
    // 1. Detect request type.
    const requestNumber =
      find(["^number$", "task number"]) ||
      clean($('input[name="number"]')?.value);

    const ritm =
      find(["requested item", "request item"]) ||
      clean($('input[name*="request_item"]')?.value);

    const taskTypeFromForm =
      find(["type of request", "task sub-category", "request type"]);

    const pageText = clean(document.body.innerText);

    const detectedType = taskTypeFromForm ||
      (/false positive analysis/i.test(pageText)
        ? "False Positive Analysis"
        : /remediation support/i.test(pageText)
        ? "Remediation Support"
        : /decommission/i.test(pageText)
        ? "Decommission"
        : "");

    const requestType = ask(
      "Detected request type. Confirm or correct it:",
      detectedType || "SCA - False Positive Analysis"
    );

    const isFP = /false.?positive/i.test(requestType);
    const isSCA = /\bsca\b|software composition/i.test(
      requestType + " " + pageText
    );

    // 2. Collect page details.
    const task = requestNumber || ask("SCTASK number");
    const requestItem = ritm || ask("RITM number", "", false);

    const appName =
      find(["application service name", "application name"]) ||
      ask("Application Service Name");

    const appId =
      find(["application service id", "appsvc id"]) ||
      ask("Application Service ID");

    const serviceStream =
      find(["service stream"]) ||
      ask("Service Stream", "", false);

    const tool = ask(
      "Impacted tool",
      /checkmarx/i.test(pageText + " " + serviceStream)
        ? "Checkmarx"
        : "Checkmarx"
    );

    // 3. Cx1 and vulnerability/package breakdown.
    const cx1URL = askURL("Enter the Cx1 URL");

    const totalVulnerabilities = askCount(
      "Total number of vulnerabilities",
      "1",
      1
    );

    const groups = [];
    let enteredCount = 0;

    while (enteredCount < totalVulnerabilities) {
      const remaining = totalVulnerabilities - enteredCount;

      const packageName = ask(
        `Package name (${remaining} vulnerabilities remaining)`
      );

      const severity = askSeverity(
        `Severity for package "${packageName}"`
      );

      const count = askCount(
        `Vulnerability count for "${packageName}" (${severity})`,
        String(remaining),
        1
      );

      if (count > remaining) {
        alert(
          `Only ${remaining} vulnerabilities remain. ` +
          "Enter a count that does not exceed the remaining total."
        );
        continue;
      }

      groups.push({ packageName, severity, count });
      enteredCount += count;
    }

    const branch = ask(
      "Branch name",
      find(["branch name", "branch"]) || "master"
    );

    const comment = ask("Analysis comment / justification");

    const includeRecommendation = askYesNo(
      "Do you want to add a recommendation?",
      false
    );

    const recommendation = includeRecommendation
      ? ask("Enter recommendation")
      : "";

    // 4. GLAPI and triage totals.
    const glapiLevel = ask(
      "GLAPI Level (e.g. Medium, if applicable)",
      "Medium"
    );

    const fpCount = askCount("Number of False Positives (FP)", "0");
    const confirmedCount = askCount(
      "Number of Confirmed vulnerabilities",
      String(totalVulnerabilities)
    );

    if (fpCount + confirmedCount !== totalVulnerabilities) {
      const proceed = askYesNo(
        `Triage total mismatch:\n` +
        `Input vulnerabilities: ${totalVulnerabilities}\n` +
        `FP: ${fpCount}\nConfirmed: ${confirmedCount}\n\n` +
        "Continue anyway?",
        false
      );
      if (!proceed) throw new Error("Please rerun and correct the counts.");
    }

    const branchForNotes = branch;
    const severityOrder = ["Critical", "High", "Medium", "Low", "Info"];

    // Aggregate packages sharing a severity.
    const bySeverity = Object.fromEntries(
      severityOrder.map(severity => [severity, { fp: 0, confirmed: 0 }])
    );

    // Counts entered above describe the findings in each severity group.
    // Triage totals are separate and are not automatically assigned to
    // individual severities because that mapping was not provided.
    const severityBreakdown = groups.map(group => {
      const triage = bySeverity[group.severity];
      return {
        ...group,
        fp: triage.fp,
        confirmed: triage.confirmed
      };
    });

    // Ask for an explicit per-severity triage split if the total
    // spans multiple severities. This prevents inventing FP/confirmed data.
    const triageBySeverity = [];
    let splitTotal = 0;

    if (groups.length > 0) {
      for (const severity of severityOrder) {
        const severityTotal = groups
          .filter(g => g.severity === severity)
          .reduce((sum, g) => sum + g.count, 0);

        if (!severityTotal) continue;

        const fp = askCount(
          `${severity}: FP count (maximum ${severityTotal})`,
          "0"
        );

        const confirmed = askCount(
          `${severity}: Confirmed count (maximum ${
            severityTotal - fp
          })`,
          String(severityTotal - fp)
        );

        if (fp + confirmed !== severityTotal) {
          throw new Error(
            `${severity}: FP + Confirmed must equal ${severityTotal}. ` +
            "Rerun the script and correct the counts."
          );
        }

        triageBySeverity.push({ severity, fp, confirmed });
        splitTotal += fp + confirmed;
      }
    }

    if (splitTotal !== totalVulnerabilities) {
      throw new Error("Severity breakdown does not match total vulnerabilities.");
    }

    // 5. Construct Red notes: narrative analysis.
    const severitySummary = severityOrder
      .map(severity => {
        const count = groups
          .filter(g => g.severity === severity)
          .reduce((sum, g) => sum + g.count, 0);
        return count ? `${severity} (${count})` : null;
      })
      .filter(Boolean)
      .join(", ");

    const packageSummary = groups
      .map(g => `${g.packageName} | ${g.severity} | Count: ${g.count}`)
      .join("\n");

    const redNotes = [
      `${requestType} analysis has been completed.`,
      "",
      `Cx1 (${isSCA ? "SCA" : tool}): ${cx1URL}`,
      `Severity: ${severitySummary}`,
      `Total Vulnerabilities: ${totalVulnerabilities}`,
      `Branch: ${branchForNotes}`,
      "",
      "Package Breakdown:",
      packageSummary,
      "",
      `Comment: ${comment}`,
      ...(includeRecommendation
        ? ["", `Recommendation: ${recommendation}`]
        : [])
    ].join("\n");

    // 6. Construct Yellow notes: $$$ metadata block.
    const yellowNotes = [
      "$$$",
      `AppSVC ID: ${appId}`,
      `Task_Sub_Category: ${isSCA ? "SCA" : requestType};`,
      `Impacted_Tool: ${tool};`,
      "Manual_Scan_Performed: No;",
      `GLAPI_Level: ${glapiLevel};`,
      `Remediation_Guidance_Provided: ${includeRecommendation ? "Yes" : "No"};`,
      "Triage done: Yes;",
      "Comments: Triaging has been completed;",
      `Number Vulnerability Triaged: FP | ${fpCount} Confirmed | ${confirmedCount};`,
      "Vulnerability Breakdown:",
      ...triageBySeverity.map(
        item =>
          `Using Components with known vulnerabilities | ${item.severity} | ` +
          `${item.fp} FP | ${item.confirmed} Confirmed;`
      ),
      "$$$"
    ].join("\n");

    // 7. Display results in a separate, copyable panel.
    const oldPanel = document.getElementById("sn-note-generator-panel");
    if (oldPanel) oldPanel.remove();

    const panel = document.createElement("div");
    panel.id = "sn-note-generator-panel";
    Object.assign(panel.style, {
      position: "fixed",
      inset: "4% 4%",
      zIndex: "2147483647",
      background: "#101418",
      color: "#f1f5f9",
      border: "1px solid #64748b",
      borderRadius: "10px",
      padding: "18px",
      overflow: "auto",
      boxShadow: "0 8px 40px #0009",
      font: "14px/1.5 system-ui, sans-serif"
    });

    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:12px">
        <h2 style="margin:0 0 10px">ServiceNow Notes Generator</h2>
        <button id="sn-close">Close</button>
      </div>
      <p>Request: <b></b> | SCTASK: <b></b> | RITM: <b></b></p>
      <h3 style="color:#ff7777">Red notes — analysis summary</h3>
      <textarea id="sn-red" readonly
        style="box-sizing:border-box;width:100%;min-height:210px;background:#1b2026;color:white;padding:10px"></textarea>
      <button id="sn-copy-red">Copy Red notes</button>
      <h3 style="color:#facc15">Yellow notes — $$$ metadata</h3>
      <textarea id="sn-yellow" readonly
        style="box-sizing:border-box;width:100%;min-height:210px;background:#1b2026;color:white;padding:10px"></textarea>
      <button id="sn-copy-yellow">Copy Yellow notes</button>
      <p style="color:#cbd5e1">Review the content and counts before posting.
      Nothing has been submitted to ServiceNow.</p>
    `;

    document.body.appendChild(panel);

    const headings = $$("p b", panel);
    headings[0].textContent = requestType;
    headings[1].textContent = task;
    headings[2].textContent = requestItem || "Not detected";

    $("#sn-red", panel).value = redNotes;
    $("#sn-yellow", panel).value = yellowNotes;

    $("#sn-copy-red", panel).onclick = async () => {
      $("#sn-red", panel).select();
      try {
        await navigator.clipboard.writeText(redNotes);
        alert("Red notes copied.");
      } catch (_) {
        alert("Text selected. Press Ctrl+C to copy.");
      }
    };

    $("#sn-copy-yellow", panel).onclick = async () => {
      $("#sn-yellow", panel).select();
      try {
        await navigator.clipboard.writeText(yellowNotes);
        alert("Yellow notes copied.");
      } catch (_) {
        alert("Text selected. Press Ctrl+C to copy.");
      }
    };

    $("#sn-close", panel).onclick = () => panel.remove();

    console.log(`[SN Note Generator v${VERSION}]`, {
      requestType,
      task,
      requestItem,
      appName,
      appId,
      serviceStream,
      totalVulnerabilities,
      groups,
      branch,
      fpCount,
      confirmedCount,
      redNotes,
      yellowNotes
    });

  } catch (error) {
    console.warn("[SN Note Generator]", error.message);
    if (error.message !== "Cancelled by user.") {
      alert(`Notes were not generated:\n${error.message}`);
    }
  }
})();
