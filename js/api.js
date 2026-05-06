window.KoujiApi = (() => {
  const STORAGE_KEY = "kouji_gantt_manager_state_v1";
  const GAS_URL_KEY = "kouji_gantt_gas_url";

  function loadGasUrl() {
    return localStorage.getItem(GAS_URL_KEY) || "";
  }

  function saveGasUrl(url) {
    localStorage.setItem(GAS_URL_KEY, (url || "").trim());
  }

  function loadLocalState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);
      return normalizeState(parsed);
    } catch (error) {
      console.warn("localStorageの読み込みに失敗しました", error);
      return null;
    }
  }

  function saveLocalState(state) {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        projects: state.projects || [],
        tasks: state.tasks || [],
        changeLogs: state.changeLogs || [],
        savedAt: new Date().toISOString(),
      })
    );
  }

  function loadSampleState() {
    return normalizeState({
      projects: window.SAMPLE_DATA.projects,
      tasks: window.SAMPLE_DATA.tasks,
      changeLogs: [],
    });
  }

  async function fetchFromGas(gasUrl) {
    const baseUrl = normalizeGasUrl(gasUrl);
    const url = new URL(baseUrl);
    url.searchParams.set("action", "loadAll");
    url.searchParams.set("t", Date.now().toString());

    const response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
      redirect: "follow",
    });

    const data = await parseJsonResponse(response, "GAS読込");

    if (!data.ok) {
      throw new Error(data.message || "GAS読込に失敗しました。");
    }

    return normalizeState({
      projects: data.projects || [],
      tasks: data.tasks || [],
      changeLogs: data.changeLogs || [],
    });
  }

  async function saveToGas(gasUrl, state) {
    const baseUrl = normalizeGasUrl(gasUrl);
    const payload = {
      action: "saveAll",
      projects: state.projects || [],
      tasks: state.tasks || [],
      changeLogs: state.changeLogs || [],
    };

    // GASはapplication/jsonだと環境によってプリフライトで詰まりやすいため、text/plainで送る。
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(payload),
      redirect: "follow",
    });

    const data = await parseJsonResponse(response, "GAS保存");

    if (!data.ok) {
      throw new Error(data.message || "GAS保存に失敗しました。");
    }

    return data;
  }

  function normalizeState(state) {
    return {
      projects: (state.projects || []).map(KoujiUtils.normalizeProject),
      tasks: (state.tasks || []).map(KoujiUtils.normalizeTask),
      changeLogs: state.changeLogs || [],
    };
  }

  function normalizeGasUrl(gasUrl) {
    const url = (gasUrl || "").trim();
    if (!url) {
      throw new Error("GAS URLが未設定です。");
    }
    if (!url.startsWith("https://")) {
      throw new Error("GAS URLは https:// から始まるURLを指定してください。");
    }
    return url;
  }

  async function parseJsonResponse(response, label) {
    if (!response.ok) {
      throw new Error(`${label}に失敗しました: HTTP ${response.status}`);
    }

    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch (error) {
      console.error(`${label}レスポンス`, text);
      throw new Error(`${label}の返答をJSONとして読み取れませんでした。GASの公開設定とURLを確認してください。`);
    }
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
