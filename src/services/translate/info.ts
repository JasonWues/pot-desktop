// Metadata only: `info` (name + icon) and the `Language` table, straight from
// each service's `info.ts`.
//
// The sibling `index.jsx` barrel re-exports each service's implementation *and*
// its `Config.jsx`, so importing it to read a name or a language table pulls in
// all 21 implementations and, through the forms, React and HeroUI -- about
// 321 KB that the Translate window has no use for until it actually calls one.
// Anything that only needs to know a service exists imports this instead.

import * as _alibaba from './alibaba/info';
import * as _baidu from './baidu/info';
import * as _baidu_field from './baidu_field/info';
import * as _bing from './bing/info';
import * as _bing_dict from './bing_dict/info';
import * as _caiyun from './caiyun/info';
import * as _cambridge_dict from './cambridge_dict/info';
import * as _chatglm from './chatglm/info';
import * as _deepl from './deepl/info';
import * as _ecdict from './ecdict/info';
import * as _geminipro from './geminipro/info';
import * as _google from './google/info';
import * as _lingva from './lingva/info';
import * as _niutrans from './niutrans/info';
import * as _ollama from './ollama/info';
import * as _openai from './openai/info';
import * as _tencent from './tencent/info';
import * as _transmart from './transmart/info';
import * as _volcengine from './volcengine/info';
import * as _yandex from './yandex/info';
import * as _youdao from './youdao/info';

export const alibaba = _alibaba;
export const baidu = _baidu;
export const baidu_field = _baidu_field;
export const bing = _bing;
export const bing_dict = _bing_dict;
export const caiyun = _caiyun;
export const cambridge_dict = _cambridge_dict;
export const chatglm = _chatglm;
export const deepl = _deepl;
export const ecdict = _ecdict;
export const geminipro = _geminipro;
export const google = _google;
export const lingva = _lingva;
export const niutrans = _niutrans;
export const ollama = _ollama;
export const openai = _openai;
export const tencent = _tencent;
export const transmart = _transmart;
export const volcengine = _volcengine;
export const yandex = _yandex;
export const youdao = _youdao;
