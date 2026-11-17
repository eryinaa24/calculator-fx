/**
 * ============================================================================
 * FAIL: script.js
 * Kalkulator Saintifik Interaktif Casio ClassWiz fx-570EX
 * ============================================================================
 * Ciri-ciri Utama:
 * 1. Menyokong pendaraban implisit: 4cos(50), 4*cos(50), 4cos50, 2(3), (4)5, 2π
 * 2. Algoritma BODMAS/PEMDAS untuk pengiraan berantai
 * 3. Trigonometri (sin, cos, tan, asin, acos, atan) dalam DARJAH (Degrees)
 * 4. Pembetulan ralat titik apung IEEE 754 (0.1 + 0.2 = 0.3)
 * 5. Pengendalian ralat (Math ERROR & Syntax ERROR)
 * 6. Sokongan Light Mode / Dark Mode, SHIFT, ALPHA, dan S⇔D (Pecahan)
 * ============================================================================
 */

// 1. KEADAAN (STATE) KALKULATOR
const calcState = {
    expression: '',         // Rentetan input ekspresi semasa (baris atas)
    lastAnswer: '0',        // Jawapan terakhir (Ans)
    memoryM: 0,             // Memori simpanan M+ / M-
    isShift: false,         // Status butang SHIFT
    isAlpha: false,         // Status butang ALPHA
    justEvaluated: false,   // Penanda sama ada '=' baru ditekan
    showingFraction: false, // Penanda mod pecahan S⇔D
    history: [],            // Senarai sejarah pengiraan
    historyIndex: -1        // Indeks sejarah untuk navigasi D-Pad
};

// 2. RUJUKAN ELEMEN DOM (Menyokong pelbagai variasi ID pada HTML anda)
const expressionTextEl = document.getElementById('expressionText') || document.getElementById('expressionDisplay') || document.getElementById('expression');
const resultDisplayEl  = document.getElementById('resultDisplay')  || document.getElementById('result');
const indShiftEl       = document.getElementById('indShift');
const indAlphaEl       = document.getElementById('indAlpha');
const shiftBtnEl       = document.getElementById('shiftBtn');
const alphaBtnEl       = document.getElementById('alphaBtn');
const themeToggleBtn   = document.getElementById('themeToggleBtn') || document.getElementById('theme-toggle');
const themeIcon        = document.getElementById('themeIcon');
const themeText        = document.getElementById('themeText');

/**
 * 3. PEMBETULAN KEJITUAN TITIK APUNG (IEEE 754 Floating-Point Error)
 * Memastikan 0.1 + 0.2 = 0.3 tepat dan bukannya 0.30000000000000004
 */
function fixFloatingPoint(num) {
    if (typeof num !== 'number' || !Number.isFinite(num)) return num;
    if (Math.abs(num) < 1e-14) return 0; // Elak hingar kecil seperti sin(180) = 1.22e-16
    const cleaned = Number(Math.round(Number(num + 'e12')) + 'e-12');
    return Number(cleaned.toPrecision(12));
}

/**
 * 4. FUNGSI SAINTIFIK & TRIGONOMETRI DALAM DARJAH (DEGREES)
 * Dipanggil secara dalaman semasa ekspresi matematik dinilai.
 */
const CalcMath = {
    // Penukaran Darjah ke Radian & sebaliknya
    degToRad: (deg) => (deg * Math.PI) / 180,
    radToDeg: (rad) => (rad * 180) / Math.PI,

    sin: (deg) => {
        const norm = ((deg % 360) + 360) % 360;
        if (norm === 0 || norm === 180) return 0;
        if (norm === 30 || norm === 150) return 0.5;
        if (norm === 210 || norm === 330) return -0.5;
        if (norm === 90) return 1;
        if (norm === 270) return -1;
        return fixFloatingPoint(Math.sin(CalcMath.degToRad(deg)));
    },

    cos: (deg) => {
        const norm = ((deg % 360) + 360) % 360;
        if (norm === 90 || norm === 270) return 0;
        if (norm === 60 || norm === 300) return 0.5;
        if (norm === 120 || norm === 240) return -0.5;
        if (norm === 0) return 1;
        if (norm === 180) return -1;
        return fixFloatingPoint(Math.cos(CalcMath.degToRad(deg)));
    },

    tan: (deg) => {
        const norm = ((deg % 180) + 180) % 180;
        // Asimptot pada 90° dan 270° -> Math ERROR
        if (Math.abs(norm - 90) < 1e-12) {
            throw new Error('MATH_ERROR');
        }
        if (norm === 0) return 0;
        if (norm === 45) return 1;
        if (norm === 135) return -1;
        return fixFloatingPoint(Math.tan(CalcMath.degToRad(deg)));
    },

    asin: (val) => {
        if (val < -1 || val > 1) throw new Error('MATH_ERROR');
        return fixFloatingPoint(CalcMath.radToDeg(Math.asin(val)));
    },

    acos: (val) => {
        if (val < -1 || val > 1) throw new Error('MATH_ERROR');
        return fixFloatingPoint(CalcMath.radToDeg(Math.acos(val)));
    },

    atan: (val) => {
        return fixFloatingPoint(CalcMath.radToDeg(Math.atan(val)));
    },

    log: (val) => {
        if (val <= 0) throw new Error('MATH_ERROR');
        return fixFloatingPoint(Math.log10(val));
    },

    ln: (val) => {
        if (val <= 0) throw new Error('MATH_ERROR');
        return fixFloatingPoint(Math.log(val));
    },

    sqrt: (val) => {
        if (val < 0) throw new Error('MATH_ERROR');
        return fixFloatingPoint(Math.sqrt(val));
    },

    cbrt: (val) => {
        return fixFloatingPoint(Math.cbrt(val));
    },

    fact: (n) => {
        if (n < 0 || !Number.isInteger(n) || n > 170) throw new Error('MATH_ERROR');
        let res = 1;
        for (let i = 2; i <= n; i++) res *= i;
        return res;
    }
};

/**
 * 5. ENJIN PENILAIAN EKSPRESI MATEMATIK (BODMAS / PEMDAS & PENDARABAN IMPLISIT)
 * Menyokong:
 * - 4cos(50), 4*cos(50), 4cos50
 * - 2sin(30) + (4)5
 * - Hierarki BODMAS penuh
 */
function evaluateMathematicalExpression(rawExpr) {
    if (!rawExpr || rawExpr.trim() === '') return 0;

    let expression = rawExpr.trim();

    // LANGKAH 1: Gantikan nilai 'Ans' dan simbol paparan asas
    expression = expression
        .replace(/Ans/g, `(${calcState.lastAnswer})`)
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/−/g, '-')
        .replace(/√\(/g, 'sqrt(')
        .replace(/√(\d+(?:\.\d+)?)/g, 'sqrt($1)');

    // LANGKAH 2: Tutup kurungan secara automatik jika pengguna tidak menutup kurungan di hujung
    // Contoh: 사용자가 taip "4cos(50" -> automatik jadi "4cos(50)"
    let openBrackets = 0;
    for (const ch of expression) {
        if (ch === '(') openBrackets++;
        else if (ch === ')') openBrackets--;
        if (openBrackets < 0) throw new Error('SYNTAX_ERROR');
    }
    while (openBrackets > 0) {
        expression += ')';
        openBrackets--;
    }

    // Semak jika ada kurungan kosong "()" atau operator berganda yang tidak sah seperti "5++*3"
    if (/\(\)/.test(expression) || /[*/^]{2,}/.test(expression) || /[+\-*/^][*/^]/.test(expression)) {
        throw new Error('SYNTAX_ERROR');
    }

    // LANGKAH 3: Sokong fungsi tanpa kurungan seperti "4cos50" atau "sin30" -> tukar jadi "4cos(50)"
    expression = expression.replace(
        /(asin|acos|atan|sin|cos|tan|log|ln|sqrt|cbrt)\s*(-?\d+(?:\.\d+)?|π|e)/g,
        '$1($2)'
    );

    // LANGKAH 4: REGEX PENDARABAN IMPLISIT (WAJIB DIJALANKAN SEBELUM NAMA FUNGSI DITUKAR!)
    // a) Nombor/Pemalar diikuti fungsi atau kurungan buka: 4cos(50) -> 4*cos(50), 5(3) -> 5*(3), 2π -> 2*π
    expression = expression.replace(/(\d+|π|e)\s*(asin|acos|atan|sin|cos|tan|log|ln|sqrt|cbrt|\(|π|e)/g, '$1*$2');
    // Ulang sekali lagi untuk kes seperti 2πsin(30) -> 2*π*sin(30)
    expression = expression.replace(/(\d+|π|e)\s*(asin|acos|atan|sin|cos|tan|log|ln|sqrt|cbrt|\(|π|e)/g, '$1*$2');

    // b) Kurungan tutup diikuti nombor, fungsi, pemalar, atau kurungan buka: (4)5 -> (4)*5, (2)(3) -> (2)*(3)
    expression = expression.replace(/\)\s*(\d+|π|e|asin|acos|atan|sin|cos|tan|log|ln|sqrt|cbrt|\()/g, ')*$1');

    // LANGKAH 5: Kendalikan Faktorial (x!) dan Peratus (%)
    expression = expression.replace(/(\d+(?:\.\d+)?)!/g, 'CalcMath.fact($1)');
    expression = expression.replace(/(\d+(?:\.\d+)?)%/g, '($1/100)');

    // LANGKAH 6: Tukarkan operator kuasa (^) kepada (**)
    // Nota: Dalam matematik, -2^2 = -(2^2) = -4. Dalam JS, (-2)**2 tidak dibenarkan tanpa kurungan.
    expression = expression.replace(/\^/g, '**');

    // LANGKAH 7: Tukarkan Pemalar (π, e) dan Fungsi Saintifik kepada panggilan CalcMath
    expression = expression
        .replace(/π/g, '(Math.PI)')
        .replace(/\be\b/g, '(Math.E)')
        .replace(/\b(asin|acos|atan|sin|cos|tan|log|ln|sqrt|cbrt)\(/g, 'CalcMath.$1(');

    // LANGKAH 8: Nilaikan ekspresi dan tangani ralat sintaks / bahagi sifar
    let rawResult;
    try {
        // Gunakan Function constructor dalam skop terkawal bersama objek CalcMath
        rawResult = new Function('CalcMath', `"use strict"; return (${expression});`)(CalcMath);
    } catch (err) {
        if (err.message === 'MATH_ERROR') {
            throw new Error('MATH_ERROR');
        }
        throw new Error('SYNTAX_ERROR');
    }

    // Semak jika jawapan ialah Infinity (contoh: 25 / 0) atau NaN
    if (typeof rawResult !== 'number' || !Number.isFinite(rawResult) || Number.isNaN(rawResult)) {
        throw new Error('MATH_ERROR');
    }

    // LANGKAH 9: Bersihkan hasil menggunakan pembetulan IEEE 754 (supaya 0.1 + 0.2 = 0.3)
    return fixFloatingPoint(rawResult);
}

/**
 * 6. FUNGSI FORMAT & PAPARAN SKRIN LCD
 */
function formatOutputNumber(num) {
    if (typeof num !== 'number') return String(num);
    if (Math.abs(num) >= 1e12 || (Math.abs(num) > 0 && Math.abs(num) < 1e-9)) {
        return num.toExponential(8).replace(/\.?0+e/, 'e');
    }
    return String(fixFloatingPoint(num));
}

function updateDisplay() {
    if (!expressionTextEl) return;
    expressionTextEl.textContent = calcState.expression;
    if (expressionTextEl.parentElement) {
        expressionTextEl.parentElement.scrollLeft = expressionTextEl.parentElement.scrollWidth;
    }
}

// Penukaran Perpuluhan kepada Pecahan untuk butang S⇔D
function decimalToFractionString(val) {
    if (!Number.isFinite(val) || Number.isInteger(val)) return String(val);
    const sign = val < 0 ? '-' : '';
    const absVal = Math.abs(val);
    const tolerance = 1.0e-9;
    let h1 = 1, h2 = 0, k1 = 0, k2 = 1, b = absVal;

    do {
        const a = Math.floor(b);
        let aux = h1; h1 = a * h1 + h2; h2 = aux;
        aux = k1; k1 = a * k1 + k2; k2 = aux;
        if (Math.abs(b - a) < tolerance) break;
        b = 1 / (b - a);
    } while (Math.abs(absVal - h1 / k1) > absVal * tolerance && k1 <= 10000);

    if (k1 > 1 && k1 <= 9999) {
        return `${sign}${h1} / ${k1}`;
    }
    return String(val);
}

/**
 * 7. KAWALAN MOD SHIFT, ALPHA & INPUT BUTANG
 */
function toggleShiftMode(forceState) {
    calcState.isShift = typeof forceState === 'boolean' ? forceState : !calcState.isShift;
    if (calcState.isShift) calcState.isAlpha = false;

    if (indShiftEl) indShiftEl.classList.toggle('active', calcState.isShift);
    if (indAlphaEl) indAlphaEl.classList.toggle('active', calcState.isAlpha);
    if (shiftBtnEl) shiftBtnEl.classList.toggle('active-ring', calcState.isShift);
    if (alphaBtnEl) alphaBtnEl.classList.toggle('active-ring', calcState.isAlpha);

    const btnDel = document.getElementById('btnDel');
    const btnAc  = document.getElementById('btnAc');
    if (btnDel) btnDel.classList.toggle('shift-yellow-mode', calcState.isShift);
    if (btnAc)  btnAc.classList.toggle('shift-yellow-mode', calcState.isShift);
}

function toggleAlphaMode(forceState) {
    calcState.isAlpha = typeof forceState === 'boolean' ? forceState : !calcState.isAlpha;
    if (calcState.isAlpha) calcState.isShift = false;

    if (indAlphaEl) indAlphaEl.classList.toggle('active', calcState.isAlpha);
    if (indShiftEl) indShiftEl.classList.toggle('active', calcState.isShift);
    if (alphaBtnEl) alphaBtnEl.classList.toggle('active-ring', calcState.isAlpha);
    if (shiftBtnEl) shiftBtnEl.classList.toggle('active-ring', calcState.isShift);

    const btnDel = document.getElementById('btnDel');
    const btnAc  = document.getElementById('btnAc');
    if (btnDel) btnDel.classList.remove('shift-yellow-mode');
    if (btnAc)  btnAc.classList.remove('shift-yellow-mode');
}

function insertToken(tokenStr) {
    if (resultDisplayEl) resultDisplayEl.classList.remove('error-text');

    if (calcState.justEvaluated) {
        // Jika pengguna menekan operator (+, -, ×, ÷, ^) selepas '=', sambung kira dengan 'Ans'
        if (['+', '-', '×', '÷', '*', '/', '^', '%'].includes(tokenStr)) {
            calcState.expression = 'Ans' + tokenStr;
        } else {
            calcState.expression = tokenStr;
        }
        calcState.justEvaluated = false;
    } else {
        calcState.expression += tokenStr;
    }

    if (calcState.isShift) toggleShiftMode(false);
    if (calcState.isAlpha) toggleAlphaMode(false);
    updateDisplay();
}

function executeCalculation() {
    if (!calcState.expression.trim()) return;

    try {
        const answer = evaluateMathematicalExpression(calcState.expression);
        const formatted = formatOutputNumber(answer);

        if (resultDisplayEl) {
            resultDisplayEl.classList.remove('error-text');
            resultDisplayEl.textContent = formatted;
        }

        // Simpan ke dalam sejarah
        calcState.history.unshift({ expr: calcState.expression, res: formatted });
        if (calcState.history.length > 15) calcState.history.pop();
        calcState.historyIndex = -1;

        calcState.lastAnswer = formatted;
        calcState.showingFraction = false;
        calcState.justEvaluated = true;
    } catch (err) {
        if (resultDisplayEl) {
            resultDisplayEl.classList.add('error-text');
            resultDisplayEl.textContent = err.message === 'MATH_ERROR' ? 'Math ERROR' : 'Syntax ERROR';
        }
        calcState.justEvaluated = true;
    }
}

function handleButtonAction(action) {
    switch (action) {
        case 'clear':
            calcState.expression = '';
            calcState.justEvaluated = false;
            calcState.showingFraction = false;
            if (resultDisplayEl) {
                resultDisplayEl.classList.remove('error-text');
                resultDisplayEl.textContent = '0';
            }
            toggleShiftMode(false);
            toggleAlphaMode(false);
            updateDisplay();
            break;

        case 'delete':
            if (calcState.justEvaluated) {
                calcState.justEvaluated = false;
                return;
            }
            const multiTokens = ['asin(', 'acos(', 'atan(', 'sqrt(', 'cbrt(', 'sin(', 'cos(', 'tan(', 'log(', 'ln(', 'Ans'];
            let removed = false;
            for (const tok of multiTokens) {
                if (calcState.expression.endsWith(tok)) {
                    calcState.expression = calcState.expression.slice(0, -tok.length);
                    removed = true;
                    break;
                }
            }
            if (!removed) {
                calcState.expression = calcState.expression.slice(0, -1);
            }
            updateDisplay();
            break;

        case 'shift':
            toggleShiftMode();
            break;

        case 'alpha':
            toggleAlphaMode();
            break;

        case 'sin':
            insertToken(calcState.isShift ? 'asin(' : 'sin(');
            break;
        case 'cos':
            insertToken(calcState.isShift ? 'acos(' : 'cos(');
            break;
        case 'tan':
            insertToken(calcState.isShift ? 'atan(' : 'tan(');
            break;
        case 'log':
            insertToken(calcState.isShift ? '10^(' : 'log(');
            break;
        case 'ln':
            insertToken(calcState.isShift ? 'e^(' : 'ln(');
            break;
        case 'square':
            insertToken(calcState.isShift ? '^3' : '^2');
            break;
        case 'sqrt':
            insertToken(calcState.isShift ? 'cbrt(' : 'sqrt(');
            break;
        case 'inv':
            insertToken(calcState.isShift ? '!' : '^(-1)');
            break;

        case 'exp10':
            if (calcState.isShift) insertToken('π');
            else if (calcState.isAlpha) insertToken('e');
            else insertToken('×10^(');
            break;

        case 'ans':
            insertToken(calcState.isShift ? '%' : 'Ans');
            break;

        case 'negate':
            insertToken('-');
            break;

        case 'sd':
            if (resultDisplayEl && !resultDisplayEl.classList.contains('error-text')) {
                const numVal = parseFloat(calcState.lastAnswer);
                if (!Number.isNaN(numVal)) {
                    calcState.showingFraction = !calcState.showingFraction;
                    resultDisplayEl.textContent = calcState.showingFraction
                        ? decimalToFractionString(numVal)
                        : calcState.lastAnswer;
                }
            }
            break;

        case 'mplus':
            executeCalculation();
            if (resultDisplayEl && !resultDisplayEl.classList.contains('error-text')) {
                const cur = parseFloat(calcState.lastAnswer) || 0;
                calcState.memoryM = fixFloatingPoint(calcState.memoryM + (calcState.isShift ? -cur : cur));
                toggleShiftMode(false);
            }
            break;

        case 'sto':
            insertToken(String(calcState.memoryM || calcState.lastAnswer));
            break;

        case 'menu':
            if (themeToggleBtn) themeToggleBtn.click();
            break;

        case 'dpad-up':
            if (calcState.history.length > 0) {
                calcState.historyIndex = Math.min(calcState.history.length - 1, calcState.historyIndex + 1);
                const item = calcState.history[calcState.historyIndex];
                calcState.expression = item.expr;
                if (resultDisplayEl) resultDisplayEl.textContent = item.res;
                updateDisplay();
            }
            break;

        case 'dpad-down':
            if (calcState.history.length > 0 && calcState.historyIndex > 0) {
                calcState.historyIndex--;
                const item = calcState.history[calcState.historyIndex];
                calcState.expression = item.expr;
                if (resultDisplayEl) resultDisplayEl.textContent = item.res;
                updateDisplay();
            }
            break;

        case 'calculate':
            executeCalculation();
            break;
    }
}

/**
 * 8. TOGOL LIGHT MODE / DARK MODE & PENDENGAR ACARA (EVENT LISTENERS)
 */
if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
        const body = document.body;
        const currentTheme = body.getAttribute('data-theme') || 'light';
        const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
        body.setAttribute('data-theme', nextTheme);
        body.classList.toggle('dark-mode', nextTheme === 'dark');

        if (themeIcon) themeIcon.textContent = nextTheme === 'dark' ? '☀️' : '🌙';
        if (themeText) themeText.textContent = nextTheme === 'dark' ? 'Light Mode' : 'Dark Mode';
    });
}

// Pendengar klik untuk semua butang kalkulator
document.querySelectorAll('.calc-btn, .btn-round-silver, .dpad-arrow, button[data-value], button[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-value');
        const action = btn.getAttribute('data-action');
        if (val !== null) {
            insertToken(val);
        } else if (action !== null) {
            handleButtonAction(action);
        }
    });
});

// Sokongan Papan Kekunci (Keyboard Support)
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) return;
    const key = e.key;

    if (/^[0-9.]$/.test(key)) {
        e.preventDefault();
        insertToken(key);
    } else if (key === '+') {
        e.preventDefault();
        insertToken('+');
    } else if (key === '-') {
        e.preventDefault();
        insertToken('-');
    } else if (key === '*') {
        e.preventDefault();
        insertToken('×');
    } else if (key === '/') {
        e.preventDefault();
        insertToken('÷');
    } else if (key === '^' || key === '(' || key === ')' || key === '%') {
        e.preventDefault();
        insertToken(key);
    } else if (key === 'Enter' || key === '=') {
        e.preventDefault();
        executeCalculation();
    } else if (key === 'Backspace') {
        e.preventDefault();
        handleButtonAction('delete');
    } else if (key === 'Escape') {
        e.preventDefault();
        handleButtonAction('clear');
    }
});
