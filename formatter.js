// Formatter - 格式化工具
class Formatter {
  constructor() {
    this.supportedFormats = ['json', 'xml', 'css', 'html'];
  }

  // JSON 格式化
  formatJSON(input) {
    try {
      const parsed = JSON.parse(input);
      return {
        success: true,
        formatted: JSON.stringify(parsed, null, 2),
        minified: JSON.stringify(parsed)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // XML 格式化
  formatXML(input) {
    try {
      const PADDING = '  ';
      const reg = /(>)(<)(\/*)/g;
      let formatted = input.replace(reg, '$1\n$2$3');
      let pad = 0;
      
      formatted = formatted.split('\n').map(line => {
        let indent = 0;
        if (line.match(/.+<\/\w[^>]*>$/)) {
          indent = 0;
        } else if (line.match(/^<\/\w/)) {
          if (pad !== 0) {
            pad -= 1;
          }
        } else if (line.match(/^<\w([^>]*[^\/])?>.*$/)) {
          indent = 1;
        } else {
          indent = 0;
        }

        const padding = PADDING.repeat(pad);
        pad += indent;
        return padding + line;
      }).join('\n');

      return {
        success: true,
        formatted: formatted.trim()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // CSS 格式化
  formatCSS(input) {
    try {
      let formatted = input
        .replace(/\s*{\s*/g, ' {\n  ')
        .replace(/;\s*/g, ';\n  ')
        .replace(/\s*}\s*/g, '\n}\n\n')
        .replace(/,\s*/g, ',\n')
        .trim();

      return {
        success: true,
        formatted: formatted
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // HTML 格式化
  formatHTML(input) {
    try {
      const PADDING = '  ';
      const reg = /(>)(<)(\/*)/g;
      let formatted = input.replace(reg, '$1\n$2$3');
      let pad = 0;
      
      formatted = formatted.split('\n').map(line => {
        let indent = 0;
        if (line.match(/.+<\/\w[^>]*>$/)) {
          indent = 0;
        } else if (line.match(/^<\/\w/)) {
          if (pad !== 0) {
            pad -= 1;
          }
        } else if (line.match(/^<\w([^>]*[^\/])?>.*$/)) {
          indent = 1;
        } else {
          indent = 0;
        }

        const padding = PADDING.repeat(pad);
        pad += indent;
        return padding + line;
      }).join('\n');

      return {
        success: true,
        formatted: formatted.trim()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 自動檢測格式
  detectFormat(input) {
    const trimmed = input.trim();
    
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return 'json';
    } else if (trimmed.startsWith('<')) {
      if (trimmed.includes('<?xml')) {
        return 'xml';
      } else {
        return 'html';
      }
    } else if (trimmed.includes('{') && trimmed.includes(':')) {
      return 'css';
    }
    
    return 'unknown';
  }

  // 統一格式化入口
  format(input, type = null) {
    const formatType = type || this.detectFormat(input);
    
    switch (formatType) {
      case 'json':
        return this.formatJSON(input);
      case 'xml':
        return this.formatXML(input);
      case 'css':
        return this.formatCSS(input);
      case 'html':
        return this.formatHTML(input);
      default:
        return {
          success: false,
          error: '無法識別格式'
        };
    }
  }

  // 壓縮 JSON
  minifyJSON(input) {
    try {
      const parsed = JSON.parse(input);
      return {
        success: true,
        minified: JSON.stringify(parsed)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 驗證 JSON
  validateJSON(input) {
    try {
      JSON.parse(input);
      return {
        valid: true,
        message: 'JSON 格式正確'
      };
    } catch (error) {
      return {
        valid: false,
        message: error.message,
        position: this.getErrorPosition(input, error)
      };
    }
  }

  // 獲取錯誤位置
  getErrorPosition(input, error) {
    const match = error.message.match(/position (\d+)/);
    if (match) {
      const pos = parseInt(match[1]);
      const lines = input.substring(0, pos).split('\n');
      return {
        line: lines.length,
        column: lines[lines.length - 1].length + 1
      };
    }
    return null;
  }
}

// Sidepanel 環境中無需 window 檢查
// 直接用於工具功能
