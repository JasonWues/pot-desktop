export const info = {
    name: 'system_tts',
    // Rendered as the current OS logo, the same way the system OCR service is.
    icon: 'system',
};

// BCP-47 tags. The OS reports its voices' locales in its own dialect
// ('en-US' on Windows, 'en_US' on macOS, bare 'en' or 'cmn' on espeak), so
// `matchVoice` normalises before comparing and falls back to the primary
// subtag; anything it still cannot match is covered by picking a voice by hand.
export enum Language {
    zh_cn = 'zh-CN',
    zh_tw = 'zh-TW',
    mn_mo = 'mn-Mong',
    en = 'en-US',
    ja = 'ja-JP',
    ko = 'ko-KR',
    fr = 'fr-FR',
    es = 'es-ES',
    ru = 'ru-RU',
    de = 'de-DE',
    it = 'it-IT',
    tr = 'tr-TR',
    pt_pt = 'pt-PT',
    pt_br = 'pt-BR',
    vi = 'vi-VN',
    id = 'id-ID',
    th = 'th-TH',
    ms = 'ms-MY',
    ar = 'ar-SA',
    hi = 'hi-IN',
    km = 'km-KH',
    mn_cy = 'mn-MN',
    nb_no = 'nb-NO',
    nn_no = 'nn-NO',
    fa = 'fa-IR',
    sv = 'sv-SE',
    pl = 'pl-PL',
    nl = 'nl-NL',
    uk = 'uk-UA',
    he = 'he-IL',
}
