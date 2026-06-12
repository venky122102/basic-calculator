/**
 * calculator.js
 * Basic Calculator — all logic
 * Separated from HTML to allow strict CSP (script-src 'self'; no unsafe-inline)
 *
 * @version 1.2.0
 * @license MIT
 */

'use strict';

// Named constants — no magic numbers
const MAX_OPERAND_LENGTH = 15;  // max digits before display truncation
const FLASH_DURATION_MS  = 120; // keyboard button flash animation duration (ms)
const OP_SYMBOLS = { '+': '+', '-': '\u2212', '*': '\u00d7', '/': '\u00f7' };

/**
 * Calculator class — encapsulates all state and behaviour.
 * No eval(), no global mutable state, no unsafe-inline code.
 */
class Calculator {
  /**
   * @param {HTMLElement} displayCurrentEl    — the main number display element
   * @param {HTMLElement} displayExpressionEl — the expression/history display element
   * @param {NodeList}    operatorBtns        — cached list of operator buttons
   */
  constructor(displayCurrentEl, displayExpressionEl, operatorBtns) {
    this.displayCurrent    = displayCurrentEl;
    this.displayExpression = displayExpressionEl;
    this.operatorButtons   = operatorBtns;
    this.currentOperand    = '0';
    this.previousOperand   = '';
    this.operator          = null;
    this.shouldReset       = false;
  }

  // —— Arithmetic engine (no eval) —————————————————————————

  /**
   * Performs the arithmetic operation safely via switch/case.
   * @param {number} prev
   * @param {number} curr
   * @param {string} op  one of +, -, *, /
   * @returns {number}
   */
  calculate(prev, curr, op) {
    switch (op) {
      case '+': return prev + curr;
      case '-': return prev - curr;
      case '*': return prev * curr;
      case '/':
        if (curr === 0) return NaN; // division-by-zero — handled upstream
        return prev / curr;
      default: return curr;
    }
  }

  /**
   * Formats a computation result for display.
   * • Up to 10 significant digits
   * • Exponential notation for very large/small values
   * @param {number} num
   * @returns {string}
   */
  formatNumber(num) {
    if (!isFinite(num) || isNaN(num)) return 'Error';
    const abs = Math.abs(num);
    if (abs !== 0 && (abs >= 1e10 || abs < 1e-7)) return num.toExponential(4);
    return parseFloat(num.toPrecision(10)).toString();
  }

  // —— Display helpers —————————————————————————————————

  updateDisplay(value, isError) {
    this.displayCurrent.textContent = value; // textContent — never innerHTML
    this.displayCurrent.classList.toggle('error',  !!isError);
    this.displayCurrent.classList.toggle('shrink', value.length > 10);
  }

  updateExpression() {
    if (this.operator && this.previousOperand !== '') {
      const sym = OP_SYMBOLS[this.operator] || this.operator;
      this.displayExpression.textContent = `${this.previousOperand} ${sym}`;
    } else {
      this.displayExpression.textContent = '';
    }
  }

  highlightOperator(op) {
    this.operatorButtons.forEach(btn =>
      btn.classList.toggle('active', btn.dataset.value === op)
    );
  }

  // —— Core evaluation ————————————————————————————————

  evaluateExpression(finalise) {
    if (this.operator === null || this.previousOperand === '') return false;
    const rightStr = (this.currentOperand !== '' && !this.shouldReset)
      ? this.currentOperand : this.previousOperand;
    const prev = parseFloat(this.previousOperand);
    const curr = parseFloat(rightStr);
    if (isNaN(prev) || isNaN(curr)) { this.updateDisplay('Error', true); this.resetState(); return false; }
    if (this.operator === '/' && curr === 0) {
      this.updateDisplay('Error', true);
      this.displayExpression.textContent = `${this.previousOperand} ${OP_SYMBOLS['/']} 0 =`;
      this.resetState(); return false;
    }
    const result = this.calculate(prev, curr, this.operator);
    if (!isFinite(result)) { this.updateDisplay('Error', true); this.resetState(); return false; }
    const formatted = this.formatNumber(result);
    const sym = OP_SYMBOLS[this.operator] || this.operator;
    this.displayExpression.textContent = `${this.previousOperand} ${sym} ${rightStr} =`;
    this.updateDisplay(formatted);
    this.currentOperand = formatted;
    this.previousOperand = formatted;
    if (finalise) { this.operator = null; this.shouldReset = true; this.highlightOperator(null); }
    return true;
  }

  // —— Input handlers ————————————————————————————————

  handleDigit(digit) {
    if (this.shouldReset) { this.currentOperand = ''; this.shouldReset = false; }
    if (this.currentOperand === '0' && digit !== '.') {
      this.currentOperand = digit;
    } else {
      if (this.currentOperand.length >= MAX_OPERAND_LENGTH) return;
      this.currentOperand += digit;
    }
    this.updateDisplay(this.currentOperand);
    this.updateExpression();
  }

  handleDecimal() {
    if (this.shouldReset) { this.currentOperand = '0'; this.shouldReset = false; }
    if (this.currentOperand.includes('.')) return;
    if (this.currentOperand === '') this.currentOperand = '0';
    this.currentOperand += '.';
    this.updateDisplay(this.currentOperand);
  }

  handleOperator(op) {
    if (this.currentOperand === '' && this.previousOperand === '') return;
    if (this.operator !== null && this.currentOperand !== '' && !this.shouldReset) {
      this.evaluateExpression(false);
    }
    if (this.displayCurrent.classList.contains('error')) return;
    if (this.currentOperand !== '') this.previousOperand = this.currentOperand;
    this.operator    = op;
    this.shouldReset = true;
    this.highlightOperator(op);
    this.updateExpression();
  }

  handleEquals()    { this.evaluateExpression(true); }

  handleClear()     { this.resetState(); this.updateDisplay('0'); this.displayExpression.textContent = ''; }

  handleBackspace() {
    if (this.shouldReset || this.displayCurrent.classList.contains('error')) { this.handleClear(); return; }
    this.currentOperand = this.currentOperand.length <= 1 ? '0' : this.currentOperand.slice(0, -1);
    this.updateDisplay(this.currentOperand);
  }

  resetState() {
    this.currentOperand = ''; this.previousOperand = '';
    this.operator = null; this.shouldReset = false;
    this.highlightOperator(null);
  }
}

// —— Initialisation ————————————————————————————————————

const calc = new Calculator(
  document.getElementById('current'),
  document.getElementById('expression'),
  document.querySelectorAll('.btn--operator')
);

// Button click events (event delegation on the grid)
document.querySelector('.btn-grid').addEventListener('click', function (e) {
  const btn = e.target.closest('.btn');
  if (!btn || btn.disabled) return;
  const { action, value } = btn.dataset;
  switch (action) {
    case 'digit':     calc.handleDigit(value);    break;
    case 'operator':  calc.handleOperator(value); break;
    case 'equals':    calc.handleEquals();        break;
    case 'decimal':   calc.handleDecimal();       break;
    case 'clear':     calc.handleClear();         break;
    case 'backspace': calc.handleBackspace();     break;
  }
});

// Keyboard support
document.addEventListener('keydown', function (e) {
  const k = e.key;
  if (/^[0-9]$/.test(k))               { e.preventDefault(); calc.handleDigit(k);    flashButton(`[data-value="${k}"][data-action="digit"]`);    return; }
  if (['+','-','*','/'].includes(k))    { e.preventDefault(); calc.handleOperator(k); flashButton(`[data-value="${k}"][data-action="operator"]`); return; }
  if (k === '.' || k === ',')           { e.preventDefault(); calc.handleDecimal();   flashButton('[data-action="decimal"]');                        return; }
  if (k === 'Enter' || k === '=')       { e.preventDefault(); calc.handleEquals();    flashButton('[data-action="equals"]');                         return; }
  if (k === 'Backspace')                { e.preventDefault(); calc.handleBackspace(); flashButton('[data-action="backspace"]');                      return; }
  if (k === 'Escape' || k === 'Delete') { e.preventDefault(); calc.handleClear();     flashButton('[data-action="clear"]');                          return; }
});

/**
 * Briefly highlights the button matching the keyboard key press.
 * @param {string} selector - CSS selector for the button
 */
function flashButton(selector) {
  const btn = document.querySelector(selector);
  if (!btn) return;
  btn.classList.add('flash');
  setTimeout(() => btn.classList.remove('flash'), FLASH_DURATION_MS);
}
