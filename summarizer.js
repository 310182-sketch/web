// Summarizer - AI 摘要功能
class Summarizer {
  constructor() {
    this.cache = new Map();
  }

  async summarize(options = {}) {
    const url = this.normalizeUrl(window.location.href);
    const cacheKey = `${url}_${options.length || 'medium'}`;
    
    // 檢查快取
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const content = this.extractContent();
    if (!content || content.length < 100) {
      throw new Error('頁面內容太少，無法生成摘要');
    }

    let summary;
    
    // 嘗試使用 Chrome AI
    if (await this.isChromeAIAvailable()) {
      try {
        summary = await this.summarizeWithChromeAI(content, options);
      } catch (e) {
        console.warn('Chrome AI failed, falling back to local algorithm:', e);
        summary = this.summarizeLocally(content, options);
      }
    } else {
      summary = this.summarizeLocally(content, options);
    }

    // 儲存快取
    this.cache.set(cacheKey, summary);
    
    // 儲存到 storage
    await this.saveSummary(url, summary, content.length);
    
    return summary;
  }

  extractContent() {
    // 移除不需要的元素
    const clone = document.body.cloneNode(true);
    
    // 移除噪音
    clone.querySelectorAll(
      'script, style, nav, header, footer, aside, .advertisement, .ad, [role="banner"], [role="navigation"], [role="complementary"]'
    ).forEach(el => el.remove());

    // 優先取得文章內容
    const article = clone.querySelector('article') || 
                   clone.querySelector('[role="main"]') ||
                   clone.querySelector('main') ||
                   clone;

    let text = article.textContent || '';
    
    // 清理文字
    text = text
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();

    return text;
  }

  async isChromeAIAvailable() {
    try {
      if (!('ai' in window)) return false;
      if (!('summarizer' in window.ai)) return false;
      
      const availability = await window.ai.summarizer.capabilities();
      return availability.available === 'readily';
    } catch (e) {
      return false;
    }
  }

  async summarizeWithChromeAI(content, options = {}) {
    const summarizer = await window.ai.summarizer.create({
      type: 'key-points',
      format: 'markdown',
      length: options.length || 'medium'
    });

    // 限制輸入長度
    const maxLength = 4000;
    const truncatedContent = content.length > maxLength 
      ? content.substring(0, maxLength) + '...'
      : content;

    const summary = await summarizer.summarize(truncatedContent);
    
    return {
      content: summary,
      method: 'chrome-ai',
      timestamp: Date.now()
    };
  }

  summarizeLocally(content, options = {}) {
    const sentenceCount = {
      short: 3,
      medium: 5,
      long: 8
    }[options.length || 'medium'];

    // 分句
    const sentences = content
      .split(/[。！？\n.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 10 && s.length < 300);

    if (sentences.length === 0) {
      return {
        content: '無法提取有效內容',
        method: 'local',
        timestamp: Date.now()
      };
    }

    // 簡單的 TF-IDF 評分
    const scores = this.calculateSentenceScores(sentences, content);
    
    // 選取得分最高的句子
    const topSentences = sentences
      .map((sentence, index) => ({ sentence, score: scores[index], index }))
      .sort((a, b) => b.score - a.score)
      .slice(0, sentenceCount)
      .sort((a, b) => a.index - b.index)
      .map(item => item.sentence);

    return {
      content: topSentences.join('\n\n'),
      method: 'local',
      timestamp: Date.now()
    };
  }

  calculateSentenceScores(sentences, fullText) {
    // 計算詞頻
    const words = fullText.toLowerCase().split(/\s+/);
    const wordFreq = {};
    words.forEach(word => {
      if (word.length > 2) {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      }
    });

    // 計算每個句子的得分
    return sentences.map(sentence => {
      const sentenceWords = sentence.toLowerCase().split(/\s+/);
      let score = 0;
      
      sentenceWords.forEach(word => {
        if (word.length > 2) {
          score += wordFreq[word] || 0;
        }
      });

      // 位置加權（開頭的句子權重更高）
      const positionBonus = 1 / (sentences.indexOf(sentence) + 1);
      score *= (1 + positionBonus);

      // 長度懲罰（太短或太長的句子）
      if (sentence.length < 20 || sentence.length > 200) {
        score *= 0.5;
      }

      return score;
    });
  }

  async saveSummary(url, summary, contentLength) {
    const result = await chrome.storage.local.get(['summaries']);
    const summaries = result.summaries || {};
    
    summaries[url] = {
      ...summary,
      contentLength,
      url
    };
    
    await chrome.storage.local.set({ summaries });
  }

  async getSummary(url) {
    const normalizedUrl = this.normalizeUrl(url);
    const result = await chrome.storage.local.get(['summaries']);
    const summaries = result.summaries || {};
    return summaries[normalizedUrl] || null;
  }

  normalizeUrl(url) {
    try {
      const urlObj = new URL(url);
      return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
    } catch (e) {
      return url;
    }
  }

  getStats(summary, originalLength) {
    const summaryLength = summary.content.length;
    const compressionRatio = ((1 - summaryLength / originalLength) * 100).toFixed(1);
    
    return {
      originalLength,
      summaryLength,
      compressionRatio: `${compressionRatio}%`
    };
  }
}

// 初始化
if (typeof window !== 'undefined') {
  window.bbSummarizer = new Summarizer();
}
