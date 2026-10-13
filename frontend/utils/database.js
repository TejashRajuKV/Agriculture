import { UserRole } from './types.js';

class Database {
  constructor() {
    this.users = [];
    this.currentUser = null;
    this.loadFromStorage();
  }

  loadFromStorage() {
    try {
      const stored = localStorage.getItem('agriloop_database');
      if (stored) {
        const data = JSON.parse(stored);
        this.users = data.users || [];
        this.currentUser = data.currentUser || null;
      }
    } catch (error) {
      console.error('Failed to load database:', error);
    }
  }

  saveToStorage() {
    try {
      const data = {
        users: this.users,
        currentUser: this.currentUser
      };
      localStorage.setItem('agriloop_database', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save database:', error);
    }
  }

  registerUser(authData, role) {
    const existingUser = this.users.find(u => u.email === authData.email);
    
    if (existingUser) {
      existingUser.role = role;
      existingUser.lastLogin = new Date().toISOString();
      this.currentUser = existingUser;
    } else {
      const newUser = {
        ...authData,
        role,
        carbonPoints: this.getDefaultCarbonPoints(role),
        walletBalance: this.getDefaultWalletBalance(role),
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString()
      };
      this.users.push(newUser);
      this.currentUser = newUser;
    }
    
    this.saveToStorage();
    return this.currentUser;
  }

  getCurrentUser() {
    return this.currentUser;
  }

  logout() {
    this.currentUser = null;
    this.saveToStorage();
  }

  updateUserPoints(points) {
    if (this.currentUser) {
      this.currentUser.carbonPoints += points;
      this.saveToStorage();
    }
  }

  updateUserBalance(amount) {
    if (this.currentUser) {
      this.currentUser.walletBalance += amount;
      this.saveToStorage();
    }
  }

  // Adjust any registered user (e.g. the other side of a sale), matched by email or name
  adjustUser({ email, name }, { balance = 0, points = 0 }) {
    const target = this.users.find((u) => (email ? u.email === email : u.name === name));
    if (!target) return null;
    target.walletBalance = (target.walletBalance || 0) + balance;
    target.carbonPoints = (target.carbonPoints || 0) + points;
    if (this.currentUser && this.currentUser.email === target.email) {
      this.currentUser = target;
    }
    this.saveToStorage();
    return target;
  }

  getDefaultCarbonPoints(role) {
    switch (role) {
      case UserRole.FARMER: return 1250;
      case UserRole.BUYER: return 350;
      case UserRole.BIOGAS: return 800;
      case UserRole.HOUSEHOLD: return 50;
      default: return 0;
    }
  }

  getDefaultWalletBalance(role) {
    switch (role) {
      case UserRole.FARMER: return 45000;
      case UserRole.BUYER: return 500000;
      case UserRole.BIOGAS: return 250000;
      default: return 0;
    }
  }
}

export const database = new Database();