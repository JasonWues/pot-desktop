export const info = {
    name: 'openai_tts',
    icon: 'logo/openai.svg',
};

// The speech endpoint infers the language from the input text, so there is no
// language parameter to map to. Every language pot knows is listed to keep
// `lang in Language` — the support check every caller runs — true.
export enum Language {
    zh_cn = 'zh_cn',
    zh_tw = 'zh_tw',
    mn_mo = 'mn_mo',
    en = 'en',
    ja = 'ja',
    ko = 'ko',
    fr = 'fr',
    es = 'es',
    ru = 'ru',
    de = 'de',
    it = 'it',
    tr = 'tr',
    pt_pt = 'pt_pt',
    pt_br = 'pt_br',
    vi = 'vi',
    id = 'id',
    th = 'th',
    ms = 'ms',
    ar = 'ar',
    hi = 'hi',
    km = 'km',
    mn_cy = 'mn_cy',
    nb_no = 'nb_no',
    nn_no = 'nn_no',
    fa = 'fa',
    sv = 'sv',
    pl = 'pl',
    nl = 'nl',
    uk = 'uk',
    he = 'he',
}
