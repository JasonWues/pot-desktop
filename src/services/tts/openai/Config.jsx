import { HelpLink, SelectConfigField, TextConfigField } from '../../../components/ServiceConfigForm/ConfigField';
import { DEFAULT_MODEL, DEFAULT_REQUEST_PATH, SPEED_OPTIONS, VOICE_OPTIONS } from './index';
import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import ServiceConfigForm from '../../../components/ServiceConfigForm';
import { useTranslation } from 'react-i18next';
import React from 'react';

import { Language } from './index';
import { tts } from './index';

export function Config(props) {
    const { instanceKey, updateServiceList, onClose } = props;
    const { t } = useTranslation();

    return (
        <ServiceConfigForm
            instanceKey={instanceKey}
            defaultConfig={{
                [INSTANCE_NAME_CONFIG_KEY]: t('services.tts.openai_tts.title'),
                requestPath: DEFAULT_REQUEST_PATH,
                apiKey: '',
                model: DEFAULT_MODEL,
                voice: 'alloy',
                speed: 1,
            }}
            onTest={(config) => tts('hello', Language.en, { config })}
            updateServiceList={updateServiceList}
            onClose={onClose}
        >
            {(config, setConfig) => (
                <>
                    <HelpLink url='https://platform.openai.com/docs/guides/text-to-speech' />
                    <TextConfigField
                        label={t('services.tts.openai_tts.request_path')}
                        value={config['requestPath']}
                        onChange={(value) => setConfig({ ...config, requestPath: value })}
                    />
                    <TextConfigField
                        type='password'
                        label={t('services.tts.openai_tts.api_key')}
                        value={config['apiKey']}
                        onChange={(value) => setConfig({ ...config, apiKey: value })}
                    />
                    <TextConfigField
                        label={t('services.tts.openai_tts.model')}
                        value={config['model']}
                        onChange={(value) => setConfig({ ...config, model: value })}
                    />
                    <SelectConfigField
                        label={t('services.tts.openai_tts.voice')}
                        value={config['voice']}
                        options={VOICE_OPTIONS.map((voice) => ({ id: voice, label: voice }))}
                        ariaLabel='openai tts voice'
                        onChange={(key) => setConfig({ ...config, voice: key })}
                    />
                    <SelectConfigField
                        label={t('services.tts.openai_tts.speed')}
                        value={config['speed'] ?? 1}
                        options={SPEED_OPTIONS.map((speed) => ({ id: speed, label: `${speed}x` }))}
                        ariaLabel='openai tts speed'
                        onChange={(key) => setConfig({ ...config, speed: Number(key) })}
                    />
                </>
            )}
        </ServiceConfigForm>
    );
}
