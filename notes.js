
(async () => {
  const ask = (q, d = "") => {
    const v = prompt(q, d);
    if (v === null) throw "Cancelled";
    return v.trim();
  };

  try {
    // Request details from the current ServiceNow page
    const page = document.body.innerText;
    const get = label => {
      const el = [...document.querySelectorAll("label")]
        .find(x => x.innerText.trim().includes(label));
      const field = el && document.getElementById(el.htmlFor);
      return field ? field.value || field.innerText : "";
    };

    const requestType = ask(
      "Request type:",
      get("Type of Request") || "False Positive Analysis"
    );
    const appId = ask("Application Service ID:", get("Application Service ID"));
    const cx1 = ask("Cx1 URL:");
    const total = Number(ask("Number of vulnerabilities:", "1"));
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
    const addRec = confirm("Add recommendation? OK = Yes, Cancel = No");
    const recommendation = addRec ? ask("Recommendation:") : "";
    const glapi = ask("GLAPI Level:");
    const fp = ask("Number of False Positives:", "0");
    const confirmed = ask("Number of Confirmed vulnerabilities:", String(total));

    const breakdown = packages.map(p =>
      `${p.name} | ${p.severity} | Count: ${p.count}`
    ).join("\n");

    const red = [
      `${requestType} has been completed.`,
      "",
      `Cx1: ${cx1}`,
      `Severity / Package Breakdown:\n${breakdown}`,
      `Branch: ${branch}`,
      `Comment: ${comment}`,
      ...(addRec ? [`Recommendation: ${recommendation}`] : [])
    ].join("\n");

    const yellow = [
      "$$$",
      `AppSVC ID: ${appId};`,
      `Task_Sub_Category: ${requestType};`,
      `GLAPI_Level: ${glapi};`,
      `Remediation_Guidance_Provided: ${addRec ? "Yes" : "No"};`,
      "Triage done: Yes;",
      `Number Vulnerability Triaged: FP | ${fp} | Confirmed | ${confirmed};`,
      ...["Critical", "High", "Medium", "Low", "Info"].map(s => {
        const count = packages.filter(p => p.severity.toLowerCase() === s.toLowerCase())
          .reduce((n, p) => n + p.count, 0);
        return count ? `Using Components with known vulnerabilities | ${s} | Count: ${count};` : "";
      }).filter(Boolean),
      "$$$"
    ].join("\n");

    const output = [
      ["Output Comments", comment],
      ["Red Notes", red],
      ["Yellow Notes", yellow]
    ];

    document.getElementById("sn-notes-output")?.remove();

    const box = document.createElement("div");
    box.id = "sn-notes-output";
    box.style = "position:fixed;z-index:999999;top:5%;left:10%;width:80%;max-height:90%;overflow:auto;background:#111;color:white;padding:20px;border:1px solid #777";

    box.innerHTML = `<button id="sn-close">Close</button><h2>Generated Notes</h2>`;

    output.forEach(([title, text], i) => {
      const heading = document.createElement("h3");
      heading.textContent = title;
      const area = document.createElement("textarea");
      area.value = text;
      area.style = "width:100%;height:130px;background:#222;color:white";
      const button = document.createElement("button");
      button.textContent = `Copy ${title}`;
      button.onclick = () => {
        area.select();
        navigator.clipboard.writeText(text).catch(() => document.execCommand("copy"));
      };
      box.append(heading, area, button);
    });

    document.body.appendChild(box);
    document.getElementById("sn-close").onclick = () => box.remove();

  } catch (e) {
    if (e !== "Cancelled") alert(String(e));
  }
})();
