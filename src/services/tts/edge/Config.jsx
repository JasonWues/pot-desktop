import { ConfigItem, SelectConfigField } from '../../../components/ServiceConfigForm/ConfigField';
import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import ServiceConfigForm from '../../../components/ServiceConfigForm';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getVoiceList, matchVoice } from './index';
import { Language } from './index';
import { tts } from './index';

// SSML takes these as signed offsets from the voice's own baseline, not as
// multipliers, so 0 is "unchanged" rather than "silent"/"stopped".
const RATE_OPTIONS = [-50, -25, -10, 0, 10, 25, 50, 100];
const PITCH_OPTIONS = [-50, -25, -10, 0, 10, 25, 50];
const VOLUME_OPTIONS = [-50, -25, 0, 25, 50];

const signed = (value, unit) => `${value > 0 ? '+' : ''}${value}${unit}`;

// A component rather than the render prop's body: the voice catalogue is
// fetched, and which language the voice dropdown is editing is state of its
// own, so there are hooks here that cannot live inside a render callback.
function EdgeFields({ config, setConfig }) {
    const { t } = useTranslation();
    const [voiceList, setVoiceList] = useState([]);
    const [voiceListError, setVoiceListError] = useState('');
    const [editingLanguage, setEditingLanguage] = useState('en');

    useEffect(() => {
        getVoiceList().then(setVoiceList, (e) => setVoiceListError(e.toString()));
    }, []);

    const languageTag = Language[editingLanguage];
    const configuredVoice = config?.voice?.[languageTag] ?? '';
    const autoVoice = matchVoice(voiceList, languageTag);
    // The catalogue carries ~500 voices across every locale; showing all of them
    // for one language would be unusable.
    const voicesForLanguage = voiceList.filter(
        (v) => (v.Locale ?? '').toLowerCase().split('-')[0] === (languageTag ?? '').toLowerCase().split('-')[0]
    );

    const offsetField = (label, key, options, unit) => (
        <SelectConfigField
            label={label}
            value={config[key] ?? 0}
            options={options.map((v) => ({ id: v, label: signed(v, unit) }))}
            ariaLabel={key}
            triggerLabel={signed(config[key] ?? 0, unit)}
            onChange={(v) => setConfig({ ...config, [key]: Number(v) })}
            scrollable
        />
    );

    return (
        <>
            {offsetField(t('services.tts.edge_tts.rate'), 'rate', RATE_OPTIONS, '%')}
            {offsetField(t('services.tts.edge_tts.pitch'), 'pitch', PITCH_OPTIONS, 'Hz')}
            {offsetField(t('services.tts.edge_tts.volume'), 'volume', VOLUME_OPTIONS, '%')}

            <SelectConfigField
                label={t('services.tts.edge_tts.language')}
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
                label={t('services.tts.edge_tts.voice')}
                value={configuredVoice === '' ? '__auto__' : configuredVoice}
                options={[
                    { id: '__auto__', label: t('services.tts.edge_tts.auto_voice') },
                    ...voicesForLanguage.map((v) => ({ id: v.ShortName, label: `${v.ShortName} (${v.Gender})` })),
                ]}
                ariaLabel='tts voice'
                triggerLabel={
                    configuredVoice === ''
                        ? `${t('services.tts.edge_tts.auto_voice')}${autoVoice === null ? '' : ` (${autoVoice.ShortName})`}`
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
                [INSTANCE_NAME_CONFIG_KEY]: t('services.tts.edge_tts.title'),
                rate: 0,
                pitch: 0,
                volume: 0,
                // Keyed by the BCP-47 tag from `Language`. An absent or empty entry
                // means "let `matchVoice` pick one".
                voice: {},
            }}
            onTest={(config) => tts('hello', Language.en, { config })}
            updateServiceList={updateServiceList}
            onClose={onClose}
        >
            {(config, setConfig) => (
                <EdgeFields
                    config={config}
                    setConfig={setConfig}
                />
            )}
        </ServiceConfigForm>
    );
}
