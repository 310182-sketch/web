// QR Code Generator - QR 碼生成器
class QRCodeGenerator {
  constructor() {
    this.errorCorrectionLevel = 'M'; // L, M, Q, H
  }

  // 生成 QR Code (使用純 JS 實現)
  async generateQRCode(text, options = {}) {
    const size = options.size || 256;
    const color = options.color || '#000000';
    const bgColor = options.bgColor || '#ffffff';
    
    try {
      // 使用 Canvas API 生成 QR Code
      const qr = this.createQRMatrix(text);
      const canvas = this.renderQRCanvas(qr, size, color, bgColor);
      
      return {
        success: true,
        dataUrl: canvas.toDataURL('image/png'),
        canvas: canvas
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 為當前頁面生成 QR Code
  async generateForCurrentPage() {
    const url = window.location.href;
    const title = document.title;
    
    return await this.generateQRCode(url, {
      size: 256,
      metadata: { url, title }
    });
  }

  // 簡化的 QR Code 矩陣生成 (使用第三方庫的邏輯)
  createQRMatrix(text) {
    // 這是一個簡化版本，實際應使用完整的 QR Code 算法
    // 為了保持代碼簡潔，這裡使用基礎實現
    
    // 實際項目中應使用 qrcode.js 或類似庫
    // 這裡提供一個基礎框架
    
    const size = this.calculateQRSize(text);
    const matrix = Array(size).fill(0).map(() => Array(size).fill(0));
    
    // 添加定位圖案 (簡化版)
    this.addFinderPatterns(matrix);
    
    // 編碼數據 (簡化版)
    this.encodeData(matrix, text);
    
    return matrix;
  }

  calculateQRSize(text) {
    // 根據文字長度計算 QR Code 大小
    const length = text.length;
    if (length <= 25) return 21;
    if (length <= 47) return 25;
    if (length <= 77) return 29;
    return 33;
  }

  addFinderPatterns(matrix) {
    const size = matrix.length;
    const pattern = [
      [1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 0, 0, 0, 1],
      [1, 0, 1, 1, 1, 0, 1],
      [1, 0, 1, 1, 1, 0, 1],
      [1, 0, 1, 1, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 1],
      [1, 1, 1, 1, 1, 1, 1]
    ];

    // 左上角
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        matrix[i][j] = pattern[i][j];
      }
    }

    // 右上角
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        matrix[i][size - 7 + j] = pattern[i][j];
      }
    }

    // 左下角
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        matrix[size - 7 + i][j] = pattern[i][j];
      }
    }
  }

  encodeData(matrix, text) {
    // 簡化的數據編碼
    // 實際應使用完整的 QR Code 編碼算法
    let row = matrix.length - 1;
    let col = matrix.length - 1;
    
    for (let i = 0; i < text.length && row >= 0; i++) {
      const charCode = text.charCodeAt(i);
      for (let bit = 0; bit < 8; bit++) {
        if (matrix[row][col] === 0) {
          matrix[row][col] = (charCode >> bit) & 1;
        }
        col--;
        if (col < 7) {
          col = matrix.length - 1;
          row--;
        }
      }
    }
  }

  renderQRCanvas(matrix, size, color, bgColor) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const moduleSize = Math.floor(size / matrix.length);
    canvas.width = moduleSize * matrix.length;
    canvas.height = moduleSize * matrix.length;
    
    // 背景
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // QR 模塊
    ctx.fillStyle = color;
    for (let row = 0; row < matrix.length; row++) {
      for (let col = 0; col < matrix[row].length; col++) {
        if (matrix[row][col]) {
          ctx.fillRect(
            col * moduleSize,
            row * moduleSize,
            moduleSize,
            moduleSize
          );
        }
      }
    }
    
    return canvas;
  }

  // 使用更簡單的方法：生成 Google Charts API QR Code
  generateQRCodeUrl(text, size = 256) {
    const encoded = encodeURIComponent(text);
    return `https://chart.googleapis.com/chart?cht=qr&chs=${size}x${size}&chl=${encoded}`;
  }

  // 下載 QR Code
  downloadQRCode(dataUrl, filename = 'qrcode.png') {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    link.click();
  }
}

// Sidepanel 環境中無需 window 檢查
// 直接用於工具功能
