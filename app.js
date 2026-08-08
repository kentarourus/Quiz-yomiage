/**
 * アプリケーションメインコントローラー (app.js)
 * プレイモード設定（ひとりで / みんなで）＆ スマホ連携対応版
 */
document.addEventListener("DOMContentLoaded", () => {
  // 状態変数
  let currentMode = localStorage.getItem("quiz_yomiage_mode") || "solo";
  let soloState = "idle"; // "idle" | "reading" | "buzzed" | "answer_shown"

  let isBuzzed = false;
  let timerInterval = null;
  let timerRemaining = 5;
  let timerTotal = 5;

  let score = 0;
  let correctCount = 0;
  let incorrectCount = 0;

  let correctPts = 100;
  let incorrectPts = 50;

  let currentBuzzIndex = -1;
  let currentBuzzedPlayer = "ホスト/キーボード";

  // BroadcastChannel スマホ連携設定
  let buzzChannel = null;
  if ("BroadcastChannel" in window) {
    buzzChannel = new BroadcastChannel("quiz_buzz_channel");
    buzzChannel.onmessage = (event) => {
      if (event.data && event.data.type === "BUZZ_EVENT") {
        if (currentMode === "solo") {
          triggerSoloBuzzSolo();
        } else {
          triggerBuzz(event.data.playerName || "スマホプレイヤー");
        }
      }
    };
  }

  // Storageイベント連携 (BroadcastChannel非対応ブラウザ用バックアップ)
  window.addEventListener("storage", (e) => {
    if (e.key === "quiz_latest_buzz" && e.newValue) {
      try {
        const data = JSON.parse(e.newValue);
        if (currentMode === "solo") {
          triggerSoloBuzzSolo();
        } else {
          triggerBuzz(data.playerName || "スマホプレイヤー");
        }
      } catch (err) {}
    }
  });

  // DOM要素の参照取得
  const elements = {
    // Header & Mode Switcher
    tabBtns: document.querySelectorAll(".tab-btn"),
    tabContents: document.querySelectorAll(".tab-content"),
    btnHeaderAbc: document.getElementById("btn-header-abc"),
    totalCountBadge: document.getElementById("total-count-badge"),
    btnOpenMode: document.getElementById("btn-open-mode"),
    modeSelectModal: document.getElementById("mode-select-modal"),
    btnChooseSolo: document.getElementById("btn-choose-solo"),
    btnChooseMulti: document.getElementById("btn-choose-multi"),
    tabModeSolo: document.getElementById("tab-mode-solo"),
    tabModeMulti: document.getElementById("tab-mode-multi"),

    // Stage Panels
    soloStagePanel: document.getElementById("solo-stage-panel"),
    multiStagePanel: document.getElementById("multi-stage-panel"),

    // Stage Info
    currentQNum: document.getElementById("current-q-num"),
    maxQNum: document.getElementById("max-q-num"),
    qGenreTag: document.getElementById("q-genre-tag"),
    btnPrevQ: document.getElementById("btn-prev-q"),
    btnNextQ: document.getElementById("btn-next-q"),
    qSelectDropdown: document.getElementById("q-select-dropdown"),

    // Stage Question Box
    speechStatus: document.getElementById("speech-status"),
    questionTextBox: document.getElementById("question-text-box"),
    buzzMarkerInfo: document.getElementById("buzz-marker-info"),
    buzzPositionText: document.getElementById("buzz-position-text"),

    // Answer Box
    btnToggleAnswer: document.getElementById("btn-toggle-answer"),
    answerText: document.getElementById("answer-text"),

    // Solo Mode Elements
    soloStepBadge: document.getElementById("solo-step-badge"),
    soloStepText: document.getElementById("solo-step-text"),
    btnSoloPlay: document.getElementById("btn-solo-play"),
    btnSoloBuzz: document.getElementById("btn-solo-buzz"),
    soloChoiceContainer: document.getElementById("solo-choice-container"),
    btnSoloPass: document.getElementById("btn-solo-pass"),
    btnSoloShowAnswer: document.getElementById("btn-solo-show-answer"),
    soloNextContainer: document.getElementById("solo-next-container"),
    btnSoloNext: document.getElementById("btn-solo-next"),
    btnSoloReread: document.getElementById("btn-solo-reread"),

    // Buzzer & Timer (Multiplayer)
    btnBuzz: document.getElementById("btn-buzz"),
    timerDisplay: document.getElementById("timer-display"),
    timerCount: document.getElementById("timer-count"),
    timerBarFill: document.getElementById("timer-bar-fill"),

    // Judge Buttons (Multiplayer)
    btnCorrect: document.getElementById("btn-correct"),
    btnIncorrect: document.getElementById("btn-incorrect"),
    btnThrough: document.getElementById("btn-through"),

    // Playback Toolbar (Multiplayer)
    btnPlay: document.getElementById("btn-play"),
    btnPause: document.getElementById("btn-pause"),
    btnStop: document.getElementById("btn-stop"),
    btnRestart: document.getElementById("btn-restart"),
    btnStageAbc: document.getElementById("btn-stage-abc"),

    // Bank Elements
    bankCountInfo: document.getElementById("bank-count-info"),
    btnBankAbc: document.getElementById("btn-bank-abc"),
    btnOpenAdd: document.getElementById("btn-open-add"),
    btnOpenImport: document.getElementById("btn-open-import"),
    btnShuffleBank: document.getElementById("btn-shuffle-bank"),
    btnClearBank: document.getElementById("btn-clear-bank"),
    questionTableBody: document.getElementById("question-table-body"),

    // Modals
    addModal: document.getElementById("add-modal"),
    inputAddQ: document.getElementById("input-add-q"),
    inputAddA: document.getElementById("input-add-a"),
    inputAddGenre: document.getElementById("input-add-genre"),
    btnSaveAdd: document.getElementById("btn-save-add"),
    btnCloseAdd: document.getElementById("btn-close-add"),

    importModal: document.getElementById("import-modal"),
    inputImportText: document.getElementById("input-import-text"),
    btnDoImport: document.getElementById("btn-do-import"),
    btnCloseImport: document.getElementById("btn-close-import"),

    // Settings Elements
    selectVoice: document.getElementById("select-voice"),
    rangeRate: document.getElementById("range-rate"),
    rateValue: document.getElementById("rate-value"),
    rangePitch: document.getElementById("range-pitch"),
    pitchValue: document.getElementById("pitch-value"),
    btnTestSpeech: document.getElementById("btn-test-speech"),
    selectTimerSec: document.getElementById("select-timer-sec"),
    inputCorrectPt: document.getElementById("input-correct-pt"),
    inputIncorrectPt: document.getElementById("input-incorrect-pt"),

    // Scoreboard
    playerScoreVal: document.getElementById("player-score-val"),
    statCorrectCount: document.getElementById("stat-correct-count"),
    statIncorrectCount: document.getElementById("stat-incorrect-count"),
    btnResetScores: document.getElementById("btn-reset-scores"),
    btnAdd100: document.getElementById("btn-add-100"),
    btnSub50: document.getElementById("btn-sub-50")
  };

  // 初期化関数
  async function init() {
    setupTabNavigation();
    setupSpeechCallbacks();
    setupEventListeners();
    setupKeyboardShortcuts();

    populateVoiceList();

    // モード設定の反映
    setMode(currentMode, false);

    // 保存データが無い場合、http://qss.quiz-island.site/abcgo-gacha/ から自動取得
    if (!questionManager.questions || questionManager.questions.length === 0) {
      await refreshAbc100Questions(false);
    } else {
      renderCurrentQuestion();
      renderQuestionBankTable();
    }

    updateScoreDisplay();

    // モード設定が保存されていない場合、選択モーダルを表示
    if (!localStorage.getItem("quiz_yomiage_mode")) {
      elements.modeSelectModal.classList.remove("hidden");
    }
  }

  // ----------------------------------------------------
  // モード切替制御 ("solo" | "multi")
  // ----------------------------------------------------
  function setMode(mode) {
    currentMode = mode;
    localStorage.setItem("quiz_yomiage_mode", mode);

    if (mode === "solo") {
      elements.tabModeSolo.classList.add("active");
      elements.tabModeMulti.classList.remove("active");
      elements.soloStagePanel.classList.remove("hidden");
      elements.multiStagePanel.classList.add("hidden");
      resetSoloState();
    } else {
      elements.tabModeSolo.classList.remove("active");
      elements.tabModeMulti.classList.add("active");
      elements.soloStagePanel.classList.add("hidden");
      elements.multiStagePanel.classList.remove("hidden");
      renderCurrentQuestion();
    }

    speechEngine.stop();
    stopTimer();
  }

  // ----------------------------------------------------
  // タブナビゲーション
  // ----------------------------------------------------
  function setupTabNavigation() {
    elements.tabBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const targetTab = btn.getAttribute("data-tab");
        elements.tabBtns.forEach(b => b.classList.remove("active"));
        elements.tabContents.forEach(c => c.classList.remove("active"));

        btn.classList.add("active");
        document.getElementById(targetTab).classList.add("active");

        if (targetTab === "bank-tab") {
          renderQuestionBankTable();
        }
      });
    });
  }

  // ----------------------------------------------------
  // SpeechEngine イベント連携
  // ----------------------------------------------------
  function setupSpeechCallbacks() {
    speechEngine.onStart = () => {
      elements.speechStatus.textContent = "読み上げ中...";
      elements.speechStatus.className = "status-indicator playing";
      elements.btnPlay.textContent = "⏸ 一時停止 (Spaceで早押し)";
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
        elements.btnPlay.textContent = "▶️ 読み上げ開始 (Space)";
        renderFullQuestionText();

        if (currentMode === "solo" && soloState === "reading") {
          soloState = "buzzed";
          updateSoloUI();
        }
      }
    };

    speechEngine.onStop = () => {
      if (!isBuzzed) {
        elements.speechStatus.textContent = "停止";
        elements.speechStatus.className = "status-indicator ready";
        elements.btnPlay.textContent = "▶️ 読み上げ開始 (Space)";
      }
    };
  }

  // ----------------------------------------------------
  // Solo モードの状態制御
  // ----------------------------------------------------
  function resetSoloState() {
    soloState = "idle";
    isBuzzed = false;
    currentBuzzIndex = -1;
    speechEngine.stop();
    elements.buzzMarkerInfo.classList.add("hidden");
    elements.answerText.classList.add("hidden");
    elements.btnToggleAnswer.textContent = "👁️ 正解を表示 (Enter)";
    updateSoloUI();
  }

  function updateSoloUI() {
    elements.btnSoloPlay.classList.add("hidden");
    elements.btnSoloBuzz.classList.add("hidden");
    elements.soloChoiceContainer.classList.add("hidden");
    elements.soloNextContainer.classList.add("hidden");

    if (soloState === "idle") {
      elements.soloStepBadge.textContent = "1. 再生待機";
      elements.soloStepText.textContent = "「読み上げ開始」ボタンを押して音声を再生してください";
      elements.btnSoloPlay.classList.remove("hidden");
      elements.speechStatus.textContent = "待機中";
      elements.speechStatus.className = "status-indicator ready";
    } else if (soloState === "reading") {
      elements.soloStepBadge.textContent = "2. 音声再生中";
      elements.soloStepText.textContent = "🔊 音声読み上げ中... タイミングよく「早押し！」ボタンを押してください";
      elements.btnSoloBuzz.classList.remove("hidden");
      elements.speechStatus.textContent = "読み上げ中...";
      elements.speechStatus.className = "status-indicator playing";
    } else if (soloState === "buzzed") {
      elements.soloStepBadge.textContent = "3. 早押し後";
      elements.soloStepText.textContent = "⚡ 早押し！ 「パス (最初から読み直す)」 または 「回答を表示」 を選択してください";
      elements.soloChoiceContainer.classList.remove("hidden");
      elements.speechStatus.textContent = "⚡ 早押し停止中";
      elements.speechStatus.className = "status-indicator buzzed";
    } else if (soloState === "answer_shown") {
      elements.soloStepBadge.textContent = "4. 解答表示中";
      elements.soloStepText.textContent = "正解を表示しました。「次の問題へ」を押すと次の問題に進みます";
      elements.soloNextContainer.classList.remove("hidden");
      elements.answerText.classList.remove("hidden");
      elements.btnToggleAnswer.textContent = "🙈 正解を隠す (Enter)";
      elements.speechStatus.textContent = "解答表示中";
      elements.speechStatus.className = "status-indicator ready";
    }
  }

  function startSoloReading() {
    soundEngine.init();
    const qData = questionManager.getCurrentQuestion();
    if (!qData) return;

    resetSoloState();
    soloState = "reading";
    updateSoloUI();
    speechEngine.speak(qData.q);
  }

  function triggerSoloBuzzSolo() {
    if (soloState !== "reading") return;

    soundEngine.init();
    soundEngine.playBuzz();

    if (speechEngine.isPlaying) {
      currentBuzzIndex = speechEngine.buzzStop();
    } else {
      currentBuzzIndex = speechEngine.currentCharIndex || 0;
    }

    isBuzzed = true;
    renderBuzzedQuestionText(currentBuzzIndex, "あなた");

    soloState = "buzzed";
    updateSoloUI();
  }

  function handleSoloPass() {
    // パスが選ばれたら最初から読み直す
    elements.buzzMarkerInfo.classList.add("hidden");
    const qData = questionManager.getCurrentQuestion();
    if (qData) {
      renderFullQuestionText();
    }
    startSoloReading();
  }

  function handleSoloShowAnswer() {
    soundEngine.playCorrect();
    soloState = "answer_shown";
    updateSoloUI();
  }

  function handleSoloNext() {
    questionManager.nextQuestion();
    renderCurrentQuestion();
    resetSoloState();
  }

  // ----------------------------------------------------
  // 問題レンダリング & UI更新
  // ----------------------------------------------------
  function renderCurrentQuestion() {
    speechEngine.stop();
    stopTimer();
    isBuzzed = false;
    currentBuzzIndex = -1;
    currentBuzzedPlayer = "";

    // スマホ側にリセット通知
    if (buzzChannel) {
      buzzChannel.postMessage({ type: "RESET" });
    }

    const qData = questionManager.getCurrentQuestion();
    const total = questionManager.questions.length;
    const currentIdx = questionManager.currentIndex;

    elements.totalCountBadge.textContent = total;
    elements.maxQNum.textContent = total;
    elements.currentQNum.textContent = total > 0 ? currentIdx + 1 : 0;

    updateDropdownList();

    if (!qData) {
      elements.questionTextBox.innerHTML = '<span class="placeholder-text">問題がありません。ABC過去問を取得するか、問題を追加してください。</span>';
      elements.answerText.textContent = "----";
      elements.qGenreTag.textContent = "なし";
      return;
    }

    elements.qGenreTag.textContent = qData.genre || "一般";
    elements.questionTextBox.textContent = qData.q;
    elements.answerText.textContent = qData.a;
    elements.answerText.classList.add("hidden");
    elements.btnToggleAnswer.textContent = "👁️ 正解を表示 (Enter)";

    elements.buzzMarkerInfo.classList.add("hidden");
    elements.speechStatus.textContent = "待機中";
    elements.speechStatus.className = "status-indicator ready";
    elements.btnPlay.textContent = "▶️ 読み上げ開始 (Space)";

    if (currentMode === "solo") {
      resetSoloState();
    }
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

  function renderBuzzedQuestionText(buzzIdx, playerName) {
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
    const nameLabel = playerName ? `【${playerName}】` : "";
    elements.buzzPositionText.textContent = `「${beforeBuzz}」の直後（第${buzzIdx}文字目）で ${nameLabel} 早押ししました！`;
  }

  // ----------------------------------------------------
  // 早押し (BUZZ) ロジック (みんなでモード用)
  // ----------------------------------------------------
  function triggerBuzz(playerName = "ホスト") {
    if (isBuzzed) return; // 重複防止

    const qData = questionManager.getCurrentQuestion();
    if (!qData) return;

    soundEngine.init();
    currentBuzzedPlayer = playerName;
    
    if (speechEngine.isPlaying) {
      currentBuzzIndex = speechEngine.buzzStop();
      soundEngine.playBuzz();
    } else {
      soundEngine.playBuzz();
      currentBuzzIndex = speechEngine.currentCharIndex || 0;
    }

    isBuzzed = true;
    elements.speechStatus.textContent = `⚡ ${playerName} が早押し！`;
    elements.speechStatus.className = "status-indicator buzzed";

    // スマホ側へ早押しプレイヤー通知を返信
    if (buzzChannel) {
      buzzChannel.postMessage({
        type: "BUZZED_NOTICE",
        playerName: playerName
      });
    }

    // ボタンアニメーション
    elements.btnBuzz.classList.add("pressed");
    setTimeout(() => elements.btnBuzz.classList.remove("pressed"), 200);

    // スラッシュマーク＆プレイヤー表示
    renderBuzzedQuestionText(currentBuzzIndex, playerName);

    // カウントダウンタイマー開始
    startTimer();
  }

  // ----------------------------------------------------
  // タイマー制御 (みんなでモード用)
  // ----------------------------------------------------
  function startTimer() {
    stopTimer();
    timerTotal = parseInt(elements.selectTimerSec.value) || 5;
    timerRemaining = timerTotal;

    elements.timerDisplay.classList.remove("hidden");
    elements.timerCount.textContent = timerRemaining;
    elements.timerBarFill.style.width = "100%";

    timerInterval = setInterval(() => {
      timerRemaining--;
      elements.timerCount.textContent = timerRemaining;
      elements.timerBarFill.style.width = `${(timerRemaining / timerTotal) * 100}%`;

      soundEngine.playTick();

      if (timerRemaining <= 0) {
        stopTimer();
        soundEngine.playIncorrect();
      }
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    elements.timerDisplay.classList.add("hidden");
  }

  // ----------------------------------------------------
  // 正誤判定 & スコア管理
  // ----------------------------------------------------
  function handleCorrect() {
    stopTimer();
    soundEngine.playCorrect();

    score += correctPts;
    correctCount++;
    updateScoreDisplay();

    elements.answerText.classList.remove("hidden");
    elements.btnToggleAnswer.textContent = "🙈 正解を隠す";

    setTimeout(() => {
      if (confirm("正解！次の問題に進みますか？")) {
        questionManager.nextQuestion();
        renderCurrentQuestion();
      }
    }, 400);
  }

  function handleIncorrect() {
    stopTimer();
    soundEngine.playIncorrect();

    score -= incorrectPts;
    incorrectCount++;
    updateScoreDisplay();

    elements.answerText.classList.remove("hidden");
    elements.btnToggleAnswer.textContent = "🙈 正解を隠す";
  }

  function handleThrough() {
    stopTimer();
    soundEngine.playThrough();

    questionManager.nextQuestion();
    renderCurrentQuestion();
  }

  function updateScoreDisplay() {
    elements.playerScoreVal.innerHTML = `${score} <span class="unit">pt</span>`;
    elements.statCorrectCount.textContent = correctCount;
    elements.statIncorrectCount.textContent = incorrectCount;
  }

  // ----------------------------------------------------
  // ABCガチャ (http://qss.quiz-island.site/abcgo-gacha/) から100問のリアルタイム取得
  // ----------------------------------------------------
  async function refreshAbc100Questions(showConfirm = true) {
    if (showConfirm && !confirm("http://qss.quiz-island.site/abcgo-gacha/ から100問を新しく取得しますか？\n（現在の問題リストは置き換わります）")) {
      return;
    }

    const abcBtns = [elements.btnHeaderAbc, elements.btnStageAbc, elements.btnBankAbc];
    abcBtns.forEach(btn => {
      if (btn) {
        btn.disabled = true;
        btn.dataset.originalText = btn.textContent;
        btn.textContent = "⏳ ガチャ取得中...";
      }
    });

    try {
      const res = await questionManager.fetchAbcQuestionsFromGacha();
      renderCurrentQuestion();
      renderQuestionBankTable();

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
      abcBtns.forEach(btn => {
        if (btn) {
          btn.disabled = false;
          if (btn.dataset.originalText) {
            btn.textContent = btn.dataset.originalText;
          }
        }
      });
    }
  }

  // ----------------------------------------------------
  // イベントリスナー設定
  // ----------------------------------------------------
  function setupEventListeners() {
    // モード切替イベント
    elements.btnOpenMode.addEventListener("click", () => {
      elements.modeSelectModal.classList.remove("hidden");
    });

    elements.btnChooseSolo.addEventListener("click", () => {
      setMode("solo");
      elements.modeSelectModal.classList.add("hidden");
    });

    elements.btnChooseMulti.addEventListener("click", () => {
      setMode("multi");
      elements.modeSelectModal.classList.add("hidden");
    });

    elements.tabModeSolo.addEventListener("click", () => setMode("solo"));
    elements.tabModeMulti.addEventListener("click", () => setMode("multi"));

    // Solo モード専用ボタンイベント
    elements.btnSoloPlay.addEventListener("click", startSoloReading);
    elements.btnSoloBuzz.addEventListener("click", triggerSoloBuzzSolo);
    elements.btnSoloPass.addEventListener("click", handleSoloPass);
    elements.btnSoloShowAnswer.addEventListener("click", handleSoloShowAnswer);
    elements.btnSoloNext.addEventListener("click", handleSoloNext);
    elements.btnSoloReread.addEventListener("click", handleSoloPass);

    // ガチャ・共通ボタンイベント
    elements.btnHeaderAbc.addEventListener("click", () => refreshAbc100Questions(true));
    elements.btnStageAbc.addEventListener("click", () => refreshAbc100Questions(true));
    elements.btnBankAbc.addEventListener("click", () => refreshAbc100Questions(true));

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

    // みんなでモード用イベント
    elements.btnBuzz.addEventListener("click", () => triggerBuzz("ホスト"));

    elements.btnPlay.addEventListener("click", () => {
      soundEngine.init();
      const qData = questionManager.getCurrentQuestion();
      if (!qData) return;

      if (speechEngine.isPlaying) {
        triggerBuzz("ホスト");
      } else {
        isBuzzed = false;
        elements.buzzMarkerInfo.classList.add("hidden");
        speechEngine.speak(qData.q);
      }
    });

    elements.btnPause.addEventListener("click", () => {
      speechEngine.stop();
    });

    elements.btnStop.addEventListener("click", () => {
      speechEngine.stop();
      renderCurrentQuestion();
    });

    elements.btnRestart.addEventListener("click", () => {
      renderCurrentQuestion();
    });

    elements.btnToggleAnswer.addEventListener("click", () => {
      const isHidden = elements.answerText.classList.contains("hidden");
      if (isHidden) {
        elements.answerText.classList.remove("hidden");
        elements.btnToggleAnswer.textContent = "🙈 正解を隠す (Enter)";
      } else {
        elements.answerText.classList.add("hidden");
        elements.btnToggleAnswer.textContent = "👁️ 正解を表示 (Enter)";
      }
    });

    elements.btnCorrect.addEventListener("click", handleCorrect);
    elements.btnIncorrect.addEventListener("click", handleIncorrect);
    elements.btnThrough.addEventListener("click", handleThrough);

    elements.btnOpenAdd.addEventListener("click", () => {
      elements.addModal.classList.remove("hidden");
    });
    elements.btnCloseAdd.addEventListener("click", () => {
      elements.addModal.classList.add("hidden");
    });

    elements.btnSaveAdd.addEventListener("click", () => {
      const q = elements.inputAddQ.value;
      const a = elements.inputAddA.value;
      const genre = elements.inputAddGenre.value;

      if (!q || !a) {
        alert("問題文と正解を入力してください。");
        return;
      }

      questionManager.addQuestion(q, a, genre);
      elements.inputAddQ.value = "";
      elements.inputAddA.value = "";
      elements.inputAddGenre.value = "";
      elements.addModal.classList.add("hidden");

      renderQuestionBankTable();
      renderCurrentQuestion();
    });

    elements.btnOpenImport.addEventListener("click", () => {
      elements.importModal.classList.remove("hidden");
    });
    elements.btnCloseImport.addEventListener("click", () => {
      elements.importModal.classList.add("hidden");
    });

    elements.btnDoImport.addEventListener("click", () => {
      const text = elements.inputImportText.value;
      if (!text) return;

      const count = questionManager.importBatchText(text);
      elements.inputImportText.value = "";
      elements.importModal.classList.add("hidden");

      renderQuestionBankTable();
      renderCurrentQuestion();
      alert(`${count}件の問題を正常にインポートしました！`);
    });

    elements.btnShuffleBank.addEventListener("click", () => {
      questionManager.shuffle();
      renderQuestionBankTable();
      renderCurrentQuestion();
    });

    elements.btnClearBank.addEventListener("click", () => {
      if (confirm("本当にすべての問題を削除しますか？")) {
        questionManager.clearAll();
        renderQuestionBankTable();
        renderCurrentQuestion();
      }
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

    elements.inputCorrectPt.addEventListener("change", (e) => {
      correctPts = parseInt(e.target.value) || 100;
    });

    elements.inputIncorrectPt.addEventListener("change", (e) => {
      incorrectPts = parseInt(e.target.value) || 50;
    });

    elements.btnResetScores.addEventListener("click", () => {
      score = 0;
      correctCount = 0;
      incorrectCount = 0;
      updateScoreDisplay();
    });

    elements.btnAdd100.addEventListener("click", () => {
      score += 100;
      updateScoreDisplay();
    });

    elements.btnSub50.addEventListener("click", () => {
      score -= 50;
      updateScoreDisplay();
    });
  }

  function setupKeyboardShortcuts() {
    window.addEventListener("keydown", (e) => {
      if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
        return;
      }

      // ---------------- Solo モード用ショートカット ----------------
      if (currentMode === "solo") {
        if (e.code === "Space") {
          e.preventDefault();
          if (soloState === "idle") {
            startSoloReading();
          } else if (soloState === "reading") {
            triggerSoloBuzzSolo();
          } else if (soloState === "answer_shown") {
            handleSoloNext();
          }
        } else if (e.code === "Enter") {
          e.preventDefault();
          if (soloState === "idle") {
            startSoloReading();
          } else if (soloState === "buzzed") {
            handleSoloShowAnswer();
          } else if (soloState === "answer_shown") {
            handleSoloNext();
          }
        } else if (e.code === "KeyP" || e.code === "Digit1" || e.code === "Numpad1") {
          if (soloState === "buzzed") {
            handleSoloPass();
          }
        } else if (e.code === "KeyA" || e.code === "Digit2" || e.code === "Numpad2") {
          if (soloState === "buzzed") {
            handleSoloShowAnswer();
          }
        }
        return;
      }

      // ---------------- みんなでモード用ショートカット ----------------
      if (e.code === "Space") {
        e.preventDefault();
        soundEngine.init();
        if (speechEngine.isPlaying) {
          triggerBuzz("ホスト");
        } else if (!isBuzzed) {
          const qData = questionManager.getCurrentQuestion();
          if (qData) speechEngine.speak(qData.q);
        } else {
          triggerBuzz("ホスト");
        }
      } else if (e.code === "Enter") {
        e.preventDefault();
        elements.btnToggleAnswer.click();
      } else if (e.code === "Digit1" || e.code === "Numpad1") {
        handleCorrect();
      } else if (e.code === "Digit2" || e.code === "Numpad2") {
        handleIncorrect();
      } else if (e.code === "Digit3" || e.code === "Numpad3" || e.code === "KeyN") {
        handleThrough();
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

  function renderQuestionBankTable() {
    elements.questionTableBody.innerHTML = "";
    elements.bankCountInfo.textContent = `全 ${questionManager.questions.length} 問`;

    questionManager.questions.forEach((item, idx) => {
      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td><strong>${idx + 1}</strong></td>
        <td>${escapeHtml(item.q)}</td>
        <td style="color: var(--accent-green); font-weight: 700;">${escapeHtml(item.a)}</td>
        <td><span class="genre-tag">${escapeHtml(item.genre || '一般')}</span></td>
        <td>
          <button class="btn btn-sm btn-ctrl btn-play-row" data-idx="${idx}">選択</button>
          <button class="btn btn-sm btn-danger btn-del-row" data-id="${item.id}">削除</button>
        </td>
      `;

      elements.questionTableBody.appendChild(tr);
    });

    document.querySelectorAll(".btn-play-row").forEach(b => {
      b.addEventListener("click", (e) => {
        const idx = parseInt(e.target.getAttribute("data-idx"));
        questionManager.setQuestionIndex(idx);
        renderCurrentQuestion();
        elements.tabBtns[0].click();
      });
    });

    document.querySelectorAll(".btn-del-row").forEach(b => {
      b.addEventListener("click", (e) => {
        const id = e.target.getAttribute("data-id");
        questionManager.deleteQuestion(id);
        renderQuestionBankTable();
        renderCurrentQuestion();
      });
    });
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
