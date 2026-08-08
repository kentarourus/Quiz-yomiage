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
   * http://qss.quiz-island.site/abcgo-gacha/ から100問を非同期で毎回取得
   */
  async fetchAbcQuestionsFromGacha() {
    const targetUrl = "http://qss.quiz-island.site/abcgo-gacha/";

    const fetchMethods = [
      async () => {
        const res = await fetch(targetUrl, { redirect: "follow", cache: "no-store" });
        if (res.ok) return await res.text();
        return null;
      },
      async () => {
        const proxyUrl = "https://proxy.cors.sh/" + targetUrl;
        const res = await fetch(proxyUrl, { cache: "no-store" });
        if (res.ok) return await res.text();
        return null;
      },
      async () => {
        const proxyUrl = "https://api.allorigins.win/get?url=" + encodeURIComponent(targetUrl) + "&ts=" + Date.now();
        const res = await fetch(proxyUrl, { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          return json.contents || null;
        }
        return null;
      },
      async () => {
        const proxyUrl = "https://api.allorigins.win/raw?url=" + encodeURIComponent(targetUrl) + "&ts=" + Date.now();
        const res = await fetch(proxyUrl, { cache: "no-store" });
        if (res.ok) return await res.text();
        return null;
      },
      async () => {
        const proxyUrl = "https://corsproxy.io/?" + encodeURIComponent(targetUrl);
        const res = await fetch(proxyUrl, { cache: "no-store" });
        if (res.ok) return await res.text();
        return null;
      }
    ];

    let htmlText = null;
    for (const fn of fetchMethods) {
      try {
        const text = await fn();
        if (text && text.includes("quizzes_list")) {
          htmlText = text;
          break;
        }
      } catch (e) {
        console.warn("Gacha fetch method failed:", e);
      }
    }

    if (htmlText) {
      const fetched = this.parseGachaHtml(htmlText);
      if (fetched && fetched.length > 0) {
        this.questions = fetched;
        this.currentIndex = 0;
        this.saveToStorage();
        return { success: true, count: fetched.length, source: "http://qss.quiz-island.site/abcgo-gacha/" };
      }
    }

    // 万が一全てネットワークエラーとなった場合のローカルフォールバック
    console.warn("Live fetch failed. Loading offline ABC dataset fallback.");
    this.loadAbcRandomQuestions(100);
    return { success: false, count: this.questions.length, source: "offline_fallback" };
  }

  /**
   * ガチャHTMLから問題・正解・ジャンル情報を抽出
   * @param {string} htmlText 
   */
  parseGachaHtml(htmlText) {
    const questions = [];

    // DOMParser による HTML 解析
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, "text/html");
      const rows = doc.querySelectorAll("#quizzes_list tr");
      rows.forEach((tr, idx) => {
        const qAnchor = tr.querySelector("td.align-middle a[name]") || tr.querySelector("td a[name]");
        const qText = qAnchor ? qAnchor.textContent.replace(/[\r\n\t]+/g, " ").trim() : "";

        const aTd = tr.querySelector("td.d-none.d-sm-table-cell") || tr.querySelectorAll("td")[3];
        const aText = aTd ? aTd.textContent.replace(/[\r\n\t]+/g, " ").trim() : "";

        const genreP = tr.querySelector("td p");
        const genreText = genreP ? genreP.textContent.trim() : "ABC過去問";

        if (qText && aText) {
          questions.push({
            id: "gacha_" + (idx + 1) + "_" + Date.now(),
            q: qText,
            a: aText,
            genre: genreText
          });
        }
      });
    } catch (e) {
      console.error("DOMParser parse error:", e);
    }

    // 正規表現フォールバック (DOMParserで抽出できなかった場合)
    if (questions.length === 0) {
      const trs = htmlText.split(/<tr[^>]*>/i);
      for (let i = 1; i < trs.length; i++) {
        const tr = trs[i];
        const qm = tr.match(/<a name="\d+">([\s\S]*?)<\/a>/i);
        const am = tr.match(/<td class="d-none d-sm-table-cell align-middle"[^>]*>([\s\S]*?)<\/td>/i);
        const infom = tr.match(/<p>([\s\S]*?)<\/p>/i);
        if (qm && am) {
          const qClean = qm[1].replace(/<[^>]+>/g, "").replace(/[\r\n\t]+/g, " ").trim();
          const aClean = am[1].replace(/<[^>]+>/g, "").replace(/[\r\n\t]+/g, " ").trim();
          const genreClean = infom ? infom[1].replace(/<[^>]+>/g, "").trim() : "ABC過去問";
          if (qClean && aClean) {
            questions.push({
              id: "gacha_rgx_" + (questions.length + 1) + "_" + Date.now(),
              q: qClean,
              a: aClean,
              genre: genreClean
            });
          }
        }
      }
    }

    return questions;
  }

  /**
   * ABC過去問からランダムに指定数をロード（オフラインフォールバック用）
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
