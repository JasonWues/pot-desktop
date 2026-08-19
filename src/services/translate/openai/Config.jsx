import PromptListEditor, { CHAT_PROMPT_SCHEMA } from '../../../components/ServiceConfigForm/PromptListEditor';
import { Card, CardContent, Link } from '@heroui/react';
import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import ServiceConfigForm from '../../../components/ServiceConfigForm';
import { useTranslation } from 'react-i18next';
import React from 'react';

import {
    HelpLink,
    SelectConfigField,
    SwitchConfigField,
    TextAreaConfigField,
    TextConfigField,
} from '../../../components/ServiceConfigForm/ConfigField';
import { translate } from './index';
import { Language } from './index';

export const defaultRequestArguments = JSON.stringify({
    temperature: 0.1,
    top_p: 0.99,
    frequency_penalty: 0,
    presence_penalty: 0,
});

const defaultPromptList = [
    {
        role: 'system',
        content:
            'You are a professional translation engine, please translate the text into a colloquial, professional, elegant and fluent content, without the style of machine translation. You must only translate the text content, never interpret it.',
    },
    { role: 'user', content: `Translate into $to:\n"""\n$text\n"""` },
];

export function Config(props) {
    const { instanceKey, updateServiceList, onClose } = props;
    const { t } = useTranslation();

    return (
        <ServiceConfigForm
            instanceKey={instanceKey}
            defaultConfig={{
                [INSTANCE_NAME_CONFIG_KEY]: t('services.translate.openai.title'),
                service: 'openai',
                requestPath: 'https://api.openai.com/v1/chat/completions',
                model: 'gpt-3.5-turbo',
                apiKey: '',
                stream: false,
                promptList: defaultPromptList,
                requestArguments: defaultRequestArguments,
            }}
            onTest={(config) => translate('hello', Language.auto, Language.zh_cn, { config })}
            updateServiceList={updateServiceList}
            onClose={onClose}
        >
            {(config, setConfig) => {
                // 兼容旧版本 -- an instance saved before `promptList` and
                // `requestArguments` existed -- needs no patching here any more:
                // ServiceConfigForm lays these defaults under whatever the store
                // holds.
                return (
                    <>
                        <HelpLink url='https://pot-app.com/docs/api/translate/openai.html' />
                        <SelectConfigField
                            label={t('services.translate.openai.service')}
                            value={config.service}
                            options={['openai', 'azure'].map((service) => ({
                                id: service,
                                label: t(`services.translate.openai.${service}`),
                            }))}
                            ariaLabel='service'
                            onChange={(key) => setConfig({ ...config, service: key })}
                        />
                        <SwitchConfigField
                            label={t('services.translate.openai.stream')}
                            value={config['stream']}
                            onChange={(value) => setConfig({ ...config, stream: value })}
                        />
                        <TextConfigField
                            label={t('services.translate.openai.request_path')}
                            value={config['requestPath']}
                            onChange={(value) => setConfig({ ...config, requestPath: value })}
                        />
                        <TextConfigField
                            type='password'
                            label={t('services.translate.openai.api_key')}
                            value={config['apiKey']}
                            onChange={(value) => setConfig({ ...config, apiKey: value })}
                        />
                        <Card
                            isBlurred
                            className='border-none bg-success/20 dark:bg-success/10'
                            shadow='sm'
                        >
                            <CardContent>
                                <div>
                                    推荐
                                    <Link
                                        isExternal
                                        href='https://aihubmix.com/register?aff=trJY'
                                        color='primary'
                                    >
                                        AiHubMix
                                    </Link>
                                    的OpenAI API 密钥，速度飞快，经济实惠，1美元的OpenAI API 额度只需人民币6.3元
                                    <Link
                                        isExternal
                                        href='https://pot-app.com/ads/aihubmix.html'
                                        color='primary'
                                    >
                                        配置文档
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>
                        {/* Azure names the deployment in the request path, so it has no model field of its own. */}
                        <TextConfigField
                            hidden={config.service === 'azure'}
                            label={t('services.translate.openai.model')}
                            value={config['model']}
                            onChange={(value) => setConfig({ ...config, model: value })}
                        />
                        <PromptListEditor
                            promptList={config.promptList}
                            schema={CHAT_PROMPT_SCHEMA}
                            description={t('services.translate.openai.prompt_description')}
                            addLabel={t('services.translate.openai.add')}
                            onChange={(promptList) => setConfig({ ...config, promptList })}
                        />
                        <h3 className='my-auto'>Request Arguments</h3>
                        <TextAreaConfigField
                            ariaLabel='Request Arguments'
                            placeholder='Input API Request Arguments'
                            value={config['requestArguments']}
                            onChange={(value) => setConfig({ ...config, requestArguments: value })}
                        />
                        <br />
                    </>
                );
            }}
        </ServiceConfigForm>
    );
}
