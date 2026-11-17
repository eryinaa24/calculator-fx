/**
 * ============================================================================
 * FAIL: script.js
 * Kalkulator Saintifik Casio ClassWiz fx-570EX
 * Merangkumi:
 * 1. Pengurusan Keadaan (State) & Antaramuka (Light/Dark Mode, Shift Mode)
 * 2. Algoritma BODMAS/PEMDAS untuk pengiraan berantai
 * 3. Fungsi Trigonometri dalam Darjah (Degrees) & Asimptot
 * 4. Pembetulan Ralat Titik Apung IEEE 754 (cth: 0.1 + 0.2 = 0.3)
 * 5. Pengendalian Ralat (Syntax ERROR & Math ERROR)
 * ============================================================================
 */

// Pembolehubah Keadaan (State) Kalkulator
const calcState = {
    expression: '',       // Menyimpan rentetan ekspresi matematik semasa
    lastAnswer: '0',      // Menyimpan jawapan terakhir (Ans)
    memoryM: 0,           // Memori M+ / M-
    isShift: false,       // Status mod fungsi kedua (SHIFT - Kuning)
    isAlpha: false,       // Status mod pemalar/pembolehubah (ALPHA - Merah Jambu)
    justEvaluated: false, // Menandakan sama ada '=' baru sahaja ditekan
    showingFraction: false, // Status pertukaran S⇔D
    history: [],          // Senarai sejarah pengiraan
    historyIndex: -1      // Indeks navigasi D-Pad Atas/Bawah
};

// Rujukan Elemen DOM
const expressionTextEl = document.getElementById('expressionText');
const resultDisplayEl = document.getElementById('resultDisplay');
const indShiftEl = document.getElementById('indShift');
const indAlphaEl = document.getElementById('indAlpha');
const shiftBtnEl = document.getElementById('shiftBtn');
const alphaBtnEl = document.getElementById('alphaBtn');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const themeIcon = document.getElementById('themeIcon');
const themeText = document.getElementById('themeText');

/**
 * 1. PEMBETULAN KEJITUAN NOMBOR PERPULUHAN (IEEE 754 Floating-Point Precision)
 * Mengatasi masalah seperti 0.1 + 0.2 = 0.30000000000000004 atau sin(180) != 0
 */
function fixFloatingPoint(num) {
    if (!Number.isFinite(num)) return num;
    // Jika nilai terlalu hampir dengan sifar (contoh: sin(180) dalam radian -> 1.22e-16)
    if (Math.abs(num) < 1e-14) return 0;
    // Bundarkan kepada 12 angka bererti menggunakan toPrecision untuk membuang hingar binari IEEE 754
    const cleaned = Number(Math.round(Number(num + 'e12')) + 'e-12');
    // Jika masih terdapat ralat kecil pada nombor besar, gunakan toPrecision(12)
    return Number(cleaned.toPrecision(12));
}

/**
 * 2. FUNGSI SAINTIFIK & TRIGONOMETRI DALAM DARJAH (DEGREES)
 * Semua input sudut ditukar daripada Darjah ke Radian: rad = deg * (π / 180)
 */
const MathEngine = {
    // Penukaran Darjah ke Radian
    degToRad: (deg) => (deg * Math.PI) / 180,
    // Penukaran Radian ke Darjah (untuk arc-trigonometri)
    radToDeg: (rad) => (rad * 180) / Math.PI,

    sin: (deg) => {
        // Normalkan sudut kepada julat [0, 360) untuk kejituan sudut kardinal (0, 180, 360)
        const norm = ((deg % 360) + 360) % 360;
        if (norm === 0 || norm === 180) return 0;
        if (norm === 30 || norm === 150) return 0.5;
        if (norm === 210 || norm === 330) return -0.5;
        if (norm === 90) return 1;
        if (norm === 270) return -1;
        return fixFloatingPoint(Math.sin(MathEngine.degToRad(deg)));
    },

    cos: (deg) => {
        const norm = ((deg % 360) + 360) % 360;
        if (norm === 90 || norm === 270) return 0;
        if (norm === 60 || norm === 300) return 0.5;
        if (norm === 120 || norm === 240) return -0.5;
        if (norm === 0) return 1;
        if (norm === 180) return -1;
        return fixFloatingPoint(Math.cos(MathEngine.degToRad(deg)));
    },

    tan: (deg) => {
        const norm = ((deg % 180) + 180) % 180;
        // Tangani asimptot menegak pada 90 darjah (dan 270 darjah) -> Tak Tertakrif
        if (Math.abs(norm - 90) < 1e-12) {
            throw new Error('MATH_ERROR');
        }
        if (norm === 0) return 0;
        if (norm === 45) return 1;
        if (norm === 135) return -1;
        return fixFloatingPoint(Math.tan(MathEngine.degToRad(deg)));
    },

    asin: (val) => {
        if (val < -1 || val > 1) throw new Error('MATH_ERROR');
        return fixFloatingPoint(MathEngine.radToDeg(Math.asin(val)));
    },

    acos: (val) => {
        if (val < -1 || val > 1) throw new Error('MATH_ERROR');
        return fixFloatingPoint(MathEngine.radToDeg(Math.acos(val)));
    },

    atan: (val) => {
        return fixFloatingPoint(MathEngine.radToDeg(Math.atan(val)));
    },

    // Logaritma Asas 10 (log)
    log: (val) => {
        if (val <= 0) throw new Error('MATH_ERROR');
        return fixFloatingPoint(Math.log10(val));
    },

    // Logaritma Asli Asas e (ln)
    ln: (val) => {
        if (val <= 0) throw new Error('MATH_ERROR');
        return fixFloatingPoint(Math.log(val));
    },

    // Punca Kuasa Dua (sqrt)
    sqrt: (val) => {
        if (val < 0) throw new Error('MATH_ERROR');
        return fixFloatingPoint(Math.sqrt(val));
    },

    // Punca Kuasa Tiga (cbrt)
    cbrt: (val) => {
        return fixFloatingPoint(Math.cbrt(val));
    },

    // Faktorial (x!)
    fact: (n) => {
        if (n < 0 || !Number.isInteger(n) || n > 170) throw new Error('MATH_ERROR');
        let res = 1;
        for (let i = 2; i <= n; i++) res *= i;
        return res;
    }
};

/**
 * 3. PENGHURAI (TOKENIZER) & ALGORITMA SHUNTING-YARD (BODMAS / PEMDAS)
 * Menukarkan ekspresi infiks kepada Postfix (RPN) dan menilai mengikut keutamaan operasi.
 */
function evaluateMathematicalExpression(rawExpr) {
    if (!rawExpr || rawExpr.trim() === '') return 0;

    // A. Pra-pemprosesan rentetan & imbangan kurungan automatik
    let expr = rawExpr
        .replace(/Ans/g, `(${calcState.lastAnswer})`)
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/−/g, '-');

    // Kira kurungan buka dan tutup; tutup secara automatik jika pengguna terlupa menutup kurungan hujung
    let openCount = 0;
    for (const ch of expr) {
        if (ch === '(') openCount++;
        else if (ch === ')') openCount--;
        if (openCount < 0) throw new Error('SYNTAX_ERROR');
    }
    while (openCount > 0) {
        expr += ')';
        openCount--;
    }

    // Semak kurungan kosong '()'
    if (/\(\)/.test(expr)) throw new Error('SYNTAX_ERROR');

    // B. Tokenisasi (Lexical Analysis)
    const tokens = [];
    let i = 0;
    const funcNames = ['asin', 'acos', 'atan', 'sin', 'cos', 'tan', 'log', 'ln', 'sqrt', 'cbrt'];

    while (i < expr.length) {
        const ch = expr[i];

        if (/\s/.test(ch)) {
            i++;
            continue;
        }

        // Nombor atau Perpuluhan
        if (/[0-9.]/.test(ch)) {
            let numStr = '';
            let dotCount = 0;
            while (i < expr.length && /[0-9.]/.test(expr[i])) {
                if (expr[i] === '.') dotCount++;
                if (dotCount > 1) throw new Error('SYNTAX_ERROR');
                numStr += expr[i++];
            }
            if (numStr === '.') throw new Error('SYNTAX_ERROR');
            tokens.push({ type: 'NUMBER', value: parseFloat(numStr) });
            continue;
        }

        // Pemalar Matematik (π dan e)
        if (ch === 'π') {
            tokens.push({ type: 'NUMBER', value: Math.PI });
            i++;
            continue;
        }
        if (ch === 'e' && !/[a-zA-Z]/.test(expr[i + 1] || '')) {
            tokens.push({ type: 'NUMBER', value: Math.E });
            i++;
            continue;
        }

        // Fungsi Saintifik (sin, cos, tan, log, ln, sqrt, dll.)
        let matchedFunc = null;
        for (const fn of funcNames) {
            if (expr.startsWith(fn, i)) {
                matchedFunc = fn;
                break;
            }
        }
        if (matchedFunc) {
            tokens.push({ type: 'FUNC', value: matchedFunc });
            i += matchedFunc.length;
            continue;
        }

        // Kurungan
        if (ch === '(' || ch === ')') {
            tokens.push({ type: 'PAREN', value: ch });
            i++;
            continue;
        }

        // Operator Postfix (% dan !)
        if (ch === '%' || ch === '!') {
            tokens.push({ type: 'POSTFIX', value: ch });
            i++;
            continue;
        }

        // Operator Matematik (+, -, *, /, ^)
        if (['+', '-', '*', '/', '^'].includes(ch)) {
            tokens.push({ type: 'OP', value: ch });
            i++;
            continue;
        }

        // Aksara tidak dikenali
        throw new Error('SYNTAX_ERROR');
    }

    // C. Masukkan Pendaraban Implisit (Contoh: 2π -> 2*π, 3sin(30) -> 3*sin(30), (2)(3) -> (2)*(3))
    const processedTokens = [];
    for (let j = 0; j < tokens.length; j++) {
        const curr = tokens[j];
        const prev = processedTokens[processedTokens.length - 1];

        if (prev) {
            const prevIsValue = prev.type === 'NUMBER' || prev.type === 'POSTFIX' || (prev.type === 'PAREN' && prev.value === ')');
            const currIsValueStart = curr.type === 'NUMBER' || curr.type === 'FUNC' || (curr.type === 'PAREN' && curr.value === '(');
            if (prevIsValue && currIsValueStart) {
                processedTokens.push({ type: 'OP', value: '*' });
            }
        }

        // Kendalikan Operator Unary (+ atau - di awal ekspresi atau selepas '(' atau operator lain)
        if (curr.type === 'OP' && (curr.value === '+' || curr.value === '-')) {
            const isUnary = !prev || prev.type === 'OP' || prev.type === 'FUNC' || (prev.type === 'PAREN' && prev.value === '(');
            if (isUnary) {
                if (curr.value === '-') {
                    processedTokens.push({ type: 'UNARY', value: 'u-' });
                }
                // Unary '+' diabaikan kerana tidak mengubah tanda
                continue;
            }
        }

        processedTokens.push(curr);
    }

    // D. Algoritma Shunting-Yard (Menukar Infix kepada RPN / Postfix mengikut BODMAS)
    const outputQueue = [];
    const opStack = [];

    const precedence = {
        '+': 1,
        '-': 1,
        '*': 2,
        '/': 2,
        'u-': 3, // Unary negatif lebih tinggi daripada darab/bahagi tetapi lebih rendah daripada kuasa (-2^2 = -4)
        '^': 4,
        '%': 5,
        '!': 5
    };

    const rightAssociative = new Set(['^', 'u-']);

    for (const token of processedTokens) {
        if (token.type === 'NUMBER') {
            outputQueue.push(token);
        } else if (token.type === 'FUNC') {
            opStack.push(token);
        } else if (token.type === 'POSTFIX') {
            outputQueue.push(token);
        } else if (token.type === 'OP' || token.type === 'UNARY') {
            const o1 = token.value;
            while (opStack.length > 0) {
                const top = opStack[opStack.length - 1];
                if (top.type === 'FUNC') {
                    outputQueue.push(opStack.pop());
                    continue;
                }
                if (top.type === 'OP' || top.type === 'UNARY') {
                    const o2 = top.value;
                    const cond1 = !rightAssociative.has(o1) && precedence[o1] <= precedence[o2];
                    const cond2 = rightAssociative.has(o1) && precedence[o1] < precedence[o2];
                    if (cond1 || cond2) {
                        outputQueue.push(opStack.pop());
                        continue;
                    }
                }
                break;
            }
            opStack.push(token);
        } else if (token.type === 'PAREN' && token.value === '(') {
            opStack.push(token);
        } else if (token.type === 'PAREN' && token.value === ')') {
            let foundLeftParen = false;
            while (opStack.length > 0) {
                const top = opStack.pop();
                if (top.type === 'PAREN' && top.value === '(') {
                    foundLeftParen = true;
                    break;
                }
                outputQueue.push(top);
            }
            if (!foundLeftParen) throw new Error('SYNTAX_ERROR');
            if (opStack.length > 0 && opStack[opStack.length - 1].type === 'FUNC') {
                outputQueue.push(opStack.pop());
            }
        }
    }

    while (opStack.length > 0) {
        const top = opStack.pop();
        if (top.type === 'PAREN') throw new Error('SYNTAX_ERROR');
        outputQueue.push(top);
    }

    // E. Penilaian Postfix (RPN Evaluation) dengan Pembetulan IEEE 754 pada Setiap Langkah
    const evalStack = [];

    for (const token of outputQueue) {
        if (token.type === 'NUMBER') {
            evalStack.push(token.value);
        } else if (token.type === 'UNARY' && token.value === 'u-') {
            if (evalStack.length < 1) throw new Error('SYNTAX_ERROR');
            const a = evalStack.pop();
            evalStack.push(fixFloatingPoint(-a));
        } else if (token.type === 'POSTFIX') {
            if (evalStack.length < 1) throw new Error('SYNTAX_ERROR');
            const a = evalStack.pop();
            if (token.value === '%') {
                evalStack.push(fixFloatingPoint(a / 100));
            } else if (token.value === '!') {
                evalStack.push(MathEngine.fact(a));
            }
        } else if (token.type === 'FUNC') {
            if (evalStack.length < 1) throw new Error('SYNTAX_ERROR');
            const arg = evalStack.pop();
            const fn = token.value;
            if (!MathEngine[fn]) throw new Error('SYNTAX_ERROR');
            evalStack.push(MathEngine[fn](arg));
        } else if (token.type === 'OP') {
            if (evalStack.length < 2) throw new Error('SYNTAX_ERROR');
            const b = evalStack.pop();
            const a = evalStack.pop();
            let stepResult = 0;

            switch (token.value) {
                case '+':
                    stepResult = fixFloatingPoint(a + b);
                    break;
                case '-':
                    stepResult = fixFloatingPoint(a - b);
                    break;
                case '*':
                    stepResult = fixFloatingPoint(a * b);
                    break;
                case '/':
                    // Pengendalian Ralat Bahagi dengan Sifar
                    if (Math.abs(b) < 1e-15) throw new Error('MATH_ERROR');
                    stepResult = fixFloatingPoint(a / b);
                    break;
                case '^':
                    stepResult = fixFloatingPoint(Math.pow(a, b));
                    if (Number.isNaN(stepResult) || !Number.isFinite(stepResult)) {
                        throw new Error('MATH_ERROR');
                    }
                    break;
                default:
                    throw new Error('SYNTAX_ERROR');
            }
            evalStack.push(stepResult);
        }
    }

    if (evalStack.length !== 1) throw new Error('SYNTAX_ERROR');
    const finalValue = fixFloatingPoint(evalStack[0]);

    if (!Number.isFinite(finalValue) || Number.isNaN(finalValue)) {
        throw new Error('MATH_ERROR');
    }

    return finalValue;
}

/**
 * 4. FUNGSI KEMAS KINI PAPARAN & KAWALAN BUTANG
 */
function formatOutputNumber(num) {
    if (typeof num !== 'number') return String(num);
    // Gunakan tatatanda saintifik jika nombor terlalu besar atau terlalu kecil
    if (Math.abs(num) >= 1e12 || (Math.abs(num) > 0 && Math.abs(num) < 1e-9)) {
        return num.toExponential(8).replace(/\.?0+e/, 'e');
    }
    return String(fixFloatingPoint(num));
}

function updateDisplay() {
    expressionTextEl.textContent = calcState.expression;
    expressionTextEl.parentElement.scrollLeft = expressionTextEl.parentElement.scrollWidth;
}

function toggleShiftMode(forceState) {
    calcState.isShift = typeof forceState === 'boolean' ? forceState : !calcState.isShift;
    if (calcState.isShift) calcState.isAlpha = false;

    indShiftEl.classList.toggle('active', calcState.isShift);
    indAlphaEl.classList.toggle('active', calcState.isAlpha);
    shiftBtnEl.classList.toggle('active-ring', calcState.isShift);
    alphaBtnEl.classList.toggle('active-ring', calcState.isAlpha);

    // Tukar warna DEL & AC kepada Kuning apabila SHIFT aktif (untuk menonjolkan fungsi khas)
    document.getElementById('btnDel').classList.toggle('shift-yellow-mode', calcState.isShift);
    document.getElementById('btnAc').classList.toggle('shift-yellow-mode', calcState.isShift);
}

function toggleAlphaMode(forceState) {
    calcState.isAlpha = typeof forceState === 'boolean' ? forceState : !calcState.isAlpha;
    if (calcState.isAlpha) calcState.isShift = false;

    indAlphaEl.classList.toggle('active', calcState.isAlpha);
    indShiftEl.classList.toggle('active', calcState.isShift);
    alphaBtnEl.classList.toggle('active-ring', calcState.isAlpha);
    shiftBtnEl.classList.toggle('active-ring', calcState.isShift);
    document.getElementById('btnDel').classList.remove('shift-yellow-mode');
    document.getElementById('btnAc').classList.remove('shift-yellow-mode');
}

// Penukaran Perpuluhan kepada Pecahan Ringkas untuk butang S⇔D
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

function insertToken(tokenStr) {
    resultDisplayEl.classList.remove('error-text');

    if (calcState.justEvaluated) {
        // Jika pengguna menekan operator sejurus selepas '=', sambung kira dengan 'Ans'
        if (['+', '-', '×', '÷', '^', '%'].includes(tokenStr)) {
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

        resultDisplayEl.classList.remove('error-text');
        resultDisplayEl.textContent = formatted;

        // Simpan ke dalam sejarah & Ans
        addHistoryItem(calcState.expression, formatted);
        calcState.lastAnswer = formatted;
        calcState.showingFraction = false;
        calcState.justEvaluated = true;
    } catch (err) {
        resultDisplayEl.classList.add('error-text');
        if (err.message === 'MATH_ERROR') {
            resultDisplayEl.textContent = 'Math ERROR';
        } else {
            resultDisplayEl.textContent = 'Syntax ERROR';
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
            resultDisplayEl.classList.remove('error-text');
            resultDisplayEl.textContent = '0';
            toggleShiftMode(false);
            toggleAlphaMode(false);
            updateDisplay();
            break;

        case 'delete':
            if (calcState.justEvaluated) {
                calcState.justEvaluated = false;
                return;
            }
            const multiCharTokens = ['asin(', 'acos(', 'atan(', 'sqrt(', 'cbrt(', 'sin(', 'cos(', 'tan(', 'log(', 'ln(', 'Ans'];
            let removedMulti = false;
            for (const tok of multiCharTokens) {
                if (calcState.expression.endsWith(tok)) {
                    calcState.expression = calcState.expression.slice(0, -tok.length);
                    removedMulti = true;
                    break;
                }
            }
            if (!removedMulti) {
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

        // Butang ×10ˣ di baris paling bawah: SHIFT -> π, ALPHA -> e, Biasa -> ×10^(
        case 'exp10':
            if (calcState.isShift) {
                insertToken('π');
            } else if (calcState.isAlpha) {
                insertToken('e');
            } else {
                insertToken('×10^(');
            }
            break;

        // Butang Ans di baris paling bawah: SHIFT -> %, Biasa -> Ans
        case 'ans':
            if (calcState.isShift) {
                insertToken('%');
            } else {
                insertToken('Ans');
            }
            break;

        case 'negate':
            insertToken('-');
            break;

        // Butang S⇔D: Tukar paparan jawapan antara Perpuluhan dan Pecahan
        case 'sd':
            if (!resultDisplayEl.classList.contains('error-text')) {
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
            if (!resultDisplayEl.classList.contains('error-text')) {
                const cur = parseFloat(calcState.lastAnswer) || 0;
                calcState.memoryM = fixFloatingPoint(calcState.memoryM + (calcState.isShift ? -cur : cur));
                toggleShiftMode(false);
            }
            break;

        case 'sto':
            insertToken(String(calcState.memoryM || calcState.lastAnswer));
            break;

        case 'menu':
            // Pintasan tukar tema gelap/cerah apabila menekan MENU SETUP
            themeToggleBtn.click();
            break;

        // Navigasi Sejarah menggunakan D-Pad Perak
        case 'dpad-up':
            if (calcState.history.length > 0) {
                calcState.historyIndex = Math.min(calcState.history.length - 1, calcState.historyIndex + 1);
                const item = calcState.history[calcState.historyIndex];
                calcState.expression = item.expr;
                resultDisplayEl.textContent = item.res;
                updateDisplay();
            }
            break;
        case 'dpad-down':
            if (calcState.history.length > 0 && calcState.historyIndex > 0) {
                calcState.historyIndex--;
                const item = calcState.history[calcState.historyIndex];
                calcState.expression = item.expr;
                resultDisplayEl.textContent = item.res;
                updateDisplay();
            }
            break;
        case 'dpad-left':
        case 'dpad-right':
            calcState.justEvaluated = false;
            break;

        case 'calculate':
            executeCalculation();
            break;
    }
}

/**
 * 5. PENGURUSAN TEMA LIGHT MODE / DARK MODE & ACARA PAPAN KEKUNCI
 */
themeToggleBtn.addEventListener('click', () => {
    const body = document.body;
    const currentTheme = body.getAttribute('data-theme');
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    body.setAttribute('data-theme', nextTheme);

    if (nextTheme === 'dark') {
        themeIcon.textContent = '☀️';
        themeText.textContent = 'Light Mode';
    } else {
        themeIcon.textContent = '🌙';
        themeText.textContent = 'Dark Mode';
    }
});

// Pendengar Acara untuk Semua Butang Kalkulator (termasuk butang bulat perak & D-Pad)
document.querySelectorAll('.calc-btn, .btn-round-silver, .dpad-arrow').forEach((btn) => {
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

// Sokongan Papan Kekunci Fizikal (Keyboard Support)
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
