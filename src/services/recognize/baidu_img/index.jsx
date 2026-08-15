import { readFile, BaseDirectory } from '@tauri-apps/plugin-fs';
import { fetch, Body } from '../../../utils/http';
import { nanoid } from 'nanoid';
// `lib-typedarrays` is what teaches `WordArray.create` to take the image bytes.
import CryptoJS from 'crypto-js/core';
import 'crypto-js/lib-typedarrays';
import md5 from 'crypto-js/md5';

export async function recognize(base64, language, options = {}) {
    const { config } = options;

    const { appid, secret } = config;

    const url = 'https://fanyi-api.baidu.com/api/trans/sdk/picture';

    const salt = nanoid();
    if (appid === '' || secret === '') {
        throw 'Please configure appid and secret';
    }

    let file = await readFile('pot_screenshot_cut.png', { baseDir: BaseDirectory.AppCache });
    const str = appid + md5(CryptoJS.lib.WordArray.create(file)).toString() + salt + 'APICUIDmac' + secret;
    const sign = md5(str).toString();

    let res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'multipart/form-data',
        },
        body: Body.form({
            image: {
                file: file,
                mime: 'image/png',
                fileName: 'pot_screenshot_cut.png',
            },
            from: 'auto',
            to: language === 'auto' ? 'zh' : language,
            appid: appid,
            salt: salt,
            cuid: 'APICUID',
            mac: 'mac',
            version: '3',
            sign: sign,
        }),
    });

    if (res.ok) {
        let result = res.data;
        if (result['data'] && result['data']['sumSrc'] && result['data']['sumDst']) {
            if (language === 'auto') {
                return result['data']['sumSrc'].trim();
            } else {
                return result['data']['sumDst'].trim();
            }
        } else {
            throw JSON.stringify(result);
        }
    } else {
        throw `Http Request Error\nHttp Status: ${res.status}\n${JSON.stringify(res.data)}`;
    }
}

export * from './Config';
export * from './info';
