import PromptListEditor, { ALTERNATING_PROMPT_SCHEMA } from '../../../components/ServiceConfigForm/PromptListEditor';
import { HelpLink, SelectConfigField, TextConfigField } from '../../../components/ServiceConfigForm/ConfigField';
import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import ServiceConfigForm from '../../../components/ServiceConfigForm';
import { useTranslation } from 'react-i18next';
import React from 'react';

import { translate } from './index';
import { Language } from './index';

// https://docs.bigmodel.cn/cn/guide/start/model-overview#%E6%96%87%E6%9C%AC%E6%A8%A1%E5%9E%8B
const availableModels = [
    'glm-4.5',
    'glm-4.5-x',
    'glm-4.5-air',
    'glm-4.5-airx',
    'glm-4-plus',
    'glm-4-air-250414',
    'glm-4-long',
    'glm-4-airx',
    'glm-4-flashx-250414',
    'glm-z1-air',
    'glm-z1-airx',
    'glm-z1-flashx',
    'glm-4.5-flash',
    'glm-4-flash-250414',
    'glm-z1-flash',
];

export function Config(props) {
    const { instanceKey, updateServiceList, onClose } = props;
    const { t } = useTranslation();

    return (
        <ServiceConfigForm
            instanceKey={instanceKey}
            defaultConfig={{
                [INSTANCE_NAME_CONFIG_KEY]: t('services.translate.chatglm.title'),
                model: 'chatglm_turbo',
                apiKey: '',
                promptList: [
                    {
                        role: 'user',
                        content:
                            'You are a professional translation engine, please translate the text into a colloquial, professional, elegant and fluent content, without the style of machine translation. You must only translate the text content, never interpret it.',
                    },
                    { role: 'assistant', content: 'Ok, I will only translate the text content, never interpret it.' },
                    { role: 'user', content: `Translate into Chinese\n"""\nhello\n"""` },
                    { role: 'assistant', content: '你好' },
                    { role: 'user', content: `Translate into $to\n"""\n$text\n"""` },
                ],
            }}
            onTest={(config) => translate('hello', Language.auto, Language.zh_cn, { config })}
            updateServiceList={updateServiceList}
            onClose={onClose}
        >
            {(config, setConfig) => (
                <>
                    <HelpLink url='https://pot-app.com/docs/api/translate/chatglm.html' />
                    <SelectConfigField
                        label={t('services.translate.chatglm.model')}
                        value={config.model}
                        options={availableModels.map((model) => ({ id: model, label: model }))}
                        ariaLabel='model'
                        onChange={(key) => setConfig({ ...config, model: key })}
                    />
                    <TextConfigField
                        type='password'
                        label={t('services.translate.chatglm.api_key')}
                        value={config['apiKey']}
                        onChange={(value) => setConfig({ ...config, apiKey: value })}
                    />
                    <PromptListEditor
                        promptList={config.promptList}
                        schema={ALTERNATING_PROMPT_SCHEMA}
                        description={t('services.translate.chatglm.prompt_description')}
                        addLabel={t('services.translate.chatglm.add')}
                        onChange={(promptList) => setConfig({ ...config, promptList })}
                    />
                </>
            )}
        </ServiceConfigForm>
    );
}
