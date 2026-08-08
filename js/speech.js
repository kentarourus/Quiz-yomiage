/**
 * Web Speech API (SpeechSynthesis) を制御する読み上げエンジン
 * ブラウザのonboundary不具合をカバーするハイブリッド文字トラッキングエンジン搭載
 */
class SpeechEngine {
  constructor() {
    this.synth = window.speechSynthesis;
    this.voices = [];
    this.selectedVoice = null;
    this.rate = 1.0; // デフォルト読み上げ速度 (1.0x)
    this.pitch = 1.0;
    this.volume = 1.0;
    
    this.currentText = "";
    this.currentCharIndex = 0;
    this.isPlaying = false;
    this.isPaused = false;
    this.currentUtterance = null;
    this.timer = null;
    this.startTime = 0;

    // イベントコールバック
    this.onStart = null;
    this.onBoundary = null;
    this.onEnd = null;
    this.onStop = null;

    this.initVoices();
  }

  initVoices() {
    if (!this.synth) return;
    
    const updateVoices = () => {
      this.voices = this.synth.getVoices();
      const jaVoices = this.voices.filter(v => v.lang.includes('ja') || v.lang.includes('JA'));
      
      if (jaVoices.length > 0) {
        // 早押しクイズに最適な高音質・聞き取りやすいボイスを自動優先選択
        const priorityNames = [
          "Google 日本語", "Google ja-JP", 
          "Microsoft Nanami Online", "Microsoft Keita Online", "Microsoft Ayumi", 
          "Kyoko", "Otoya", "Hattori", "Haruka", "Ichiro"
        ];

        let bestVoice = null;
        for (const name of priorityNames) {
          const match = jaVoices.find(v => v.name.includes(name));
          if (match) {
            bestVoice = match;
            break;
          }
        }
        this.selectedVoice = bestVoice || jaVoices[0];
      } else if (this.voices.length > 0) {
        this.selectedVoice = this.voices[0];
      }
    };

    updateVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = updateVoices;
    }
  }

  getJapaneseVoices() {
    if (!this.synth) return [];
    return this.voices.filter(v => v.lang.includes('ja') || v.lang.includes('JA'));
  }

  setVoice(voiceURI) {
    const voice = this.voices.find(v => v.voiceURI === voiceURI);
    if (voice) {
      this.selectedVoice = voice;
    }
  }

  setRate(val) {
    this.rate = parseFloat(val);
  }

  setPitch(val) {
    this.pitch = parseFloat(val);
  }

  /**
   * テキストの読み上げを開始 (ハイブリッドリアルタイム文字トラッキング)
   * @param {string} text 読み上げる問題文
   */
  speak(text) {
    this.stop(); // 既存の読み上げ・タイマーを停止

    if (!this.synth) {
      console.warn("Speech Synthesis is not supported in this browser.");
      return;
    }

    this.currentText = text;
    this.currentCharIndex = 0;
    this.isPlaying = true;
    this.isPaused = false;

    const utterance = new SpeechSynthesisUtterance(text);
    this.currentUtterance = utterance;

    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    }
    utterance.lang = 'ja-JP';
    utterance.rate = this.rate;
    utterance.pitch = this.pitch;
    utterance.volume = this.volume;

    // 日本語1文字あたりのミリ秒推定値 (速度設定 rate を自動反映)
    // 1.0x 時でおよそ165ms/文字
    const msPerChar = Math.max(50, Math.round(165 / (this.rate || 1.0)));

    // 開始イベント
    utterance.onstart = () => {
      this.isPlaying = true;
      this.startTime = Date.now();
      if (this.onStart) this.onStart();

      // 初回1文字目を即時反映
      if (this.onBoundary) this.onBoundary(0, 1);

      // 高精度文字タイマーを開始 (ブラウザのonboundary非対応対策)
      clearInterval(this.timer);
      this.timer = setInterval(() => {
        if (!this.isPlaying) {
          clearInterval(this.timer);
          return;
        }
        const elapsed = Date.now() - this.startTime;
        const estimatedIndex = Math.min(this.currentText.length, Math.floor(elapsed / msPerChar));

        if (estimatedIndex > this.currentCharIndex) {
          this.currentCharIndex = estimatedIndex;
          if (this.onBoundary) {
            this.onBoundary(this.currentCharIndex, 1);
          }
        }
      }, 40);
    };

    // 境界位置イベント（ブラウザがonboundaryに対応している場合は位置補正）
    utterance.onboundary = (event) => {
      if (typeof event.charIndex === 'number' && event.charIndex > 0) {
        this.currentCharIndex = event.charIndex;
        this.startTime = Date.now() - (this.currentCharIndex * msPerChar);
        if (this.onBoundary) {
          this.onBoundary(this.currentCharIndex, event.charLength || 1);
        }
      }
    };

    // 終了イベント
    utterance.onend = () => {
      clearInterval(this.timer);
      if (this.isPlaying) {
        this.isPlaying = false;
        this.currentCharIndex = this.currentText.length;
        if (this.onBoundary) this.onBoundary(this.currentText.length, 1);
        if (this.onEnd) this.onEnd();
      }
    };

    utterance.onerror = (e) => {
      console.error("SpeechSynthesis error:", e);
      clearInterval(this.timer);
      this.isPlaying = false;
      if (this.onEnd) this.onEnd();
    };

    this.synth.speak(utterance);
  }

  /**
   * 早押し時：即座に読み上げとタイマーを停止し、現在の文字位置を返す
   */
  buzzStop() {
    clearInterval(this.timer);
    const buzzIndex = this.currentCharIndex;
    this.stop();
    return buzzIndex;
  }

  /**
   * 完全に停止
   */
  stop() {
    clearInterval(this.timer);
    if (this.synth) {
      this.synth.cancel();
    }
    this.isPlaying = false;
    this.isPaused = false;
    if (this.onStop) this.onStop();
  }
}

const speechEngine = new SpeechEngine();
