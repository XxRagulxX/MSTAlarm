(async function () {

  // ── Helpers ──────────────────────────────────────────────────────────────

  function clean(s) {
    return (s || "").toString().replace(/\s+/g, " ").trim();
  }

  function eqIgnoreCase(a, b) {
    return clean(a).toLowerCase() === clean(b).toLowerCase();
  }

  function uniq(arr) {
    return [...new Set(arr.filter(Boolean))];
  }

  function escapeRegex(str) {
    return str.replace(/[-.*?^${}()|[\]\\]/g, "\\$&");
  }

  function isPenaltyRepo(repoKey) {
    return /^penalty-/i.test(clean(repoKey || ""));
  }

  async function copyText(text) {
    // DevTools console built-in — no permission needed
    if (typeof copy === "function") {
      try { copy(text); console.log("Copied to clipboard."); return; } catch (_) {}
    }
    // textarea + execCommand — works without clipboard permission
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
    // Last resort: Clipboard API
    try {
      await navigator.clipboard.writeText(text);
      console.log("Copied to clipboard.");
    } catch (e) {
      console.log("Could not copy automatically. Output is in console.");
    }
  }

  function inferPackageType(repoKey, name, path, moduleID) {
    const s = `${repoKey || ""} ${name || ""} ${path || ""} ${moduleID || ""}`.toLowerCase();
    if (s.includes("npm")) return "npm";
    if (s.includes("maven") || /\.jar$/i.test(name || "")) return "maven";
    if (s.includes("pypi") || s.includes("python") || /\.whl$/i.test(name || "")) return "pypi";
    return "npm";
  }

  function inferPackageId(pkgType, packageName) {
    return `${pkgType}://${packageName}`;
  }

  function extractBestCVE(issue) {
    const cves =
      issue?.component_versions?.more_details?.cves ||
      issue?.more_details?.cves ||
      [];

    if (Array.isArray(cves) && cves.length) {
      const found = cves.find(x => clean(x.cve));
      if (found && clean(found.cve)) return clean(found.cve);
    }

    if (/^CVE-\d{4}-\d+$/i.test(clean(issue?.title))) return clean(issue.title);
    if (/^CVE-\d{4}-\d+$/i.test(clean(issue?.applicability_detail?.vulnerability_id))) {
      return clean(issue.applicability_detail.vulnerability_id);
    }

    return clean(issue?.id) || clean(issue?.high_profile_info?.VulnId) || "NOT_FOUND";
  }

  async function fetchIssuesBySeverity(payload, severity) {
    const url = `/ui/api/v1/xray/ui/component/details/paginatedIssues?direction=desc&order_by=severity&num_of_rows=5000&severity=${severity}&page_num=1`;

    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json, */*",
        "X-Requested-With": "XMLHttpRequest"
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (Array.isArray(data.data) && data.data.length) {
      return data.data[0];
    }

    return null;
  }

  // ── Inputs ───────────────────────────────────────────────────────────────

  const virtualRepo = clean(prompt("Enter Virtual Repo", "pharmacy-fulfillment-npm-virtual"));
  if (!virtualRepo) { console.log("Virtual Repo not provided."); return; }

  const penaltyName = clean(prompt("Enter Penalty Name", "penalty-APPSVC046983-npm-local"));
  if (!penaltyName) { console.log("Penalty name not provided."); return; }

  const packageName = clean(prompt("Enter Package Name", "proxy-addr"));
  if (!packageName) { console.log("Package name not provided."); return; }

  try {

    // ── PART 1: Penalty Check ─────────────────────────────────────────────

    const infoRes = await fetch("/ui/api/v1/ui/admin/repositories/info", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json, text/plain, */*",
        "X-Requested-With": "XMLHttpRequest"
      },
      body: JSON.stringify({
        limit: 40,
        offset: 0,
        isProtectContext: false,
        repoKeyToSearch: virtualRepo,
        sortBy: "repoKey",
        sortDirection: "asc"
      })
    });

    if (!infoRes.ok) {
      throw new Error(`repositories/info failed: HTTP ${infoRes.status} ${infoRes.statusText}`);
    }

    const infoData = await infoRes.json();
    const rows = Array.isArray(infoData)
      ? infoData
      : Array.isArray(infoData?.data)
        ? infoData.data
        : Array.isArray(infoData?.data?.repositories)
          ? infoData.data.repositories
          : Array.isArray(infoData?.results)
            ? infoData.results
            : [];

    const repoInfo = rows[0] || {};
    const selectedRepos = Array.isArray(repoInfo.selectedRepos) ? repoInfo.selectedRepos : [];
    const packageType = clean(repoInfo.packageType || "Npm");

    let matchedSelected = selectedRepos.find(x => eqIgnoreCase(x, penaltyName)) || "";
    let matchedAvailableLocal = "";
    let matchedAvailableFederated = "";
    let matchedAvailableVirtual = "";
    let matchedAvailableRemote = "";

    if (!matchedSelected) {
      const availUrl =
        `/ui/api/v1/ui/admin/repositories/availablerepositories` +
        `?repoKey=${encodeURIComponent(virtualRepo)}` +
        `&type=${encodeURIComponent(packageType)}` +
        `&projectKey=`;

      const availRes = await fetch(availUrl, {
        method: "GET",
        credentials: "include",
        headers: {
          "Accept": "application/json, text/plain, */*",
          "X-Requested-With": "XMLHttpRequest"
        }
      });

      if (!availRes.ok) {
        throw new Error(`availablerepositories failed: HTTP ${availRes.status} ${availRes.statusText}`);
      }

      const availData = await availRes.json();

      const availableLocalRepos     = Array.isArray(availData?.availableLocalRepos)     ? availData.availableLocalRepos     : [];
      const availableFederatedRepos = Array.isArray(availData?.availableFederatedRepos) ? availData.availableFederatedRepos : [];
      const availableVirtualRepos   = Array.isArray(availData?.availableVirtualRepos)   ? availData.availableVirtualRepos   : [];
      const availableRemoteRepos    = Array.isArray(availData?.availableRemoteRepos)    ? availData.availableRemoteRepos    : [];

      matchedAvailableLocal     = availableLocalRepos.find(x => eqIgnoreCase(x, penaltyName))     || "";
      matchedAvailableFederated = availableFederatedRepos.find(x => eqIgnoreCase(x, penaltyName)) || "";
      matchedAvailableVirtual   = availableVirtualRepos.find(x => eqIgnoreCase(x, penaltyName))   || "";
      matchedAvailableRemote    = availableRemoteRepos.find(x => eqIgnoreCase(x, penaltyName))    || "";
    }

    const presentInSelected  = !!matchedSelected;
    const presentInAvailable =
      !!matchedAvailableLocal || !!matchedAvailableFederated ||
      !!matchedAvailableVirtual || !!matchedAvailableRemote;

    let penaltyStatus = "Not Present";
    if (presentInSelected)       penaltyStatus = "Present in selectedRepos";
    else if (presentInAvailable) penaltyStatus = "Present in available repositories, but not selected";

    const matchedValue =
      matchedSelected || matchedAvailableLocal || matchedAvailableFederated ||
      matchedAvailableVirtual || matchedAvailableRemote || "NOT_FOUND";

    let foundIn = "NOT_FOUND";
    if (matchedSelected)          foundIn = "selectedRepos";
    else if (matchedAvailableLocal)     foundIn = "availableLocalRepos";
    else if (matchedAvailableFederated) foundIn = "availableFederatedRepos";
    else if (matchedAvailableVirtual)   foundIn = "availableVirtualRepos";
    else if (matchedAvailableRemote)    foundIn = "availableRemoteRepos";

    const penaltyOutput = `Virtual Repo: ${virtualRepo}
Penalty Name Input: ${penaltyName}
Matched Value: ${matchedValue}
Found In: ${foundIn}
Status: ${penaltyStatus}`;

    // ── PART 2: JFrog Vulnerability Check ────────────────────────────────

    const query = `${packageName}*`;

    const quickRes = await fetch("/ui/api/v1/ui/artifactsearch/quick", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json, text/plain, */*",
        "X-Requested-With": "XMLHttpRequest"
      },
      body: JSON.stringify({
        query,
        selectedRepositories: [],
        search: "quick"
      })
    });

    if (!quickRes.ok) {
      throw new Error(`Quick search failed: HTTP ${quickRes.status} ${quickRes.statusText}`);
    }

    const quickData = await quickRes.json();
    const allResults = Array.isArray(quickData.results) ? quickData.results : [];

    if (!allResults.length) {
      console.log(`No results found for ${query}`);
      return;
    }

    const nonPenalty = allResults.filter(r => !isPenaltyRepo(r.repoKey));
    if (!nonPenalty.length) {
      console.log("Only penalty repo results were found.");
      return;
    }

    const nonJson = nonPenalty.filter(r => !/\.json$/i.test(r.name || ""));
    const workingSet = nonJson.length ? nonJson : nonPenalty;

    const pkgEsc = escapeRegex(packageName);
    const versioned = workingSet.map(r => {
      const name = r.name || "";
      const m = name.match(new RegExp(`${pkgEsc}-([0-9][A-Za-z0-9-._]*)`, "i"));
      return { item: r, version: m ? m[1] : "" };
    });

    const versions = uniq(versioned.map(x => x.version)).sort();
    if (!versions.length) {
      console.log("Could not extract versions.");
      return;
    }

    const versionList = versions.map((v, i) => `${i + 1}. ${v}`).join("\n");
    console.log("========== AVAILABLE VERSIONS ==========");
    console.log(versionList);
    console.log("========================================");
    const versionChoice = clean(
      prompt(`${versions.length} versions available — see console for full list.\n\nEnter number`, "1")
    );

    if (!versionChoice) { console.log("Version not provided."); return; }

    let selectedVersion = "";
    if (/^\d+$/.test(versionChoice)) {
      const idx = Number(versionChoice) - 1;
      selectedVersion = versions[idx] || "";
    } else {
      selectedVersion = versionChoice;
    }

    if (!selectedVersion) { console.log("Invalid version selection."); return; }

    const versionMatches = versioned
      .filter(x => x.version === selectedVersion)
      .map(x => x.item);

    if (!versionMatches.length) {
      console.log(`No non-penalty results found for ${packageName} version ${selectedVersion}.`);
      return;
    }

    const repos = uniq(versionMatches.map(r => r.repoKey));
    const repoList = repos.map((r, i) => `${i + 1}. ${r}`).join("\n");

    const repoChoice = clean(prompt(`Select repository by number:\n${repoList}`, "1"));
    if (!repoChoice) { console.log("Repository not selected."); return; }

    let selectedRepo = "";
    if (/^\d+$/.test(repoChoice)) {
      const idx = Number(repoChoice) - 1;
      selectedRepo = repos[idx] || "";
    } else {
      selectedRepo = repoChoice;
    }

    if (!selectedRepo || !repos.includes(selectedRepo)) {
      console.log("Invalid repository selection.");
      return;
    }

    const repoMatches = versionMatches.filter(r => r.repoKey === selectedRepo);
    const chosen =
      repoMatches.find(r => !/\.json$/i.test(r.name || "")) ||
      repoMatches[0];

    if (!chosen) { console.log("No artifact found for selected repository."); return; }

    const generalRes = await fetch("/ui/api/v1/ui/artifactgeneral", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json, */*",
        "X-Requested-With": "XMLHttpRequest"
      },
      body: JSON.stringify({
        path: chosen.relativePath,
        repoKey: chosen.repoKey,
        type: "file"
      })
    });

    if (!generalRes.ok) {
      throw new Error(`artifactgeneral failed: HTTP ${generalRes.status} ${generalRes.statusText}`);
    }

    const generalData = await generalRes.json();
    const info = generalData.info || {};

    const xrayUrl = `/ui/api/v1/ui/artifactxray?path=${encodeURIComponent(chosen.relativePath)}&repoKey=${encodeURIComponent(chosen.repoKey)}`;
    const xrayRes = await fetch(xrayUrl, {
      method: "GET",
      credentials: "include",
      headers: {
        "Accept": "application/json, text/plain, */*",
        "X-Requested-With": "XMLHttpRequest"
      }
    });

    if (!xrayRes.ok) {
      throw new Error(`artifactxray failed: HTTP ${xrayRes.status} ${xrayRes.statusText}`);
    }

    const xrayData = await xrayRes.json();

    const pkgType = inferPackageType(
      chosen.repoKey,
      info.name || chosen.name,
      chosen.relativePath,
      info.moduleID
    );
    const packageId = inferPackageId(pkgType, packageName);
    const repoPath = info.repositoryPath || `${chosen.repoKey}/${chosen.relativePath}`;

    const issuesPayload = {
      package_id: packageId,
      path: repoPath,
      version: selectedVersion,
      scanType: "repositories",
      issue_kind: 0,
      key: "",
      multiScanId: "",
      isGitRepoMultiscan: false
    };

    const severityOrder = ["critical", "high", "medium", "low"];
    let selectedIssue = null;
    let selectedSeverity = "NOT_FOUND";

    for (const sev of severityOrder) {
      const issue = await fetchIssuesBySeverity(issuesPayload, sev);
      if (issue) {
        selectedIssue = issue;
        selectedSeverity = clean(issue.severity) || sev.toUpperCase();
        break;
      }
    }

    const selectedCVE = selectedIssue ? extractBestCVE(selectedIssue) : "NOT_FOUND";

    // ── Latest version suggestion ─────────────────────────────────────────
    const latestVersion = versions[versions.length - 1];
    let latestSuggestion = "";

    if (selectedVersion !== latestVersion) {
      const latestMatches = versioned
        .filter(x => x.version === latestVersion)
        .map(x => x.item);

      const latestChosen =
        latestMatches.find(r => r.repoKey === selectedRepo && !/\.json$/i.test(r.name || "")) ||
        latestMatches.find(r => r.repoKey === selectedRepo) ||
        latestMatches.find(r => !/\.json$/i.test(r.name || "")) ||
        latestMatches[0];

      if (latestChosen) {
        try {
          const latestGeneralRes = await fetch("/ui/api/v1/ui/artifactgeneral", {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
              "Accept": "application/json, */*",
              "X-Requested-With": "XMLHttpRequest"
            },
            body: JSON.stringify({
              path: latestChosen.relativePath,
              repoKey: latestChosen.repoKey,
              type: "file"
            })
          });

          const latestGeneralData = latestGeneralRes.ok ? await latestGeneralRes.json() : {};
          const latestInfo = latestGeneralData.info || {};

          const latestPkgType = inferPackageType(
            latestChosen.repoKey,
            latestInfo.name || latestChosen.name,
            latestChosen.relativePath,
            latestInfo.moduleID
          );
          const latestPackageId = inferPackageId(latestPkgType, packageName);
          const latestRepoPath = latestInfo.repositoryPath || `${latestChosen.repoKey}/${latestChosen.relativePath}`;

          const latestIssuesPayload = {
            package_id: latestPackageId,
            path: latestRepoPath,
            version: latestVersion,
            scanType: "repositories",
            issue_kind: 0,
            key: "",
            multiScanId: "",
            isGitRepoMultiscan: false
          };

          let latestIssue = null;
          let latestSeverity = "NOT_FOUND";

          for (const sev of severityOrder) {
            const issue = await fetchIssuesBySeverity(latestIssuesPayload, sev);
            if (issue) {
              latestIssue = issue;
              latestSeverity = clean(issue.severity) || sev.toUpperCase();
              break;
            }
          }

          const latestCVE = latestIssue ? extractBestCVE(latestIssue) : "NOT_FOUND";

          latestSuggestion =
            `\n[!] Newer version available in JFrog: ${latestVersion}` +
            `\n    Severity : ${latestSeverity}` +
            `\n    CVE      : ${latestCVE}`;
        } catch (_) {
          latestSuggestion =
            `\n[!] Newer version available in JFrog: ${latestVersion}` +
            `\n    (Could not fetch vulnerability info for latest version)`;
        }
      }
    }

    const jfrogOutput = `Package: ${packageName}
Version: ${selectedVersion}
Repository: ${chosen.repoKey || "NOT_FOUND"}
Path: ${chosen.relativePath || "NOT_FOUND"}
Severity: ${selectedSeverity}
CVE: ${selectedCVE}${latestSuggestion}`;

    // ── Combined Output ───────────────────────────────────────────────────

    const separator = "─".repeat(50);
    const combinedOutput = [
      "===== PENALTY CHECK =====",
      penaltyOutput,
      separator,
      "===== JFROG VULNERABILITY CHECK =====",
      jfrogOutput
    ].join("\n");

    console.log(combinedOutput);
    console.log("artifactgeneral response:", generalData);
    console.log("artifactxray response:", xrayData);
    if (selectedIssue) console.log("selected issue:", selectedIssue);

    await copyText(combinedOutput);

  } catch (err) {
    console.error("Request failed:", err);
  }
})();
