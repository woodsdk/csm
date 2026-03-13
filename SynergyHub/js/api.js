/* ═══════════════════════════════════════════
   SynergyHub API Facade

   Migration point: swap localStorage → REST API
   UI code calls ONLY TaskAPI/CustomerAPI methods.
   All methods return Promises (async-ready).
   ═══════════════════════════════════════════ */

const TaskAPI = {
  async getAll(filters = {}) {
    let tasks = Store.getTasks();

    if (filters.status) tasks = tasks.filter(t => t.status === filters.status);
    if (filters.priority) tasks = tasks.filter(t => t.priority === filters.priority);
    if (filters.type) tasks = tasks.filter(t => t.type === filters.type);
    if (filters.assignee_id) tasks = tasks.filter(t => t.assignee_id === filters.assignee_id);
    if (filters.customer_id) tasks = tasks.filter(t => t.customer_id === filters.customer_id);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      tasks = tasks.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.customer_name || '').toLowerCase().includes(q) ||
        (t.tags || []).some(tag => tag.toLowerCase().includes(q))
      );
    }

    return tasks;
  },

  async get(id) {
    return Store.getTask(id);
  },

  async create(data) {
    return Store.createTask(data);
  },

  async update(id, data) {
    return Store.updateTask(id, data);
  },

  async delete(id) {
    return Store.deleteTask(id);
  }
};

const CustomerAPI = {
  async getAll() {
    return Store.getCustomers();
  },

  async get(id) {
    return Store.getCustomer(id);
  },

  async create(data) {
    return Store.createCustomer(data);
  },

  async update(id, data) {
    return Store.updateCustomer(id, data);
  }
};

const TeamAPI = {
  async getAll() {
    return Store.getTeamMembers();
  }
};
