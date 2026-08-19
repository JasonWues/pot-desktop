import { HelpLink, SwitchConfigField, TextConfigField } from '../../../components/ServiceConfigForm/ConfigField';
import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import ServiceConfigForm from '../../../components/ServiceConfigForm';
import { useTranslation } from 'react-i18next';
import React from 'react';

import { translate } from './index';
import { Language } from './index';

export function Config(props) {
    const { instanceKey, updateServiceList, onClose } = props;
    const { t } = useTranslation();

    return (
        <ServiceConfigForm
            instanceKey={instanceKey}
            defaultConfig={{
                [INSTANCE_NAME_CONFIG_KEY]: t('services.translate.niutrans.title'),
                https: true,
                apikey: '',
            }}
            onTest={(config) => translate('hello', Language.auto, Language.zh_cn, { config })}
            updateServiceList={updateServiceList}
            onClose={onClose}
        >
            {(config, setConfig) => (
                <>
                    <HelpLink url='https://pot-app.com/docs/api/translate/niutrans.html' />
                    <SwitchConfigField
                        label={t('services.translate.niutrans.https')}
                        value={config['https'] ?? true}
                        onChange={(value) => setConfig({ ...config, https: value })}
                    />
                    <TextConfigField
                        label={t('services.translate.niutrans.apikey')}
                        value={config['apikey']}
                        onChange={(value) => setConfig({ ...config, apikey: value })}
                    />
                </>
            )}
        </ServiceConfigForm>
    );
}
