/**
 * Web Speech API (SpeechSynthesis) を制御する読み上げエンジン
 * 高精度な文字位置追跡（charIndex）と即時カットアウトを実現します。
 */
class SpeechEngine {
  constructor() {
    this.synth = window.speechSynthesis;
    this.voices = [];
    this.selectedVoice = null;
    this.rate = 1.3; // 早押しクイズに最適な標準速度 (1.3x)
    this.pitch = 1.0;
    this.volume = 1.0;
    
    this.currentText = "";
    this.currentCharIndex = 0;
    this.isPlaying = false;
    this.isPaused = false;
    this.currentUtterance = null;

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
   * テキストの読み上げを開始
   * @param {string} text 読み上げる問題文
   */
  speak(text) {
    this.stop(); // 既存の読み上げを停止

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

    // 開始イベント
    utterance.onstart = () => {
      this.isPlaying = true;
      if (this.onStart) this.onStart();
    };

    // 境界位置イベント（文字トラッキング）
    utterance.onboundary = (event) => {
      if (event.name === 'word' || event.name === 'sentence' || typeof event.charIndex === 'number') {
        this.currentCharIndex = event.charIndex;
        if (this.onBoundary) {
          this.onBoundary(this.currentCharIndex, event.charLength || 1);
        }
      }
    };

    // 終了イベント
    utterance.onend = () => {
      if (this.isPlaying) {
        this.isPlaying = false;
        this.currentCharIndex = this.currentText.length;
        if (this.onEnd) this.onEnd();
      }
    };

    utterance.onerror = (e) => {
      console.error("SpeechSynthesis error:", e);
      this.isPlaying = false;
      if (this.onEnd) this.onEnd();
    };

    this.synth.speak(utterance);
  }

  /**
   * 早押し時：即座に読み上げを停止し、現在の文字位置を返す
   */
  buzzStop() {
    const buzzIndex = this.currentCharIndex;
    this.stop();
    return buzzIndex;
  }

  /**
   * 完全に停止
   */
  stop() {
    if (this.synth) {
      this.synth.cancel();
    }
    this.isPlaying = false;
    this.isPaused = false;
    if (this.onStop) this.onStop();
  }
}

const speechEngine = new SpeechEngine();
