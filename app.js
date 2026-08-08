/**
 * ABC早押しクイズ 自動読み上げアプリ メインコントローラー (app.js)
 * Solo Mobile-First & リアルタイム文字表示対応
 */
document.addEventListener("DOMContentLoaded", () => {
  // 状態変数
  let soloState = "idle"; // "idle" | "reading" | "buzzed" | "answer_shown"
  let isBuzzed = false;
  let currentBuzzIndex = -1;

  // 表示モード ("realtime" | "hidden" | "visible")
  let textDisplayMode = localStorage.getItem("quiz_yomiage_text_mode") || "realtime";
  
  // 問題データソース ("gacha" | "jaqket" | "abc_dataset")
  let questionSource = localStorage.getItem("quiz_yomiage_q_source") || "gacha";

  // DOM要素の参照取得
  const elements = {
    // Header & Actions
    selectQSource: document.getElementById("select-q-source"),
    btnRefreshGacha: document.getElementById("btn-refresh-gacha"),
    btnToggleSettings: document.getElementById("btn-toggle-settings"),
    settingsModal: document.getElementById("settings-modal"),
    btnCloseSettings: document.getElementById("btn-close-settings"),

    // Info Bar
    currentQNum: document.getElementById("current-q-num"),
    maxQNum: document.getElementById("max-q-num"),
    qGenreTag: document.getElementById("q-genre-tag"),
    btnPrevQ: document.getElementById("btn-prev-q"),
    btnNextQ: document.getElementById("btn-next-q"),
    qSelectDropdown: document.getElementById("q-select-dropdown"),

    // Question Box & Answer Box
    speechStatus: document.getElementById("speech-status"),
    questionTextBox: document.getElementById("question-text-box"),
    buzzMarkerInfo: document.getElementById("buzz-marker-info"),
    buzzPositionText: document.getElementById("buzz-position-text"),
    answerBox: document.getElementById("answer-box"),
    answerText: document.getElementById("answer-text"),

    // Action Stage Elements
    circleButtonContainer: document.getElementById("circle-button-container"),
    stepBadge: document.getElementById("step-badge"),
    stepText: document.getElementById("step-text"),
    btnPlay: document.getElementById("btn-play"),
    btnBuzz: document.getElementById("btn-buzz"),
    choiceContainer: document.getElementById("choice-container"),
    btnPass: document.getElementById("btn-pass"),
    btnShowAnswer: document.getElementById("btn-show-answer"),
    nextContainer: document.getElementById("next-container"),
    btnNextSolo: document.getElementById("btn-next-solo"),
    btnReread: document.getElementById("btn-reread"),

    // Settings Controls
    selectQSourceModal: document.getElementById("select-q-source-modal"),
    selectTextMode: document.getElementById("select-text-mode"),
    selectVoice: document.getElementById("select-voice"),
    rangeRate: document.getElementById("range-rate"),
    rateValue: document.getElementById("rate-value"),
    rangePitch: document.getElementById("range-pitch"),
    pitchValue: document.getElementById("pitch-value"),
    btnTestSpeech: document.getElementById("btn-test-speech")
  };

  // 初期化関数
  async function init() {
    setupSpeechCallbacks();
    setupEventListeners();
    setupKeyboardShortcuts();

    populateVoiceList();

    // 表示モード & データソース ドロップダウンの初期化
    if (elements.selectTextMode) {
      elements.selectTextMode.value = textDisplayMode;
    }
    if (elements.selectQSource) {
      elements.selectQSource.value = questionSource;
    }
    if (elements.selectQSourceModal) {
      elements.selectQSourceModal.value = questionSource;
    }

    // 起動時に選択されたデータソースから100問を取得
    await refreshQuestionsBySource(false);
  }

  // ----------------------------------------------------
  // SpeechEngine イベント連携
  // ----------------------------------------------------
  function setupSpeechCallbacks() {
    speechEngine.onStart = () => {
      elements.speechStatus.textContent = "読み上げ中...";
      elements.speechStatus.className = "status-indicator playing";
    };

    speechEngine.onBoundary = (charIndex) => {
      if (!isBuzzed) {
        highlightQuestionText(charIndex);
      }
    };

    speechEngine.onEnd = () => {
      if (!isBuzzed) {
        elements.speechStatus.textContent = "読み上げ完了";
        elements.speechStatus.className = "status-indicator ready";
        renderFullQuestionText();

        if (soloState === "reading") {
          soloState = "buzzed";
          updateSoloUI();
        }
      }
    };

    speechEngine.onStop = () => {
      if (!isBuzzed) {
        elements.speechStatus.textContent = "停止";
        elements.speechStatus.className = "status-indicator ready";
      }
    };
  }

  // ----------------------------------------------------
  // UI 状態制御 (State Machine)
  // ----------------------------------------------------
  function resetSoloState() {
    soloState = "idle";
    isBuzzed = false;
    currentBuzzIndex = -1;
    speechEngine.stop();

    elements.buzzMarkerInfo.classList.add("hidden");
    elements.answerBox.classList.add("hidden");

    updateSoloUI();
  }

  function updateSoloUI() {
    if (elements.circleButtonContainer) elements.circleButtonContainer.classList.add("hidden");
    elements.btnPlay.classList.add("hidden");
    elements.btnBuzz.classList.add("hidden");
    elements.choiceContainer.classList.add("hidden");
    elements.nextContainer.classList.add("hidden");

    if (soloState === "idle") {
      if (elements.circleButtonContainer) elements.circleButtonContainer.classList.remove("hidden");
      elements.stepBadge.textContent = "STEP 1";
      elements.stepText.textContent = "「読み上げ開始」を押して音声を再生してください";
      elements.btnPlay.classList.remove("hidden");
      elements.speechStatus.textContent = "待機中";
      elements.speechStatus.className = "status-indicator ready";
    } else if (soloState === "reading") {
      if (elements.circleButtonContainer) elements.circleButtonContainer.classList.remove("hidden");
      elements.stepBadge.textContent = "STEP 2";
      elements.stepText.textContent = "🔊 音声読み上げ中... タイミングよく「ボタン」を押してください";
      elements.btnBuzz.classList.remove("hidden");
      elements.speechStatus.textContent = "読み上げ中...";
      elements.speechStatus.className = "status-indicator playing";
    } else if (soloState === "buzzed") {
      elements.stepBadge.textContent = "STEP 3";
      elements.stepText.textContent = "⚡ 早押し！ 「読み直し」 または 「回答表示」 を選択してください";
      elements.choiceContainer.classList.remove("hidden");
      elements.speechStatus.textContent = "⚡ 早押し停止中";
      elements.speechStatus.className = "status-indicator buzzed";
    } else if (soloState === "answer_shown") {
      elements.stepBadge.textContent = "STEP 4";
      elements.stepText.textContent = "正解を表示しました。「次の問題」を押すと次の問題に進みます";
      elements.nextContainer.classList.remove("hidden");
      elements.answerBox.classList.remove("hidden");
      elements.speechStatus.textContent = "解答表示中";
      elements.speechStatus.className = "status-indicator ready";
    }
  }

  // ----------------------------------------------------
  // アクションハンドラー
  // ----------------------------------------------------
  function startSoloReading() {
    soundEngine.init();
    const qData = questionManager.getCurrentQuestion();
    if (!qData) return;

    resetSoloState();
    soloState = "reading";
    updateSoloUI();
    speechEngine.speak(qData.q);
  }

  function triggerBuzzSolo() {
    if (soloState !== "reading") return;

    soundEngine.init();
    soundEngine.playBuzz();

    if (speechEngine.isPlaying) {
      currentBuzzIndex = speechEngine.buzzStop();
    } else {
      currentBuzzIndex = speechEngine.currentCharIndex || 0;
    }

    isBuzzed = true;
    renderBuzzedQuestionText(currentBuzzIndex);

    soloState = "buzzed";
    updateSoloUI();
  }

  function handlePass() {
    // パスが選ばれたら最初から読み直す
    elements.buzzMarkerInfo.classList.add("hidden");
    startSoloReading();
  }

  function handleShowAnswer() {
    soundEngine.playCorrect();
    soloState = "answer_shown";
    renderFullQuestionText(); // 全文を表示
    updateSoloUI();
  }

  function handleNextQuestion() {
    questionManager.nextQuestion();
    renderCurrentQuestion();
  }

  // ----------------------------------------------------
  // 問題レンダリング & リアルタイム表示
  // ----------------------------------------------------
  function renderCurrentQuestion() {
    speechEngine.stop();
    isBuzzed = false;
    currentBuzzIndex = -1;

    const qData = questionManager.getCurrentQuestion();
    const total = questionManager.questions.length;
    const currentIdx = questionManager.currentIndex;

    elements.maxQNum.textContent = total;
    elements.currentQNum.textContent = total > 0 ? currentIdx + 1 : 0;

    updateDropdownList();

    if (!qData) {
      elements.questionTextBox.innerHTML = '<span class="placeholder-text">問題がありません。「ガチャ100問更新」を押してください。</span>';
      elements.answerText.textContent = "----";
      elements.qGenreTag.textContent = "なし";
      return;
    }

    elements.qGenreTag.textContent = qData.genre || "ABC過去問";
    elements.answerText.textContent = qData.a;
    elements.answerBox.classList.add("hidden");
    elements.buzzMarkerInfo.classList.add("hidden");

    // 表示モードに合わせた初期メッセージ・テキスト表示
    if (textDisplayMode === "realtime") {
      elements.questionTextBox.innerHTML = '<span class="placeholder-text">「読み上げ開始」を押すと、音声に合わせて文字が表示されます</span>';
    } else if (textDisplayMode === "hidden") {
      elements.questionTextBox.innerHTML = '<span class="placeholder-text">「読み上げ開始」を押すと音声が再生されます（問題文は早押しまで非表示）</span>';
    } else {
      elements.questionTextBox.textContent = qData.q;
    }

    resetSoloState();
  }

  function updateDropdownList() {
    elements.qSelectDropdown.innerHTML = "";
    questionManager.questions.forEach((q, idx) => {
      const opt = document.createElement("option");
      opt.value = idx;
      opt.textContent = `${idx + 1}. ${q.q.substring(0, 14)}...`;
      if (idx === questionManager.currentIndex) {
        opt.selected = true;
      }
      elements.qSelectDropdown.appendChild(opt);
    });
  }

  function highlightQuestionText(charIndex) {
    const qData = questionManager.getCurrentQuestion();
    if (!qData) return;

    const text = qData.q;
    const spoken = text.substring(0, charIndex);
    const unspoken = text.substring(charIndex);

    if (textDisplayMode === "realtime") {
      // 読み上げられた位置までの文字のみ即時表示、未読文字はマスク
      const maskedCount = Math.min(unspoken.length, 12);
      const maskedStr = "❓".repeat(maskedCount);
      elements.questionTextBox.innerHTML = 
        `<span class="speech-highlight">${escapeHtml(spoken)}</span>` +
        `<span class="text-masked">${maskedStr}</span>`;
    } else if (textDisplayMode === "hidden") {
      elements.questionTextBox.innerHTML = `<span class="text-masked-all">🔊 読み上げ中... (${charIndex}文字目)</span>`;
    } else {
      // visible (最初から全表示)
      elements.questionTextBox.innerHTML = 
        `<span class="speech-highlight">${escapeHtml(spoken)}</span>` +
        `<span>${escapeHtml(unspoken)}</span>`;
    }
  }

  function renderFullQuestionText() {
    const qData = questionManager.getCurrentQuestion();
    if (qData) {
      elements.questionTextBox.textContent = qData.q;
    }
  }

  function renderBuzzedQuestionText(buzzIdx) {
    const qData = questionManager.getCurrentQuestion();
    if (!qData) return;

    const text = qData.q;
    const beforeBuzz = text.substring(0, buzzIdx);
    const afterBuzz = text.substring(buzzIdx);

    if (textDisplayMode === "realtime" || textDisplayMode === "hidden") {
      const maskedCount = Math.min(afterBuzz.length, 12);
      const maskedStr = "❓".repeat(maskedCount);
      elements.questionTextBox.innerHTML = 
        `<span class="speech-highlight">${escapeHtml(beforeBuzz)}</span>` +
        `<span class="buzz-slash">/</span>` +
        `<span class="text-masked">${maskedStr}</span>`;
    } else {
      elements.questionTextBox.innerHTML = 
        `<span class="speech-highlight">${escapeHtml(beforeBuzz)}</span>` +
        `<span class="buzz-slash">/</span>` +
        `<span>${escapeHtml(afterBuzz)}</span>`;
    }

    elements.buzzMarkerInfo.classList.remove("hidden");
    elements.buzzPositionText.textContent = `「${beforeBuzz}」の直後（第${buzzIdx}文字目）で早押し！`;
  }

  // ----------------------------------------------------
  // 問題データ取得 (ソース選択対応: ABCガチャ / JAQKET / ABC過去問)
  // ----------------------------------------------------
  async function refreshQuestionsBySource(showConfirm = true) {
    if (showConfirm && !confirm("選択したデータソースから100問を新しく取得しますか？\n（現在の問題リストは置き換わります）")) {
      return;
    }

    const btn = elements.btnRefreshGacha;
    if (btn) {
      btn.disabled = true;
      btn.textContent = "⏳ 取得中...";
    }

    try {
      let res = null;
      if (questionSource === "jaqket") {
        elements.questionTextBox.innerHTML = '<span class="placeholder-text">⏳ JAQKETデータセット(1.3万問)から抽出中...</span>';
        res = await questionManager.fetchJaqketQuestions(100);
      } else if (questionSource === "gacha") {
        elements.questionTextBox.innerHTML = '<span class="placeholder-text">⏳ http://qss.quiz-island.site/abcgo-gacha/ から100問を取得中...</span>';
        res = await questionManager.fetchAbcQuestionsFromGacha();
      } else {
        questionManager.loadAbcRandomQuestions(100);
        res = { success: true, source: "ABC過去問 (100問)" };
      }

      renderCurrentQuestion();

      if (showConfirm) {
        if (res && res.success) {
          const srcName = questionSource === "jaqket" ? "JAQKETデータセット(1.3万問)" : questionSource === "gacha" ? "ABCガチャ" : "ABC過去問";
          alert(`「${srcName}」から100問をセットしました！`);
        }
      }
    } catch (e) {
      console.error("Error refreshing questions:", e);
      if (showConfirm) {
        alert("問題の取得中にエラーが発生しました。");
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "問題取得";
      }
    }
  }

  // ----------------------------------------------------
  // イベントリスナー設定
  // ----------------------------------------------------
  function setupEventListeners() {
    elements.btnRefreshGacha.addEventListener("click", () => refreshQuestionsBySource(true));

    const handleSourceChange = (e) => {
      questionSource = e.target.value;
      localStorage.setItem("quiz_yomiage_q_source", questionSource);
      if (elements.selectQSource) elements.selectQSource.value = questionSource;
      if (elements.selectQSourceModal) elements.selectQSourceModal.value = questionSource;
      refreshQuestionsBySource(false);
    };

    if (elements.selectQSource) elements.selectQSource.addEventListener("change", handleSourceChange);
    if (elements.selectQSourceModal) elements.selectQSourceModal.addEventListener("change", handleSourceChange);

    elements.btnToggleSettings.addEventListener("click", () => {
      elements.settingsModal.classList.remove("hidden");
    });
    elements.btnCloseSettings.addEventListener("click", () => {
      elements.settingsModal.classList.add("hidden");
    });

    elements.btnPlay.addEventListener("click", startSoloReading);
    elements.btnBuzz.addEventListener("click", triggerBuzzSolo);
    elements.btnPass.addEventListener("click", handlePass);
    elements.btnShowAnswer.addEventListener("click", handleShowAnswer);
    elements.btnNextSolo.addEventListener("click", handleNextQuestion);
    elements.btnReread.addEventListener("click", handlePass);

    elements.qSelectDropdown.addEventListener("change", (e) => {
      questionManager.setQuestionIndex(parseInt(e.target.value));
      renderCurrentQuestion();
    });

    elements.btnPrevQ.addEventListener("click", () => {
      questionManager.prevQuestion();
      renderCurrentQuestion();
    });

    elements.btnNextQ.addEventListener("click", () => {
      questionManager.nextQuestion();
      renderCurrentQuestion();
    });

    // 設定要素コントロール
    elements.selectTextMode.addEventListener("change", (e) => {
      textDisplayMode = e.target.value;
      localStorage.setItem("quiz_yomiage_text_mode", textDisplayMode);
      renderCurrentQuestion();
    });

    elements.rangeRate.addEventListener("input", (e) => {
      const val = e.target.value;
      elements.rateValue.textContent = `${val}x`;
      speechEngine.setRate(val);
    });

    elements.rangePitch.addEventListener("input", (e) => {
      const val = e.target.value;
      elements.pitchValue.textContent = val;
      speechEngine.setPitch(val);
    });

    elements.selectVoice.addEventListener("change", (e) => {
      speechEngine.setVoice(e.target.value);
    });

    elements.btnTestSpeech.addEventListener("click", () => {
      soundEngine.init();
      speechEngine.speak("これは早押しクイズ自動読み上げ機能のテストです。");
    });
  }

  function setupKeyboardShortcuts() {
    window.addEventListener("keydown", (e) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        if (soloState === "idle") {
          startSoloReading();
        } else if (soloState === "reading") {
          triggerBuzzSolo();
        } else if (soloState === "answer_shown") {
          handleNextQuestion();
        }
      } else if (e.code === "Enter") {
        e.preventDefault();
        if (soloState === "idle") {
          startSoloReading();
        } else if (soloState === "buzzed") {
          handleShowAnswer();
        } else if (soloState === "answer_shown") {
          handleNextQuestion();
        }
      } else if (e.code === "KeyP" || e.code === "Digit1" || e.code === "Numpad1") {
        if (soloState === "buzzed") {
          handlePass();
        }
      } else if (e.code === "KeyA" || e.code === "Digit2" || e.code === "Numpad2") {
        if (soloState === "buzzed") {
          handleShowAnswer();
        }
      }
    });
  }

  function populateVoiceList() {
    setTimeout(() => {
      const voices = speechEngine.getJapaneseVoices();
      elements.selectVoice.innerHTML = "";

      if (voices.length === 0) {
        const opt = document.createElement("option");
        opt.textContent = "標準日本語ボイス";
        elements.selectVoice.appendChild(opt);
        return;
      }

      voices.forEach(voice => {
        const opt = document.createElement("option");
        opt.value = voice.voiceURI;
        opt.textContent = `${voice.name} (${voice.lang})`;
        if (speechEngine.selectedVoice && speechEngine.selectedVoice.voiceURI === voice.voiceURI) {
          opt.selected = true;
        }
        elements.selectVoice.appendChild(opt);
      });
    }, 300);
  }

  function escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  init();
});
