/**
 * スマホ用早押しボタン コントローラー (js/player.js)
 */
document.addEventListener("DOMContentLoaded", () => {
  const btnMobileBuzz = document.getElementById("btn-mobile-buzz");
  const playerNameInput = document.getElementById("player-name-input");
  const statusBanner = document.getElementById("status-banner");

  // ランダムなプレイヤー名を初期生成（例: プレイヤー1, プレイヤー2...）
  if (!localStorage.getItem("quiz_player_name")) {
    const randomNum = Math.floor(Math.random() * 90) + 10;
    playerNameInput.value = "プレイヤー" + randomNum;
  } else {
    playerNameInput.value = localStorage.getItem("quiz_player_name");
  }

  playerNameInput.addEventListener("change", () => {
    localStorage.setItem("quiz_player_name", playerNameInput.value.trim());
  });

  // BroadcastChannel 接続
  let buzzChannel = null;
  if ("BroadcastChannel" in window) {
    buzzChannel = new BroadcastChannel("quiz_buzz_channel");

    // メイン画面からの状態メッセージを受信
    buzzChannel.onmessage = (event) => {
      const data = event.data;
      if (!data) return;

      if (data.type === "BUZZED_NOTICE") {
        if (data.playerName === playerNameInput.value.trim()) {
          statusBanner.textContent = "⚡ あなたが早押し！";
          statusBanner.className = "status-banner buzzed-me";
        } else {
          statusBanner.textContent = `⚡ ${data.playerName} が早押し！`;
          statusBanner.className = "status-banner buzzed-other";
        }
      } else if (data.type === "RESET") {
        statusBanner.textContent = "待機中";
        statusBanner.className = "status-banner";
      }
    };
  }

  // 早押し実行関数
  function doBuzz(e) {
    if (e) e.preventDefault();

    const playerName = playerNameInput.value.trim() || "匿名";

    // バイブレーション（対応スマホ）
    if (navigator.vibrate) {
      try {
        navigator.vibrate([100, 50, 100]);
      } catch (err) {}
    }

    // ローカル早押し音
    if (typeof soundEngine !== "undefined") {
      soundEngine.playBuzz();
    }

    // ボタンアニメーション
    btnMobileBuzz.classList.add("pressed");
    setTimeout(() => btnMobileBuzz.classList.remove("pressed"), 180);

    statusBanner.textContent = "⚡ 早押し送信！";
    statusBanner.className = "status-banner buzzed-me";

    // メイン画面へブロードキャスト送信
    if (buzzChannel) {
      buzzChannel.postMessage({
        type: "BUZZ_EVENT",
        playerName: playerName,
        timestamp: Date.now()
      });
    }

    // localStorage経由でのバックアップ連携 (BroadcastChannel非対応ブラウザ用)
    try {
      localStorage.setItem("quiz_latest_buzz", JSON.stringify({
        playerName: playerName,
        timestamp: Date.now()
      }));
    } catch (err) {}
  }

  // タッチ＆クリックイベント登録
  btnMobileBuzz.addEventListener("touchstart", doBuzz, { passive: false });
  btnMobileBuzz.addEventListener("click", doBuzz);
});
