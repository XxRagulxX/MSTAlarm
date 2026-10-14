
(async () => {
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
      if (Number.isInteger(i) && i >= 0 && i < options.length)
        return options[i];
      alert(`Select a number from 1 to ${options.length}.`);
    }
  };

  try {
    // 1. AppScan URL and number of vulnerabilities
    const appscanURL = ask("Enter AppScan URL:");
    const total = getCount("How many vulnerabilities are present?", "1");

    if (total < 1) throw new Error("Enter at least one vulnerability.");

    const vulnerabilities = [];

    // 2. Collect each vulnerability
    for (let i = 1; i <= total; i++) {
      const name = ask(`Vulnerability ${i} - Name:`);

      const severity = choose(
        `${name} - Select Severity:`,
        ["Critical", "High", "Medium", "Low"],
        2
      );

      const count = getCount(
        `${name} - ${severity} - Vulnerability Count:`,
        "1"
      );

      const comment = ask(`${name} - Vulnerability Comment:`);

      vulnerabilities.push({
        name,
        severity,
        count,
        comment,
        recommendation: "",
        fp: 0,
        confirmed: 0
      });
    }

    // 3. Optional recommendation for each vulnerability
    const addRecommendation = choose(
      "Do you want to add recommendations?",
      ["Yes", "No"],
      1
    ) === "Yes";

    if (addRecommendation) {
      for (const vuln of vulnerabilities) {
        vuln.recommendation = ask(
          `${vuln.name} - Recommendation:\n` +
          `Severity: ${vuln.severity}\n` +
          `Count: ${vuln.count}`
        );
      }
    }

    // 4. Overall triage totals
    const totalFP = getCount("Total number of False Positives (FP):", "0");
    const totalConfirmed = getCount(
      "Total number of Confirmed vulnerabilities:",
      "0"
    );

    // 5. Per-vulnerability FP and Confirmed breakdown
    for (const vuln of vulnerabilities) {
      vuln.fp = getCount(`${vuln.name} - FP Count:`, "0");
      vuln.confirmed = getCount(
        `${vuln.name} - Confirmed Count:`,
        "0"
      );

      if (vuln.fp + vuln.confirmed > vuln.count) {
        throw new Error(
          `${vuln.name}: FP + Confirmed cannot exceed vulnerability count ${vuln.count}.`
        );
      }
    }

    const breakdownFP = vulnerabilities.reduce((n, v) => n + v.fp, 0);
    const breakdownConfirmed = vulnerabilities.reduce(
      (n, v) => n + v.confirmed, 0
    );

    if (breakdownFP !== totalFP || breakdownConfirmed !== totalConfirmed) {
      throw new Error(
        `Triage totals do not match the breakdown.\n` +
        `Overall FP: ${totalFP}; Breakdown FP: ${breakdownFP}\n` +
        `Overall Confirmed: ${totalConfirmed}; ` +
        `Breakdown Confirmed: ${breakdownConfirmed}\n` +
        `Please rerun and enter matching totals.`
      );
    }

    // 6. Output Comments
    const outputComments = vulnerabilities.map(v =>
      `${v.name} | ${v.severity} | Count: ${v.count}\n${v.comment}`
    ).join("\n\n");

    // 7. Red Notes
    const redNotes = [
      "False Positive Analysis has been completed.",
      "",
      `AppScan: ${appscanURL}`,
      "",
      ...vulnerabilities.flatMap(v => [
        `Issues: ${v.name}`,
        `Severity: ${v.severity}`,
        `Count: ${v.count}`,
        `Comment: ${v.comment}`,
        ...(addRecommendation
          ? [`Recommendation: ${v.recommendation}`]
          : []),
        ""
      ])
    ].join("\n");

    // 8. Yellow Notes / Vulnerability Breakdown
    const yellowNotes = [
      "$$$",
      "Task_Sub_Category: DAST;",
      "Impacted_Tool: AppScan;",
      "Manual_Scan_Performed: No;",
      `Remediation_Guidance_Provided: ${addRecommendation ? "Yes" : "No"};`,
      "Triaging done: Yes;",
      `Comments: ${vulnerabilities.map(v => v.comment).join(" | ")};`,
      `Number Vulnerability Triaged: ${totalFP} FP | ${totalConfirmed} Confirmed;`,
      "Vulnerability Breakdown:",
      ...vulnerabilities.map(v =>
        `${v.name} | ${v.severity} | ${v.fp} FP | ${v.confirmed} Confirmed;`
      ),
      "$$$"
    ].join("\n");

    // 9. Print everything directly in the same console
    console.log("========== OUTPUT COMMENTS ==========");
    console.log(outputComments);

    console.log("========== RED NOTES ==========");
    console.log(redNotes);

    console.log("========== YELLOW NOTES ==========");
    console.log(yellowNotes);

    console.log("========== END ==========");

  } catch (e) {
    console.warn("DAST FP Note Generator:", e.message);
  }
})();
