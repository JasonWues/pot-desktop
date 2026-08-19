import { HelpLink, TextConfigField } from '../../../components/ServiceConfigForm/ConfigField';
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
                [INSTANCE_NAME_CONFIG_KEY]: t('services.translate.tencent.title'),
                secret_id: '',
                secret_key: '',
            }}
            onTest={(config) => translate('hello', Language.auto, Language.zh_cn, { config })}
            updateServiceList={updateServiceList}
            onClose={onClose}
        >
            {(config, setConfig) => (
                <>
                    <HelpLink url='https://pot-app.com/docs/api/translate/tencent.html' />
                    <TextConfigField
                        label={t('services.translate.tencent.secret_id')}
                        value={config['secret_id']}
                        onChange={(value) => setConfig({ ...config, secret_id: value })}
                    />
                    <TextConfigField
                        label={t('services.translate.tencent.secret_key')}
                        value={config['secret_key']}
                        onChange={(value) => setConfig({ ...config, secret_key: value })}
                    />
                </>
            )}
        </ServiceConfigForm>
    );
}
