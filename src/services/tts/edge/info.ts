export const info = {
    name: 'edge_tts',
    icon: 'logo/edge.svg',
};

// BCP-47 tags, matched against the `Locale` field of the voice catalogue the
// service publishes. `matchVoice` falls back to the primary subtag, so a
// language whose exact region is not offered still finds a voice.
// No `auto`: a voice has to be chosen, and the callers guard with
// `detected in Language`, so omitting it yields "Language not supported"
// rather than a confusing "no voice available" from deeper in.
export enum Language {
    zh_cn = 'zh-CN',
    zh_tw = 'zh-TW',
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
    mn_cy = 'mn-MN',
    km = 'km-KH',
    nb_no = 'nb-NO',
    nn_no = 'nb-NO',
    fa = 'fa-IR',
    uk = 'uk-UA',
    he = 'he-IL',
    pl = 'pl-PL',
    nl = 'nl-NL',
    sv = 'sv-SE',
}
