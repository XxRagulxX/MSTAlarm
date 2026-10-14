
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

    const requestType = ask("Request type:",
      get("Type of Request") || "False Positive Analysis");
    const appId = ask("Application Service ID:", get("Application Service ID"));
    const cx1 = ask("Cx1 URL:");
    const total = Number(ask("Number of vulnerabilities:", "1"));

    if (!Number.isInteger(total) || total < 1)
      throw new Error("Invalid vulnerability count");

    const branch = ask("Branch:", get("List Branch Name") || "master");
    const packages = [];

    for (let i = 1; i <= total; i++) {
      packages.push({
        name: ask(`Vulnerability ${i} - Package name:`),
        severity: ask(`Vulnerability ${i} - Severity:`),
        count: Number(ask(`Vulnerability ${i} - Count:`, "1"))
      });
    }

    const comment = ask("Analysis comment:");
    const addRec = confirm("Add recommendation? OK = Yes, Cancel = No");
    const recommendation = addRec ? ask("Recommendation:") : "";
    const glapi = ask("GLAPI Level:");
    const fp = ask("Number of False Positives:", "0");
    const confirmed = ask("Number of Confirmed vulnerabilities:", String(total));

    const outputComments = comment;

    const redNotes = [
      `${requestType} has been completed.`,
      "",
      `Cx1: ${cx1}`,
      `Branch: ${branch}`,
      "Vulnerability Breakdown:",
      ...packages.map(p => `${p.name} | ${p.severity} | Count: ${p.count}`),
      `Comment: ${comment}`,
      ...(addRec ? [`Recommendation: ${recommendation}`] : [])
    ].join("\n");

    const yellowNotes = [
      "$$$",
      `AppSVC ID: ${appId};`,
      `Task_Sub_Category: ${requestType};`,
      `GLAPI_Level: ${glapi};`,
      `Remediation_Guidance_Provided: ${addRec ? "Yes" : "No"};`,
      "Triage done: Yes;",
      `Number Vulnerability Triaged: FP | ${fp} | Confirmed | ${confirmed};`,
      ...["Critical", "High", "Medium", "Low", "Info"].map(s => {
        const count = packages
          .filter(p => p.severity.toLowerCase() === s.toLowerCase())
          .reduce((n, p) => n + p.count, 0);
        return count
          ? `Using Components with known vulnerabilities | ${s} | Count: ${count};`
          : "";
      }).filter(Boolean),
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
