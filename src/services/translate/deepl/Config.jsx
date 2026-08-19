import { HelpLink, SelectConfigField, TextConfigField } from '../../../components/ServiceConfigForm/ConfigField';
import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import ServiceConfigForm from '../../../components/ServiceConfigForm';
import { useTranslation } from 'react-i18next';
import React from 'react';

import { translate } from './index';
import { Language } from './index';

const TYPES = ['free', 'api', 'deeplx'];

export function Config(props) {
    const { instanceKey, updateServiceList, onClose } = props;
    const { t } = useTranslation();

    return (
        <ServiceConfigForm
            instanceKey={instanceKey}
            defaultConfig={{
                [INSTANCE_NAME_CONFIG_KEY]: t('services.translate.deepl.title'),
                type: 'free',
                authKey: '',
                customUrl: '',
            }}
            onTest={(config) => translate('hello', Language.auto, Language.zh_cn, { config })}
            updateServiceList={updateServiceList}
            onClose={onClose}
        >
            {(config, setConfig) => (
                <>
                    {/*
                        The free endpoint needs no credentials, so it gets no docs
                        link; the other two point at different pages.
                    */}
                    <HelpLink
                        hidden={config.type === 'free'}
                        url={
                            config.type === 'api'
                                ? 'https://pot-app.com/docs/api/translate/deepl.html'
                                : 'https://github.com/OwO-Network/DeepLX'
                        }
                    />
                    <SelectConfigField
                        label={t('services.translate.deepl.type')}
                        value={config.type}
                        options={TYPES.map((type) => ({ id: type, label: t(`services.translate.deepl.${type}`) }))}
                        onChange={(key) => setConfig({ ...config, type: key })}
                    />
                    <TextConfigField
                        hidden={config.type !== 'api'}
                        type='password'
                        label={t('services.translate.deepl.auth_key')}
                        value={config['authKey']}
                        onChange={(value) => setConfig({ ...config, authKey: value })}
                    />
                    <TextConfigField
                        hidden={config.type !== 'deeplx'}
                        label={t('services.translate.deepl.custom_url')}
                        value={config['customUrl']}
                        onChange={(value) => setConfig({ ...config, customUrl: value })}
                    />
                </>
            )}
        </ServiceConfigForm>
    );
}
