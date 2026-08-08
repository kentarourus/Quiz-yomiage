/**
 * クイズ問題データ管理クラス
 */
class QuestionManager {
  constructor() {
    this.questions = [];
    this.currentIndex = 0;
    this.storageKey = "quiz_yomiage_questions_v1";
    this.loadFromStorage();
  }

  /**
   * ローカルストレージからの復元（なければABC過去問100問をデフォルトセット）
   */
  loadFromStorage() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.questions = parsed;
          return;
        }
      }
    } catch (e) {
      console.error("Failed to load questions from localStorage:", e);
    }
    // デフォルトでABC過去問100問を自動読み込み
    this.loadAbcRandomQuestions(100);
  }

  saveToStorage() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.questions));
    } catch (e) {
      console.error("Failed to save questions to localStorage:", e);
    }
  }

  /**
   * ABC過去問からランダムに指定数をロード
   * @param {number} count 
   */
  loadAbcRandomQuestions(count = 100) {
    if (typeof getRandomAbcQuestions === 'function') {
      const abcQs = getRandomAbcQuestions(count);
      this.questions = abcQs.map((item, idx) => ({
        id: "abc_" + (idx + 1) + "_" + Date.now(),
        q: item.q,
        a: item.a,
        genre: "ABC過去問"
      }));
      this.currentIndex = 0;
      this.saveToStorage();
    }
  }

  getCurrentQuestion() {
    if (this.questions.length === 0) return null;
    return this.questions[this.currentIndex] || null;
  }

  nextQuestion() {
    if (this.currentIndex < this.questions.length - 1) {
      this.currentIndex++;
      return this.getCurrentQuestion();
    }
    return null;
  }

  prevQuestion() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      return this.getCurrentQuestion();
    }
    return null;
  }

  setQuestionIndex(idx) {
    if (idx >= 0 && idx < this.questions.length) {
      this.currentIndex = idx;
      return this.getCurrentQuestion();
    }
    return null;
  }

  addQuestion(qText, aText, genre = "一般") {
    const newQ = {
      id: "custom_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      q: qText.trim(),
      a: aText.trim(),
      genre: genre.trim() || "一般"
    };
    this.questions.push(newQ);
    this.saveToStorage();
    return newQ;
  }

  updateQuestion(id, qText, aText, genre) {
    const item = this.questions.find(item => item.id === id);
    if (item) {
      item.q = qText.trim();
      item.a = aText.trim();
      if (genre) item.genre = genre.trim();
      this.saveToStorage();
    }
  }

  deleteQuestion(id) {
    this.questions = this.questions.filter(item => item.id !== id);
    if (this.currentIndex >= this.questions.length) {
      this.currentIndex = Math.max(0, this.questions.length - 1);
    }
    this.saveToStorage();
  }

  clearAll() {
    this.questions = [];
    this.currentIndex = 0;
    this.saveToStorage();
  }

  shuffle() {
    this.questions.sort(() => Math.random() - 0.5);
    this.currentIndex = 0;
    this.saveToStorage();
  }

  /**
   * テキスト / CSV / TSV 行の一括インポート
   * フォーマット例:
   * 問題文,正解
   * または タブ区切り: 問題文	正解
   */
  importBatchText(rawText) {
    const lines = rawText.split(/\r?\n/);
    const added = [];

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      let q = "";
      let a = "";

      if (line.includes("\t")) {
        const parts = line.split("\t");
        q = parts[0];
        a = parts.slice(1).join("\t");
      } else if (line.includes(",")) {
        const parts = line.split(",");
        q = parts[0];
        a = parts.slice(1).join(",");
      } else if (line.includes("／")) {
        const parts = line.split("／");
        q = parts[0];
        a = parts.slice(1).join("／");
      } else {
        q = line;
        a = "解答未設定";
      }

      if (q) {
        added.push({
          id: "imp_" + Date.now() + "_" + Math.floor(Math.random() * 10000),
          q: q.trim(),
          a: a.trim(),
          genre: "インポート"
        });
      }
    }

    if (added.length > 0) {
      this.questions = [...this.questions, ...added];
      this.saveToStorage();
    }
    return added.length;
  }
}

const questionManager = new QuestionManager();
