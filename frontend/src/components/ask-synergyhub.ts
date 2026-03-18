/* ═══════════════════════════════════════════
   Ask SynergyHub — AI Knowledge Assistant
   ═══════════════════════════════════════════ */

import { AskAPI } from '../api';
import { escapeHtml } from '../utils';
import { t } from '../i18n';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const AskSynergyHub = {
  _messages: [] as ChatMessage[],
  _isLoading: false,

  /* ── Main render ── */
  async render(): Promise<string> {
    const hasMessages = this._messages.length > 0;

    const welcomeHTML = !hasMessages ? `
      <div class="ask-welcome">
        <div class="ask-welcome-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
            <path d="M20 3v4"/><path d="M22 5h-4"/>
          </svg>
        </div>
        <h3 class="ask-welcome-title">Ask SynergyHub</h3>
        <p class="ask-welcome-desc">${t('ask.desc')}<br>${t('ask.subtitle')}</p>
        <ul class="ask-welcome-features">
          <li>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            ${t('ask.feature1')}
          </li>
          <li>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            ${t('ask.feature2')}
          </li>
          <li>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            ${t('ask.feature3')}
          </li>
          <li>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            ${t('ask.feature4')}
          </li>
          <li>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            ${t('ask.feature5')}
          </li>
        </ul>
        <div class="ask-quick-btns">
          <button class="ask-quick-btn" onclick="AskSynergyHub.askQuick('${t('ask.q1').replace(/'/g, "\\'")}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
            ${t('ask.q1short')}
          </button>
          <button class="ask-quick-btn" onclick="AskSynergyHub.askQuick('${t('ask.q2').replace(/'/g, "\\'")}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            ${t('ask.q2short')}
          </button>
          <button class="ask-quick-btn" onclick="AskSynergyHub.askQuick('${t('ask.q3').replace(/'/g, "\\'")}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            ${t('ask.q3short')}
          </button>
          <button class="ask-quick-btn" onclick="AskSynergyHub.askQuick('${t('ask.q4').replace(/'/g, "\\'")}')">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            ${t('ask.q4short')}
          </button>
        </div>
      </div>
    ` : '';

    const messagesHTML = hasMessages ? this._messages.map(msg => `
      <div class="ask-msg ask-msg-${msg.role}">
        ${msg.role === 'assistant' ? `
          <div class="ask-msg-avatar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
            </svg>
          </div>
        ` : ''}
        <div class="ask-msg-content">${this._formatMessage(msg.content)}</div>
      </div>
    `).join('') : '';

    const typingHTML = this._isLoading ? `
      <div class="ask-msg ask-msg-assistant">
        <div class="ask-msg-avatar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
          </svg>
        </div>
        <div class="ask-msg-content ask-typing">
          <span class="ask-typing-dot"></span>
          <span class="ask-typing-dot"></span>
          <span class="ask-typing-dot"></span>
        </div>
      </div>
    ` : '';

    return `
      <div class="ask-container">
        <div class="ask-messages" id="ask-messages">
          ${welcomeHTML}
          ${messagesHTML}
          ${typingHTML}
        </div>
        <div class="ask-input-bar">
          <div class="ask-input-wrapper">
            <textarea class="ask-input" id="ask-input" rows="1" placeholder="${t('ask.placeholder')}" onkeydown="AskSynergyHub.handleKey(event)"></textarea>
            <button class="ask-send-btn" id="ask-send-btn" onclick="AskSynergyHub.sendMessage()" ${this._isLoading ? 'disabled' : ''}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
          <div class="ask-input-hint">${t('ask.disclaimer')}</div>
        </div>
      </div>
    `;
  },

  /* ── Format message (basic markdown) ── */
  _formatMessage(text: string): string {
    let html = escapeHtml(text);

    // Bold: **text**
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // Headers: ### or ##
    html = html.replace(/^###\s+(.+)$/gm, '<strong class="ask-msg-h3">$1</strong>');
    html = html.replace(/^##\s+(.+)$/gm, '<strong class="ask-msg-h2">$1</strong>');

    // Inline code: `text`
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Bullet lists: group consecutive lines starting with - or •
    html = html.replace(/(^[\-\u2022]\s+.+(\n|$))+/gm, (block) => {
      const items = block.trim().split('\n')
        .map(line => line.replace(/^[\-\u2022]\s+/, ''))
        .map(line => `<li>${line}</li>`)
        .join('');
      return `\n<ul>${items}</ul>\n`;
    });

    // Numbered lists: group consecutive lines starting with 1. 2. etc
    html = html.replace(/(^\d+\.\s+.+(\n|$))+/gm, (block) => {
      const items = block.trim().split('\n')
        .map(line => line.replace(/^\d+\.\s+/, ''))
        .map(line => `<li>${line}</li>`)
        .join('');
      return `\n<ol>${items}</ol>\n`;
    });

    // Collapse multiple newlines to max 2
    html = html.replace(/\n{3,}/g, '\n\n');

    // Line breaks (only remaining \n)
    html = html.replace(/\n/g, '<br>');

    // Clean up stray <br> around block elements
    html = html.replace(/<br><ul>/g, '<ul>');
    html = html.replace(/<\/ul><br>/g, '</ul>');
    html = html.replace(/<br><ol>/g, '<ol>');
    html = html.replace(/<\/ol><br>/g, '</ol>');
    html = html.replace(/^<br>/, '');
    html = html.replace(/<br>$/, '');

    return html;
  },

  /* ── Handle keyboard input ── */
  handleKey(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.sendMessage();
    }
  },

  /* ── Send message ── */
  async sendMessage(): Promise<void> {
    const inputEl = document.getElementById('ask-input') as HTMLTextAreaElement | null;
    if (!inputEl || this._isLoading) return;

    const message = inputEl.value.trim();
    if (!message) return;

    // Add user message
    this._messages.push({ role: 'user', content: message });
    inputEl.value = '';
    this._isLoading = true;

    // Re-render to show user message + typing indicator
    await this._rerender();
    this._scrollToBottom();

    try {
      const result = await AskAPI.sendMessage(message, this._messages.slice(0, -1));
      if (result.response) {
        this._messages.push({ role: 'assistant', content: result.response });
      } else {
        this._messages.push({ role: 'assistant', content: result.error || t('ask.errorResponse') });
      }
    } catch {
      this._messages.push({ role: 'assistant', content: t('ask.errorConnection') });
    } finally {
      this._isLoading = false;
      await this._rerender();
      this._scrollToBottom();

      // Focus input again
      const newInput = document.getElementById('ask-input') as HTMLTextAreaElement | null;
      if (newInput) newInput.focus();
    }
  },

  /* ── Quick question (from chip buttons) ── */
  async askQuick(question: string): Promise<void> {
    const inputEl = document.getElementById('ask-input') as HTMLTextAreaElement | null;
    if (inputEl) {
      inputEl.value = question;
    }
    await this.sendMessage();
  },

  /* ── Re-render just the chat area ── */
  async _rerender(): Promise<void> {
    const container = document.querySelector('.ask-container');
    if (!container) {
      // Full page re-render
      (window as any).App.render();
      return;
    }
    const html = await this.render();
    const parent = container.parentElement;
    if (parent) {
      parent.innerHTML = html;
    }
  },

  /* ── Scroll to bottom ── */
  _scrollToBottom(): void {
    const messagesEl = document.getElementById('ask-messages');
    if (messagesEl) {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }
  },
};

// Expose globally
(window as any).AskSynergyHub = AskSynergyHub;
