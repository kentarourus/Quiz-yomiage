/**
 * ABC早押しクイズ 自動読み上げアプリ メインコントローラー (app.js)
 * Solo Mobile-First 決定版
 */
document.addEventListener("DOMContentLoaded", () => {
  // 状態変数
  let soloState = "idle"; // "idle" | "reading" | "buzzed" | "answer_shown"
  let isBuzzed = false;
  let currentBuzzIndex = -1;

  // DOM要素の参照取得
  const elements = {
    // Header & Actions
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

    // 問題データが無い場合、http://qss.quiz-island.site/abcgo-gacha/ から自動取得
    if (!questionManager.questions || questionManager.questions.length === 0) {
      await refreshAbc100Questions(false);
    } else {
      renderCurrentQuestion();
    }
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
    elements.btnPlay.classList.add("hidden");
    elements.btnBuzz.classList.add("hidden");
    elements.choiceContainer.classList.add("hidden");
    elements.nextContainer.classList.add("hidden");

    if (soloState === "idle") {
      elements.stepBadge.textContent = "STEP 1";
      elements.stepText.textContent = "「読み上げ開始」を押して音声を再生してください";
      elements.btnPlay.classList.remove("hidden");
      elements.speechStatus.textContent = "待機中";
      elements.speechStatus.className = "status-indicator ready";
    } else if (soloState === "reading") {
      elements.stepBadge.textContent = "STEP 2";
      elements.stepText.textContent = "🔊 音声読み上げ中... タイミングよく「早押し！」を押してください";
      elements.btnBuzz.classList.remove("hidden");
      elements.speechStatus.textContent = "読み上げ中...";
      elements.speechStatus.className = "status-indicator playing";
    } else if (soloState === "buzzed") {
      elements.stepBadge.textContent = "STEP 3";
      elements.stepText.textContent = "⚡ 早押し！ 「パス (最初から読み直す)」 または 「回答を表示」 を選択してください";
      elements.choiceContainer.classList.remove("hidden");
      elements.speechStatus.textContent = "⚡ 早押し停止中";
      elements.speechStatus.className = "status-indicator buzzed";
    } else if (soloState === "answer_shown") {
      elements.stepBadge.textContent = "STEP 4";
      elements.stepText.textContent = "正解を表示しました。「次の問題へ」を押すと次の問題に進みます";
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
    const qData = questionManager.getCurrentQuestion();
    if (qData) {
      renderFullQuestionText();
    }
    startSoloReading();
  }

  function handleShowAnswer() {
    soundEngine.playCorrect();
    soloState = "answer_shown";
    updateSoloUI();
  }

  function handleNextQuestion() {
    questionManager.nextQuestion();
    renderCurrentQuestion();
  }

  // ----------------------------------------------------
  // 問題レンダリング
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
    elements.questionTextBox.textContent = qData.q;
    elements.answerText.textContent = qData.a;
    elements.answerBox.classList.add("hidden");

    elements.buzzMarkerInfo.classList.add("hidden");
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
    const rest = text.substring(charIndex);

    elements.questionTextBox.innerHTML = `<span class="speech-highlight">${escapeHtml(spoken)}</span>${escapeHtml(rest)}`;
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

    elements.questionTextBox.innerHTML = 
      `<span class="speech-highlight">${escapeHtml(beforeBuzz)}</span>` +
      `<span class="buzz-slash">/</span>` +
      `<span>${escapeHtml(afterBuzz)}</span>`;

    elements.buzzMarkerInfo.classList.remove("hidden");
    elements.buzzPositionText.textContent = `「${beforeBuzz}」の直後（第${buzzIdx}文字目）で早押ししました！`;
  }

  // ----------------------------------------------------
  // ABCガチャ (http://qss.quiz-island.site/abcgo-gacha/) からの取得
  // ----------------------------------------------------
  async function refreshAbc100Questions(showConfirm = true) {
    if (showConfirm && !confirm("http://qss.quiz-island.site/abcgo-gacha/ から100問を新しく取得しますか？\n（現在の問題リストは置き換わります）")) {
      return;
    }

    const btn = elements.btnRefreshGacha;
    if (btn) {
      btn.disabled = true;
      btn.textContent = "⏳ ガチャ取得中...";
    }

    try {
      const res = await questionManager.fetchAbcQuestionsFromGacha();
      renderCurrentQuestion();

      if (showConfirm) {
        if (res && res.success) {
          alert(`http://qss.quiz-island.site/abcgo-gacha/ から100問を取得しました！`);
        } else {
          alert(`オンライン取得に失敗したため、オフライン用の過去問データ(100問)をセットしました。`);
        }
      }
    } catch (e) {
      console.error("Error fetching gacha questions:", e);
      if (showConfirm) {
        alert("問題の取得中にエラーが発生しました。");
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = "🎲 ガチャ100問更新";
      }
    }
  }

  // ----------------------------------------------------
  // イベントリスナー設定
  // ----------------------------------------------------
  function setupEventListeners() {
    elements.btnRefreshGacha.addEventListener("click", () => refreshAbc100Questions(true));

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
