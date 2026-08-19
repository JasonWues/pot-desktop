import PromptListEditor, { GEMINI_PROMPT_SCHEMA } from '../../../components/ServiceConfigForm/PromptListEditor';
import { HelpLink, SwitchConfigField, TextConfigField } from '../../../components/ServiceConfigForm/ConfigField';
import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import ServiceConfigForm from '../../../components/ServiceConfigForm';
import { useTranslation } from 'react-i18next';
import React from 'react';

import { translate } from './index';
import { Language } from './index';

const defaultPromptList = [
    {
        role: 'user',
        parts: [
            {
                text: 'You are a professional translation engine, please translate the text into a colloquial, professional, elegant and fluent content, without the style of machine translation. You must only translate the text content, never interpret it.',
            },
        ],
    },
    {
        role: 'model',
        parts: [
            {
                text: 'Ok, I will only translate the text content, never interpret it.',
            },
        ],
    },
    {
        role: 'user',
        parts: [
            {
                text: `Translate into Chinese\n"""\nhello\n"""`,
            },
        ],
    },
    {
        role: 'model',
        parts: [
            {
                text: '你好',
            },
        ],
    },
    {
        role: 'user',
        parts: [
            {
                text: `Translate into $to\n"""\n$text\n"""`,
            },
        ],
    },
];

export function Config(props) {
    const { instanceKey, updateServiceList, onClose } = props;
    const { t } = useTranslation();

    return (
        <ServiceConfigForm
            instanceKey={instanceKey}
            defaultConfig={{
                [INSTANCE_NAME_CONFIG_KEY]: t('services.translate.geminipro.title'),
                stream: true,
                apiKey: '',
                requestPath: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro',
                promptList: defaultPromptList,
            }}
            onTest={(config) => translate('hello', Language.auto, Language.zh_cn, { config })}
            updateServiceList={updateServiceList}
            onClose={onClose}
        >
            {(config, setConfig) => (
                <>
                    <HelpLink url='https://pot-app.com/docs/api/translate/geminipro.html' />
                    <SwitchConfigField
                        label={t('services.translate.geminipro.stream')}
                        value={config['stream']}
                        onChange={(value) => setConfig({ ...config, stream: value })}
                    />
                    <TextConfigField
                        label={t('services.translate.geminipro.request_path')}
                        value={config['requestPath']}
                        onChange={(value) => setConfig({ ...config, requestPath: value })}
                    />
                    <TextConfigField
                        type='password'
                        label={t('services.translate.geminipro.api_key')}
                        value={config['apiKey']}
                        onChange={(value) => setConfig({ ...config, apiKey: value })}
                    />
                    <PromptListEditor
                        promptList={config.promptList}
                        schema={GEMINI_PROMPT_SCHEMA}
                        description={t('services.translate.geminipro.prompt_description')}
                        addLabel={t('services.translate.geminipro.add')}
                        onChange={(promptList) => setConfig({ ...config, promptList })}
                    />
                </>
            )}
        </ServiceConfigForm>
    );
}
