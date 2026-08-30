// @ts-check
/**
 * @template {(...args: any[]) => void} F
 * @param {F} fn
 * @param {number} [delay]
 * @returns {(...args: Parameters<F>) => void}
 */
export const debounce = (fn, delay = 500) => {
    /** @type {ReturnType<typeof setTimeout> | null} */
    let timer = null;
    return (...args) => {
        timer && clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
};
