// Todo Manager - 待辦事項管理
class TodoManager {
  constructor() {
    this.categories = ['工作', '個人', '學習', '其他'];
    this.priorities = ['高', '中', '低'];
  }

  async init() {
    // 初始化時可執行的任務
  }

  // 獲取所有待辦事項
  async getAllTodos() {
    const result = await chrome.storage.local.get(['todos']);
    return result.todos || [];
  }

  // 獲取特定分類的待辦事項
  async getTodosByCategory(category) {
    const todos = await this.getAllTodos();
    return todos.filter(todo => todo.category === category);
  }

  // 獲取待完成的待辦事項
  async getPendingTodos() {
    const todos = await this.getAllTodos();
    return todos.filter(todo => !todo.completed);
  }

  // 獲取已完成的待辦事項
  async getCompletedTodos() {
    const todos = await this.getAllTodos();
    return todos.filter(todo => todo.completed);
  }

  // 新增待辦事項
  async addTodo(todoData) {
    const todos = await this.getAllTodos();
    
    const newTodo = {
      id: crypto.randomUUID(),
      title: todoData.title,
      description: todoData.description || '',
      category: todoData.category || '其他',
      priority: todoData.priority || '中',
      dueDate: todoData.dueDate || null,
      completed: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    todos.unshift(newTodo);
    await chrome.storage.local.set({ todos });
    
    this.notifyUpdate();
    return newTodo;
  }

  // 更新待辦事項
  async updateTodo(id, updates) {
    const todos = await this.getAllTodos();
    const index = todos.findIndex(todo => todo.id === id);
    
    if (index === -1) return null;

    todos[index] = {
      ...todos[index],
      ...updates,
      updatedAt: Date.now()
    };

    await chrome.storage.local.set({ todos });
    this.notifyUpdate();
    return todos[index];
  }

  // 切換完成狀態
  async toggleComplete(id) {
    const todos = await this.getAllTodos();
    const todo = todos.find(t => t.id === id);
    
    if (!todo) return null;

    return await this.updateTodo(id, { 
      completed: !todo.completed,
      completedAt: !todo.completed ? Date.now() : null
    });
  }

  // 刪除待辦事項
  async deleteTodo(id) {
    const todos = await this.getAllTodos();
    const filtered = todos.filter(todo => todo.id !== id);
    
    await chrome.storage.local.set({ todos: filtered });
    this.notifyUpdate();
    return true;
  }

  // 批量刪除已完成的待辦事項
  async clearCompleted() {
    const todos = await this.getAllTodos();
    const filtered = todos.filter(todo => !todo.completed);
    
    await chrome.storage.local.set({ todos: filtered });
    this.notifyUpdate();
    return true;
  }

  // 搜尋待辦事項
  async searchTodos(query) {
    const todos = await this.getAllTodos();
    const lowerQuery = query.toLowerCase();
    
    return todos.filter(todo => 
      todo.title.toLowerCase().includes(lowerQuery) ||
      todo.description.toLowerCase().includes(lowerQuery)
    );
  }

  // 獲取統計數據
  async getStats() {
    const todos = await this.getAllTodos();
    
    return {
      total: todos.length,
      pending: todos.filter(t => !t.completed).length,
      completed: todos.filter(t => t.completed).length,
      overdue: todos.filter(t => 
        !t.completed && 
        t.dueDate && 
        new Date(t.dueDate) < new Date()
      ).length,
      today: todos.filter(t => 
        !t.completed && 
        t.dueDate && 
        this.isToday(new Date(t.dueDate))
      ).length
    };
  }

  // 判斷是否為今天
  isToday(date) {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  }

  // 格式化日期
  formatDate(timestamp) {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date < today) {
      return '已逾期';
    } else if (date.getTime() === today.getTime()) {
      return '今天';
    } else if (date.getTime() === tomorrow.getTime()) {
      return '明天';
    } else {
      return date.toLocaleDateString('zh-TW', { 
        month: 'short', 
        day: 'numeric' 
      });
    }
  }

  // 格式化時間
  formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return '剛剛';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分鐘前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小時前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
    
    return date.toLocaleDateString('zh-TW', { 
      month: 'short', 
      day: 'numeric'
    });
  }

  // 通知更新
  notifyUpdate() {
    window.postMessage({ type: 'BB_TODO_UPDATED' }, '*');
  }

  // 匯出待辦事項
  async exportTodos() {
    const todos = await this.getAllTodos();
    const dataStr = JSON.stringify(todos, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `todos-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
  }
}

// Sidepanel 環境中使用，無需 window 初始化
