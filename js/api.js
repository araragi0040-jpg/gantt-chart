window.KoujiApi = (() => {
  const STORAGE_KEY = "kouji_gantt_manager_state_v1";
  const GAS_URL_KEY = "kouji_gantt_gas_url";

  function loadGasUrl() {
    return localStorage.getItem(GAS_URL_KEY) || "";
  }

  function saveGasUrl(url) {
    localStorage.setItem(GAS_URL_KEY, url || "");
  }

  function loadLocalState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return {
        projects: (parsed.projects || []).map(KoujiUtils.normalizeProject),
        tasks: (parsed.tasks || []).map(KoujiUtils.normalizeTask),
        changeLogs: parsed.changeLogs || [],
      };
    } catch (error) {
      console.warn("localStorageの読み込みに失敗しました", error);
      return null;
    }
  }

  function saveLocalState(state) {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        projects: state.projects,
        tasks: state.tasks,
        changeLogs: state.changeLogs || [],
        savedAt: new Date().toISOString(),
      })
    );
  }

  function loadSampleState() {
    return {
      projects: window.SAMPLE_DATA.projects.map(KoujiUtils.normalizeProject),
      tasks: window.SAMPLE_DATA.tasks.map(KoujiUtils.normalizeTask),
      changeLogs: [],
    };
  }

  async function fetchFromGas(gasUrl) {
    if (!gasUrl) throw new Error("GAS URLが未設定です。");
    const url = new URL(gasUrl);
    url.searchParams.set("action", "loadAll");
    const response = await fetch(url.toString(), { method: "GET" });
    if (!response.ok) {
      throw new Error(`GAS読込に失敗しました: ${response.status}`);
    }
    const data = await response.json();
    if (!data.ok) throw new Error(data.message || "GAS読込に失敗しました。");
    return {
      projects: (data.projects || []).map(KoujiUtils.normalizeProject),
      tasks: (data.tasks || []).map(KoujiUtils.normalizeTask),
      changeLogs: data.changeLogs || [],
    };
  }

  async function saveToGas(gasUrl, state) {
    if (!gasUrl) throw new Error("GAS URLが未設定です。");
    const payload = {
      action: "saveAll",
      projects: state.projects,
      tasks: state.tasks,
      changeLogs: state.changeLogs || [],
    };

    // GASのWebアプリはプリフライトを避けるため text/plain で送る。
    const response = await fetch(gasUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`GAS保存に失敗しました: ${response.status}`);
    }
    const data = await response.json();
    if (!data.ok) throw new Error(data.message || "GAS保存に失敗しました。");
    return data;
  }

  return {
    loadGasUrl,
    saveGasUrl,
    loadLocalState,
    saveLocalState,
    loadSampleState,
    fetchFromGas,
    saveToGas,
  };
})();
