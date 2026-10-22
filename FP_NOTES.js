(async () => {

  // ── Helpers ──────────────────────────────────────────────────────────────

  const clean = s => (s || "").replace(/\s+/g, " ").trim();

  const isVisible = el =>
    !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));

  const ask = (q, d = "") => {
    const v = prompt(q, d);
    if (v === null) throw new Error("Cancelled");
    return v.trim();
  };

  const getCount = (q, d = "0") => {
    while (true) {
      const v = ask(q, d);
      if (/^\d+$/.test(v)) return Number(v);
      alert("Enter a valid whole number.");
    }
  };

  const choose = (q, options, defaultIndex = 0) => {
    while (true) {
      const v = ask(
        `${q}\n\n${options.map((x, i) => `${i + 1}. ${x}`).join("\n")}`,
        String(defaultIndex + 1)
      );
      const i = Number(v) - 1;
      if (Number.isInteger(i) && i >= 0 && i < options.length) return options[i];
      alert(`Select a number from 1 to ${options.length}.`);
    }
  };

  function copyText(text) {
    if (typeof copy === "function") {
      try { copy(text); console.log("Copied to clipboard."); return; } catch (_) {}
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
      console.log("Copied to clipboard.");
      return;
    } catch (_) {}
    try {
      navigator.clipboard.writeText(text);
      console.log("Copied to clipboard.");
    } catch (_) {
      console.log("Could not copy automatically. Output is in console.");
    }
  }

  // ── Page detection (from SCTASK_NOTES) ───────────────────────────────────

  function getInputValueFromContainer(container) {
    if (!container) return "";
    const fields = [...container.querySelectorAll(
      'input:not([type="hidden"]), textarea, select'
    )].filter(isVisible);
    for (const field of fields) {
      if (field.tagName === "SELECT") {
        const txt = clean(field.options[field.selectedIndex]?.text || field.value);
        if (txt) return txt;
      } else {
        const val = clean(field.value || field.getAttribute("value") || "");
        if (val) return val;
      }
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
          return { text: clean(option?.text || ""), value: clean(option?.value || "") };
        }
      }
      const inputs = [...row.querySelectorAll('input:not([type="hidden"]), textarea')].filter(isVisible);
      for (const input of inputs) {
        const val = clean(input.value || input.getAttribute("value") || "");
        if (val) return { text: val, value: val };
      }
    }
    return { text: "", value: "" };
  }

  function detectTaskSubCategory() {
    const serviceStream = getSelectedOptionByLabel("Service Stream");
    const typeOfRequest = getSelectedOptionByLabel("Type of Request");
    const combined = [
      serviceStream.text, typeOfRequest.text,
      typeOfRequest.value, serviceStream.value
    ].map(clean).join(" ").toUpperCase();
    if (combined.includes("DAST")) return "DAST";
    if (combined.includes("SAST")) return "SAST";
    if (combined.includes("SCA"))  return "SCA";
    return null;
  }

  // ── DAST / SAST shared flow ───────────────────────────────────────────────

  async function runDASTorSAST(type) {
    const toolName  = type === "DAST" ? "AppScan"   : "Checkmarx";
    const toolLabel = type === "DAST" ? "AppScan"   : "Checkmarx";
    const urlLabel  = type === "DAST" ? "Enter AppScan URL:" : "Enter Checkmarx URL:";
    const tag       = type === "DAST" ? "DAST FP Note Generator" : "SAST FP Note Generator";

    const toolURL = ask(urlLabel);
    const total   = getCount("How many vulnerabilities are present?", "1");
    if (total < 1) throw new Error("Enter at least one vulnerability.");

    const vulnerabilities = [];

    for (let i = 1; i <= total; i++) {
      const name     = ask(`Vulnerability ${i} - Name:`);
      const severity = choose(`${name} - Select Severity:`, ["Critical", "High", "Medium", "Low"], 2);
      const count    = getCount(`${name} - ${severity} - Vulnerability Count:`, "1");
      const comment  = ask(`${name} - Vulnerability Comment:`);
      vulnerabilities.push({ name, severity, count, comment, recommendation: "", fp: 0, confirmed: 0 });
    }

    const addRecommendation = choose("Do you want to add recommendations?", ["Yes", "No"], 1) === "Yes";
    if (addRecommendation) {
      for (const vuln of vulnerabilities) {
        vuln.recommendation = ask(
          `${vuln.name} - Recommendation:\nSeverity: ${vuln.severity}\nCount: ${vuln.count}`
        );
      }
    }

    const totalFP        = getCount("Total number of False Positives (FP):", "0");
    const totalConfirmed = getCount("Total number of Confirmed vulnerabilities:", "0");

    for (const vuln of vulnerabilities) {
      vuln.fp        = getCount(`${vuln.name} - FP Count:`, "0");
      vuln.confirmed = getCount(`${vuln.name} - Confirmed Count:`, "0");
      if (vuln.fp + vuln.confirmed > vuln.count) {
        throw new Error(`${vuln.name}: FP + Confirmed cannot exceed vulnerability count ${vuln.count}.`);
      }
    }

    const breakdownFP        = vulnerabilities.reduce((n, v) => n + v.fp, 0);
    const breakdownConfirmed = vulnerabilities.reduce((n, v) => n + v.confirmed, 0);

    if (breakdownFP !== totalFP || breakdownConfirmed !== totalConfirmed) {
      throw new Error(
        `Triage totals do not match the breakdown.\n` +
        `Overall FP: ${totalFP}; Breakdown FP: ${breakdownFP}\n` +
        `Overall Confirmed: ${totalConfirmed}; Breakdown Confirmed: ${breakdownConfirmed}\n` +
        `Please rerun and enter matching totals.`
      );
    }

    const outputComments = vulnerabilities.map(v =>
      `${v.name} | ${v.severity} | Count: ${v.count}\n${v.comment}`
    ).join("\n\n");

    const redNotes = [
      "False Positive Analysis has been completed.",
      "",
      `${toolLabel}: ${toolURL}`,
      "",
      ...vulnerabilities.flatMap(v => [
        `Issues: ${v.name}`,
        `Severity: ${v.severity}`,
        `Count: ${v.count}`,
        `Comment: ${v.comment}`,
        ...(addRecommendation ? [`Recommendation: ${v.recommendation}`] : []),
        ""
      ])
    ].join("\n");

    const yellowNotes = [
      "$$$",
      `Task_Sub_Category: ${type};`,
      `Impacted_Tool: ${toolName};`,
      "Manual_Scan_Performed: No;",
      `Remediation_Guidance_Provided: ${addRecommendation ? "Yes" : "No"};`,
      "Triaging done: Yes;",
      "Comments: NA;",
      `Number Vulnerability Triaged: ${totalFP} FP | ${totalConfirmed} Confirmed;`,
      "Vulnerability Breakdown:",
      ...vulnerabilities.map(v =>
        `${v.name} | ${v.severity} | ${v.fp} FP | ${v.confirmed} Confirmed;`
      ),
      "$$$"
    ].join("\n");

    console.log("========== OUTPUT COMMENTS ==========");
    console.log(outputComments);
    console.log("========== RED NOTES ==========");
    console.log(redNotes);
    console.log("========== YELLOW NOTES ==========");
    console.log(yellowNotes);
    console.log("========== END ==========");

    copyText(`${outputComments}\n\n${redNotes}\n\n${yellowNotes}`);
  }

  // ── SCA flow ──────────────────────────────────────────────────────────────

  async function runSCA() {
    function getVariable(labelText) {
      const label = [...document.querySelectorAll("label, .sc_variable_label, .question_text")]
        .find(el => el.innerText.trim().toLowerCase().includes(labelText.toLowerCase()));
      if (!label) return "";
      const container =
        label.closest(".form-field, .form-group, .sc-form-field, tr, .question") ||
        label.parentElement?.parentElement;
      const field = container?.querySelector('input:not([type="hidden"]), select, textarea');
      return field?.value?.trim() || "";
    }

    const requestType =
      document.querySelector('select[aria-label="Type of Request"]')?.selectedOptions[0]?.textContent?.trim() ||
      [...document.querySelectorAll("label")]
        .find(el => /type of request/i.test(el.innerText))
        ?.htmlFor.split(/\s+/)
        .map(id => document.getElementById(id))
        .find(el => el?.tagName === "SELECT")
        ?.selectedOptions[0]?.textContent?.trim() ||
      document.querySelector('select[name*="type_of_request"]')?.selectedOptions[0]?.textContent?.trim() ||
      "SCA";

    const appId =
      [...document.querySelectorAll('input[id*="cat_item_option"]')]
        .find(el => /^APPSVC/i.test(el.value.trim()))?.value.trim() ||
      [...document.querySelectorAll("input")]
        .find(el => /^APPSVC/i.test(el.value.trim()))?.value.trim() ||
      "APPSVC ID not found";

    const cx1    = ask("Cx1 URL:");
    const total  = getCount("Number of packages to enter:", "1");
    if (total < 1) throw new Error("Enter at least one package.");

    const branch   = getVariable("List Branch Name") || ask("Branch name:");
    const packages = [];

    for (let i = 1; i <= total; i++) {
      const name     = ask(`Package ${i} - Package Name:`);
      const severity = choose(`${name} - Select Severity`, ["Critical", "High", "Medium", "Low"], 2);
      const vulnerabilityCount = getCount(`${name} - ${severity} - Vulnerability Count:`, "1");
      if (vulnerabilityCount < 1) throw new Error(`${name}: vulnerability count must be at least 1.`);
      const analysis = ask(
        `${name} - Analysis Comment\nSeverity: ${severity}\nVulnerability Count: ${vulnerabilityCount}\n\nEnter analysis:`
      );
      packages.push({ name, severity, count: vulnerabilityCount, analysis, recommendation: "" });
    }

    const addRecommendation = choose("Do you want to add recommendations?", ["Yes", "No"], 1) === "Yes";
    if (addRecommendation) {
      for (const pkg of packages) {
        pkg.recommendation = ask(
          `${pkg.name} - Recommendation\nSeverity: ${pkg.severity}\nVulnerability Count: ${pkg.count}\n\nEnter recommendation:`
        );
      }
    }

    const glapi = choose("Select GLAPI Level", ["1", "2", "3", "NA"], 2);

    for (const pkg of packages) {
      pkg.fp        = getCount(`${pkg.name} - FP Count:`, "0");
      pkg.confirmed = getCount(`${pkg.name} - Confirmed Count:`, String(pkg.count - pkg.fp));
      if (pkg.fp + pkg.confirmed !== pkg.count) {
        throw new Error(
          `${pkg.name}: FP (${pkg.fp}) + Confirmed (${pkg.confirmed}) must equal vulnerability count (${pkg.count}).`
        );
      }
    }

    const totalFP        = packages.reduce((n, p) => n + p.fp, 0);
    const totalConfirmed = packages.reduce((n, p) => n + p.confirmed, 0);

    const outputComments = packages.map(pkg =>
      `${pkg.name} (${pkg.severity}): ${pkg.analysis}`
    ).join("\n\n");

    const redNotes = [
      `${requestType} - Analysis Completed`,
      `Cx1 URL: ${cx1}`,
      `Branch: ${branch}`,
      "",
      "Package Analysis:",
      ...packages.map(pkg =>
        `${pkg.name} | ${pkg.severity} | Count: ${pkg.count}\nAnalysis: ${pkg.analysis}`
      ),
      ...(addRecommendation ? [
        "",
        "Package Recommendations:",
        ...packages.map(pkg => `${pkg.name}:\n${pkg.recommendation}`)
      ] : [])
    ].join("\n");

    const yellowNotes = [
      "$$$",
      `AppSVC ID: ${appId};`,
      `Task_Sub_Category: ${requestType};`,
      `GLAPI_Level: ${glapi};`,
      `Remediation_Guidance_Provided: ${addRecommendation ? "Yes" : "No"};`,
      "Triage done: Yes;",
      `Number Vulnerability Triaged: FP | ${totalFP} | Confirmed | ${totalConfirmed};`,
      ...packages.map(pkg =>
        `${pkg.name} - Using Components with known vulnerabilities | ${pkg.severity} | FP ${pkg.fp} | Confirmed ${pkg.confirmed} |`
      ),
      "$$$"
    ].join("\n");

    console.log("========== OUTPUT COMMENTS ==========");
    console.log(outputComments);
    console.log("========== RED NOTES ==========");
    console.log(redNotes);
    console.log("========== YELLOW NOTES ==========");
    console.log(yellowNotes);
    console.log("========== END ==========");

    copyText(`${outputComments}\n\n${redNotes}\n\n${yellowNotes}`);
  }

  // ── Entry point ───────────────────────────────────────────────────────────

  try {
    let type = detectTaskSubCategory();

    if (type) {
      console.log(`Detected task type: ${type}`);
      const confirmed = choose(
        `Detected: ${type}\n\nProceed with this type?`,
        ["Yes — use detected type", "No — let me choose manually"],
        0
      );
      if (confirmed !== "Yes — use detected type") type = null;
    }

    if (!type) {
      type = choose(
        "Select the task type:",
        ["DAST", "SAST", "SCA"],
        0
      );
    }

    if (type === "DAST" || type === "SAST") {
      await runDASTorSAST(type);
    } else if (type === "SCA") {
      await runSCA();
    } else {
      throw new Error(`Unknown type: ${type}`);
    }

  } catch (e) {
    console.warn("FP Note Generator:", e.message);
  }

})();
