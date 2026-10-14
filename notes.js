
(async () => {
  const ask = (q, d = "") => {
    const v = prompt(q, d);
    if (v === null) throw new Error("Cancelled");
    return v.trim();
  };

  try {
    const get = label => {
      const el = [...document.querySelectorAll("label")]
        .find(x => x.innerText.trim().includes(label));
      const field = el && document.getElementById(el.htmlFor);
      return field ? (field.value || field.innerText || "").trim() : "";
    };

    const requestType = ask(
      "Request type:",
      get("Type of Request") || "False Positive Analysis"
    );
    const appId = ask("Application Service ID:", get("Application Service ID"));
    const cx1 = ask("Cx1 URL:");
    const total = Number(ask("Number of vulnerabilities:", "1"));

    if (!Number.isInteger(total) || total < 1)
      throw new Error("Enter a valid vulnerability count.");

    const branch = ask("Branch:", get("List Branch Name") || "master");
    const packages = [];

    for (let i = 1; i <= total; i++) {
      packages.push({
        name: ask(`Vulnerability ${i} - Package name:`),
        severity: ask(`Vulnerability ${i} - Severity (Critical/High/Medium/Low/Info):`),
        count: Number(ask(`Vulnerability ${i} - Count:`, "1"))
      });
    }

    const comment = ask("Analysis comment:");
    const addRecommendation = confirm("Add recommendation? OK = Yes, Cancel = No");
    const recommendation = addRecommendation
      ? ask("Recommendation:")
      : "";

    const glapi = ask("GLAPI Level:");
    const fp = ask("Number of False Positives:", "0");
    const confirmed = ask("Number of Confirmed vulnerabilities:", String(total));

    const packageBreakdown = packages
      .map(p => `${p.name} | ${p.severity} | Count: ${p.count}`)
      .join("\n");

    const outputComments = comment;

    const redNotes = [
      `${requestType} has been completed.`,
      "",
      `Cx1: ${cx1}`,
      `Branch: ${branch}`,
      `Vulnerability Breakdown:`,
      packageBreakdown,
      `Comment: ${comment}`,
      ...(addRecommendation ? [`Recommendation: ${recommendation}`] : [])
    ].join("\n");

    const yellowNotes = [
      "$$$",
      `AppSVC ID: ${appId};`,
      `Task_Sub_Category: ${requestType};`,
      `GLAPI_Level: ${glapi};`,
      `Remediation_Guidance_Provided: ${addRecommendation ? "Yes" : "No"};`,
      "Triage done: Yes;",
      `Number Vulnerability Triaged: FP | ${fp} | Confirmed | ${confirmed};`,
      ...["Critical", "High", "Medium", "Low", "Info"].map(severity => {
        const count = packages
          .filter(p => p.severity.toLowerCase() === severity.toLowerCase())
          .reduce((sum, p) => sum + p.count, 0);

        return count
          ? `Using Components with known vulnerabilities | ${severity} | Count: ${count};`
          : "";
      }).filter(Boolean),
      "$$$"
    ].join("\n");

    console.log("\n========== OUTPUT COMMENTS ==========\n");
    console.log(outputComments);

    console.log("\n========== RED NOTES ==========\n");
    console.log(redNotes);

    console.log("\n========== YELLOW NOTES ==========\n");
    console.log(yellowNotes);

    console.log("\n========== END ==========\n");

  } catch (error) {
    console.warn(error.message);
  }
})();
