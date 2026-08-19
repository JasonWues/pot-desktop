import { HelpLink, TextConfigField } from '../../../components/ServiceConfigForm/ConfigField';
import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import ServiceConfigForm from '../../../components/ServiceConfigForm';
import { useTranslation } from 'react-i18next';
import React from 'react';

import { collection } from './index';

export function Config(props) {
    const { instanceKey, updateServiceList, onClose } = props;
    const { t } = useTranslation();

    return (
        <ServiceConfigForm
            instanceKey={instanceKey}
            defaultConfig={{
                [INSTANCE_NAME_CONFIG_KEY]: t('services.collection.anki.title'),
                port: 8765,
            }}
            onTest={(config) => collection('test', '测试', { config })}
            updateServiceList={updateServiceList}
            onClose={onClose}
        >
            {(config, setConfig) => (
                <>
                    <HelpLink url='https://pot-app.com/docs/api/collection/anki.html' />
                    <TextConfigField
                        type='number'
                        label={t('services.collection.anki.port')}
                        value={config['port']}
                        onChange={(value) => setConfig({ ...config, port: value })}
                    />
                </>
            )}
        </ServiceConfigForm>
    );
}
