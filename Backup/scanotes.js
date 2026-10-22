
(async () => {
  const ask = (q, d = "") => {
    const v = prompt(q, d);
    if (v === null) throw new Error("Cancelled");
    return v.trim();
  };

  const choose = (title, options, defaultChoice = 1) => {
    while (true) {
      const value = ask(
        `${title}\n\n${options.map((x, i) => `${i + 1}. ${x}`).join("\n")}`,
        String(defaultChoice)
      );
      const index = Number(value) - 1;
      if (Number.isInteger(index) && index >= 0 && index < options.length)
        return options[index];
      alert(`Choose a number from 1 to ${options.length}.`);
    }
  };

  const count = (q, d = "0") => {
    while (true) {
      const v = ask(q, d);
      if (/^\d+$/.test(v)) return Number(v);
      alert("Enter a non-negative whole number.");
    }
  };

  try {
    // Read request type from the ticket
    const requestType =
      document.querySelector('select[aria-label="Type of Request"]')
        ?.selectedOptions[0]?.textContent?.trim()
      || [...document.querySelectorAll("label")]
        .find(el => /type of request/i.test(el.innerText))
        ?.htmlFor.split(/\s+/)
        .map(id => document.getElementById(id))
        .find(el => el?.tagName === "SELECT")
        ?.selectedOptions[0]?.textContent?.trim()
      || document.querySelector('select[name*="type_of_request"]')
        ?.selectedOptions[0]?.textContent?.trim()
      || "Unknown Request Type";

    // Read AppSVC from catalog variables
    const appId =
      [...document.querySelectorAll('input[id*="cat_item_option"]')]
        .find(el => /^APPSVC/i.test(el.value.trim()))
        ?.value.trim()
      || [...document.querySelectorAll("input")]
        .find(el => /^APPSVC/i.test(el.value.trim()))
        ?.value.trim()
      || "APPSVC ID not found";

    // Read branch by matching its label/container
    function getVariable(labelText) {
      const label = [...document.querySelectorAll(
        "label, .sc_variable_label, .question_text"
      )].find(el =>
        el.innerText.trim().toLowerCase().includes(labelText.toLowerCase())
      );

      if (!label) return "";

      const container =
        label.closest(".form-field, .form-group, .sc-form-field, tr, .question")
        || label.parentElement?.parentElement;

      const field = container?.querySelector(
        'input:not([type="hidden"]), select, textarea'
      );

      return field?.value?.trim() || "";
    }

    const cx1 = ask("Cx1 URL:");
    const total = count("Number of packages to enter:", "1");

    if (total < 1) throw new Error("Enter at least one package.");

    const branch = getVariable("List Branch Name") || ask("Branch name:");
    const packages = [];

    // Collect package details, analysis and recommendations
    for (let i = 1; i <= total; i++) {
      const name = ask(`Package ${i} - Package Name:`);

      const severity = choose(
        `${name} - Select Severity`,
        ["Critical", "High", "Medium", "Low"],
        3
      );

      const vulnerabilityCount = count(
        `${name} - ${severity} - Vulnerability Count:`,
        "1"
      );

      if (vulnerabilityCount < 1)
        throw new Error(`${name}: vulnerability count must be at least 1.`);

      const analysis = ask(
        `${name} - Analysis Comment\nSeverity: ${severity}\n` +
        `Vulnerability Count: ${vulnerabilityCount}\n\nEnter analysis:`
      );

      packages.push({
        name,
        severity,
        count: vulnerabilityCount,
        analysis,
        recommendation: ""
      });
    }

    const addRecommendation = choose(
      "Do you want to add recommendations?",
      ["Yes", "No"],
      2
    ) === "Yes";

    if (addRecommendation) {
      for (const pkg of packages) {
        pkg.recommendation = ask(
          `${pkg.name} - Recommendation\n` +
          `Severity: ${pkg.severity}\n` +
          `Vulnerability Count: ${pkg.count}\n\nEnter recommendation:`
        );
      }
    }

    const glapi = choose(
      "Select GLAPI Level",
      ["1", "2", "3", "NA"],
      1
    );

    // Collect FP and Confirmed counts for every package
    for (const pkg of packages) {
      pkg.fp = count(`${pkg.name} - FP Count:`, "0");
      pkg.confirmed = count(`${pkg.name} - Confirmed Count:`, String(pkg.count - pkg.fp));

      if (pkg.fp + pkg.confirmed !== pkg.count) {
        throw new Error(
          `${pkg.name}: FP (${pkg.fp}) + Confirmed (${pkg.confirmed}) ` +
          `must equal its vulnerability count (${pkg.count}).`
        );
      }
    }

    const totalFP = packages.reduce((n, p) => n + p.fp, 0);
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
        `${pkg.name} | ${pkg.severity} | Count: ${pkg.count}\n` +
        `Analysis: ${pkg.analysis}`
      ),
      ...(addRecommendation
        ? [
            "",
            "Package Recommendations:",
            ...packages.map(pkg =>
              `${pkg.name}:\n${pkg.recommendation}`
            )
          ]
        : [])
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
        `${pkg.name} - Using Components with known vulnerabilities | ` +
        `${pkg.severity} | FP ${pkg.fp} | Confirmed ${pkg.confirmed} |`
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

  } catch (e) {
    console.warn("Note generator:", e.message);
  }
})();
