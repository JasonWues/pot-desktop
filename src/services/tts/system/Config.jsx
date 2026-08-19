import { ConfigItem, SelectConfigField } from '../../../components/ServiceConfigForm/ConfigField';
import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import ServiceConfigForm from '../../../components/ServiceConfigForm';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getVoiceList, matchVoice } from './index';
import { Language } from './index';
import { tts } from './index';

const RATE_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

// A component rather than the render prop's body: the installed voices are
// queried from the OS, and which language the voice dropdown is editing is
// state of its own, so there are hooks here that cannot live inside a render
// callback.
function SystemTtsFields({ config, setConfig }) {
    const { t } = useTranslation();
    const [voiceList, setVoiceList] = useState([]);
    const [voiceListError, setVoiceListError] = useState('');
    // Which language the voice dropdown below is editing. Configuring all 30
    // languages at once would be a wall of dropdowns, and almost nobody needs
    // more than one or two.
    const [editingLanguage, setEditingLanguage] = useState('en');

    useEffect(() => {
        getVoiceList().then(setVoiceList, (e) => setVoiceListError(e.toString()));
    }, []);

    const languageTag = Language[editingLanguage];
    const configuredVoice = config?.voice?.[languageTag] ?? '';
    const autoVoice = matchVoice(voiceList, languageTag);

    return (
        <>
            <SelectConfigField
                label={t('services.tts.system_tts.rate')}
                value={config.rate ?? 1}
                options={RATE_OPTIONS.map((rate) => ({ id: rate, label: `${rate}x` }))}
                ariaLabel='tts rate'
                triggerLabel={`${config.rate ?? 1}x`}
                onChange={(key) => setConfig({ ...config, rate: Number(key) })}
            />

            <SelectConfigField
                label={t('services.tts.system_tts.language')}
                value={editingLanguage}
                options={Object.keys(Language).map((language) => ({
                    id: language,
                    label: t(`languages.${language}`),
                }))}
                ariaLabel='tts language'
                onChange={(key) => setEditingLanguage(key)}
                scrollable
            />

            <SelectConfigField
                label={t('services.tts.system_tts.voice')}
                value={configuredVoice === '' ? '__auto__' : configuredVoice}
                options={[
                    { id: '__auto__', label: t('services.tts.system_tts.auto_voice') },
                    ...voiceList.map((v) => ({ id: v.name, label: `${v.name} (${v.language})` })),
                ]}
                ariaLabel='tts voice'
                triggerLabel={
                    configuredVoice === ''
                        ? `${t('services.tts.system_tts.auto_voice')}${autoVoice === null ? '' : ` (${autoVoice.name})`}`
                        : configuredVoice
                }
                onChange={(key) =>
                    setConfig({
                        ...config,
                        voice: { ...config.voice, [languageTag]: key === '__auto__' ? '' : key },
                    })
                }
                scrollable
            />

            {voiceListError !== '' && (
                <ConfigItem>
                    <p className='text-danger text-sm'>{voiceListError}</p>
                </ConfigItem>
            )}
        </>
    );
}

export function Config(props) {
    const { instanceKey, updateServiceList, onClose } = props;
    const { t } = useTranslation();

    return (
        <ServiceConfigForm
            instanceKey={instanceKey}
            defaultConfig={{
                [INSTANCE_NAME_CONFIG_KEY]: t('services.tts.system_tts.title'),
                rate: 1,
                // Keyed by the BCP-47 tag from `Language`, so zh_cn and zh_tw can
                // hold different voices. An absent or empty entry means "let
                // `matchVoice` pick one".
                voice: {},
            }}
            onTest={(config) => tts('hello', Language.en, { config })}
            updateServiceList={updateServiceList}
            onClose={onClose}
        >
            {(config, setConfig) => (
                <SystemTtsFields
                    config={config}
                    setConfig={setConfig}
                />
            )}
        </ServiceConfigForm>
    );
}
