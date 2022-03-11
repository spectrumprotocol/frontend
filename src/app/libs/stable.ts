export function getStablePrice(offerPool: number, askPool: number) {
    const leverage = 2000; // amp 1000 * coin 2
    const newAskPool = askPool - 1000000;
    const d = computeD(leverage, offerPool, askPool);
    const newOfferPool = computeNewBalance(leverage, newAskPool, d);
    const offerAmt = newOfferPool - offerPool;
    if (isFinite(offerAmt)) {
        return 1000000 / offerAmt;
    } else {
        return 0.98;    // fallback if calculation error
    }
}

function computeD(leverage: number, amountA: number, amountB: number) {
    const sumX = amountA + amountB;
    const amountA2 = amountA * 2 + 1;
    const amountB2 = amountB * 2 + 1;
    let dPrev: number;
    let d = sumX;
    for (let i = 0; i < 32; i++) {
        const dProd = d * d / amountA2 * d / amountB2;
        dPrev = d;
        d = calcStep(d, leverage, sumX, dProd);
        if (Math.abs(d - dPrev) < 1) {
            break;
        }
    }
    return d;
}

function calcStep(d: number, leverage: number, sumX: number, dProd: number) {
    const leverageMult = leverage * sumX / 100;
    const dP = dProd * 2;
    const l = (leverageMult + dP) * d;

    const leverageSub = d * (leverage - 100) / 100;
    const dP2 = dProd * 3;
    const r = leverageSub + dP2;

    return l / r;
}

function computeNewBalance(leverage: number, newSourceAmount: number, d: number) {
    const c = d ** 3 * 100 / (newSourceAmount * 4 * leverage);
    const b = newSourceAmount + (d * 100 / leverage);
    let yPrev: number;
    let y = d;
    for (let i = 0; i < 32; i++) {
        yPrev = y;
        y = (y ** 2 + c) / (y * 2 + b - d);
        if (Math.abs(y - yPrev) < 1) {
            break;
        }
    }
    return y;
}
