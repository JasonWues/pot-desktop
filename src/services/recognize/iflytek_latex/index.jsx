import { hmacSha256, sha256, toBase64 } from '../../../utils/crypto';
import { fetch } from '../../../utils/http';

export async function recognize(base64, language, options = {}) {
    const { config } = options;

    const { appid, apisecret, apikey } = config;

    const url = 'https://rest-api.xfyun.cn/v2/itr';

    const body = {
        common: {
            app_id: appid,
        },
        business: {
            ent: 'teach-photo-print',
            aue: 'raw',
        },
        data: {
            image: base64,
        },
    };
    const host = 'rest-api.xfyun.cn';
    const date = new Date().toUTCString();
    const request_line = 'POST /v2/itr HTTP/1.1';
    const digest = 'SHA-256=' + toBase64(sha256(JSON.stringify(body)));
    const signature_origin = `host: ${host}\ndate: ${date}\n${request_line}\ndigest: ${digest}`;
    // Key first, message second -- the reverse of crypto-js's HmacSHA256.
    const signature = toBase64(hmacSha256(apisecret, signature_origin));
    const authorization = `api_key="${apikey}", algorithm="hmac-sha256", headers="host date request-line digest", signature="${signature}"`;
    const headers = {
        'Content-Type': 'application/json',
        Accept: 'application/json,version=1.0',
        Host: host,
        Date: date,
        Digest: digest,
        Authorization: authorization,
    };
    const res = await fetch(url, {
        method: 'POST',
        headers,
        body: {
            type: 'Text',
            payload: JSON.stringify(body),
        },
    });
    if (res.ok) {
        let result = res.data;
        if (result.data['region']) {
            let target = '';
            for (let i of result.data['region']) {
                target += i['recog']['content'] + '\n';
            }
            target = target.replaceAll(' ifly-latex-begin ', '');
            target = target.replaceAll(' ifly-latex-end ', '');
            return target.trim();
        } else {
            throw JSON.stringify(result);
        }
    } else {
        throw `Http Request Error\nHttp Status: ${res.status}\n${JSON.stringify(res.data)}`;
    }
}

export * from './Config';
export * from './info';
