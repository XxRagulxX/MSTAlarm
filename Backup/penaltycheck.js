(async function () {
  function clean(s) {
    return (s || "").toString().replace(/\s+/g, " ").trim();
  }

  function eqIgnoreCase(a, b) {
    return clean(a).toLowerCase() === clean(b).toLowerCase();
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      console.log("Copied to clipboard.");
    } catch (e) {
      console.log("Could not copy automatically. Output is in console.");
    }
  }

  const virtualRepo = clean(prompt("Enter Virtual Repo", "pharmacy-fulfillment-npm-virtual"));
  if (!virtualRepo) {
    console.log("Virtual Repo not provided.");
    return;
  }

  const penaltyName = clean(prompt("Enter Penalty Name", "penalty-APPSVC046983-npm-local"));
  if (!penaltyName) {
    console.log("Penalty name not provided.");
    return;
  }

  try {
    // 1) Check selectedRepos from repositories/info
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

    const repo = rows[0] || {};
    const selectedRepos = Array.isArray(repo.selectedRepos) ? repo.selectedRepos : [];
    const packageType = clean(repo.packageType || "Npm");

    let matchedSelected = selectedRepos.find(x => eqIgnoreCase(x, penaltyName)) || "";

    let matchedAvailableLocal = "";
    let matchedAvailableFederated = "";
    let matchedAvailableVirtual = "";
    let matchedAvailableRemote = "";

    // 2) If not found in selectedRepos, check available repos
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

      const availableLocalRepos = Array.isArray(availData?.availableLocalRepos) ? availData.availableLocalRepos : [];
      const availableFederatedRepos = Array.isArray(availData?.availableFederatedRepos) ? availData.availableFederatedRepos : [];
      const availableVirtualRepos = Array.isArray(availData?.availableVirtualRepos) ? availData.availableVirtualRepos : [];
      const availableRemoteRepos = Array.isArray(availData?.availableRemoteRepos) ? availData.availableRemoteRepos : [];

      matchedAvailableLocal = availableLocalRepos.find(x => eqIgnoreCase(x, penaltyName)) || "";
      matchedAvailableFederated = availableFederatedRepos.find(x => eqIgnoreCase(x, penaltyName)) || "";
      matchedAvailableVirtual = availableVirtualRepos.find(x => eqIgnoreCase(x, penaltyName)) || "";
      matchedAvailableRemote = availableRemoteRepos.find(x => eqIgnoreCase(x, penaltyName)) || "";
    }

    const presentInSelected = !!matchedSelected;
    const presentInAvailable =
      !!matchedAvailableLocal ||
      !!matchedAvailableFederated ||
      !!matchedAvailableVirtual ||
      !!matchedAvailableRemote;

    let status = "Not Present";
    if (presentInSelected) status = "Present in selectedRepos";
    else if (presentInAvailable) status = "Present in available repositories, but not selected";

    const matchedValue =
      matchedSelected ||
      matchedAvailableLocal ||
      matchedAvailableFederated ||
      matchedAvailableVirtual ||
      matchedAvailableRemote ||
      "NOT_FOUND";

    let foundIn = "NOT_FOUND";
    if (matchedSelected) foundIn = "selectedRepos";
    else if (matchedAvailableLocal) foundIn = "availableLocalRepos";
    else if (matchedAvailableFederated) foundIn = "availableFederatedRepos";
    else if (matchedAvailableVirtual) foundIn = "availableVirtualRepos";
    else if (matchedAvailableRemote) foundIn = "availableRemoteRepos";

    const output = `Virtual Repo: ${virtualRepo}
Penalty Name Input: ${penaltyName}
Matched Value: ${matchedValue}
Found In: ${foundIn}
Status: ${status}`;

    console.log(output);
    await copyText(output);
  } catch (err) {
    console.error("Request failed:", err);
  }
})();
