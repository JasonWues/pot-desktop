import { HelpLink, TextConfigField } from '../../../components/ServiceConfigForm/ConfigField';
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
                [INSTANCE_NAME_CONFIG_KEY]: t('services.tts.lingva_tts.title'),
                requestPath: 'lingva.pot-app.com',
            }}
            onTest={(config) => tts('hello', Language.en, { config })}
            updateServiceList={updateServiceList}
            onClose={onClose}
        >
            {(config, setConfig) => (
                <>
                    <HelpLink url='https://pot-app.com/docs/api/tts/lingva.html' />
                    <TextConfigField
                        label={t('services.tts.lingva_tts.request_path')}
                        value={config['requestPath']}
                        onChange={(value) => setConfig({ ...config, requestPath: value })}
                    />
                </>
            )}
        </ServiceConfigForm>
    );
}
