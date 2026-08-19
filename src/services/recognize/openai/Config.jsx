import { HelpLink, TextAreaConfigField, TextConfigField } from '../../../components/ServiceConfigForm/ConfigField';
import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import ServiceConfigForm from '../../../components/ServiceConfigForm';
import { useTranslation } from 'react-i18next';
import React from 'react';

import { TEST_IMAGE } from '../test_image';
import { recognize } from './index';
import { Language } from './index';

export const defaultRequestArguments = JSON.stringify({
    temperature: 0,
});

export const defaultSystemPrompt =
    'You are a professional OCR engine. Extract the text from the image exactly as it appears, keeping the original line breaks. Output only the extracted text, never explain it, never wrap it in code blocks.';

export const defaultUserPrompt = 'Recognize the text in $language from this image.';

export function Config(props) {
    const { instanceKey, updateServiceList, onClose } = props;
    const { t } = useTranslation();

    return (
        <ServiceConfigForm
            instanceKey={instanceKey}
            defaultConfig={{
                [INSTANCE_NAME_CONFIG_KEY]: t('services.recognize.openai_ocr.title'),
                requestPath: 'https://api.openai.com/v1/chat/completions',
                model: 'gpt-4o-mini',
                apiKey: '',
                systemPrompt: defaultSystemPrompt,
                userPrompt: defaultUserPrompt,
                requestArguments: defaultRequestArguments,
            }}
            onTest={(config) => recognize(TEST_IMAGE, Language.auto, { config })}
            updateServiceList={updateServiceList}
            onClose={onClose}
        >
            {(config, setConfig) => (
                <>
                    {/* The translate service's page: the two share their credentials. */}
                    <HelpLink url='https://pot-app.com/docs/api/translate/openai.html' />
                    <TextConfigField
                        label={t('services.recognize.openai_ocr.request_path')}
                        value={config['requestPath']}
                        onChange={(value) => setConfig({ ...config, requestPath: value })}
                    />
                    <TextConfigField
                        type='password'
                        label={t('services.recognize.openai_ocr.api_key')}
                        value={config['apiKey']}
                        onChange={(value) => setConfig({ ...config, apiKey: value })}
                    />
                    <TextConfigField
                        label={t('services.recognize.openai_ocr.model')}
                        value={config['model']}
                        onChange={(value) => setConfig({ ...config, model: value })}
                    />
                    <h3 className='my-auto'>Prompt</h3>
                    <p className='text-[10px] text-foreground'>
                        {t('services.recognize.openai_ocr.prompt_description')}
                    </p>
                    <TextAreaConfigField
                        label='system'
                        placeholder='Input Some System Prompt'
                        value={config['systemPrompt']}
                        onChange={(value) => setConfig({ ...config, systemPrompt: value })}
                    />
                    <TextAreaConfigField
                        label='user'
                        placeholder='Input Some User Prompt'
                        value={config['userPrompt']}
                        onChange={(value) => setConfig({ ...config, userPrompt: value })}
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
            )}
        </ServiceConfigForm>
    );
}
