import { HelpLink, TextConfigField } from '../../../components/ServiceConfigForm/ConfigField';
import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import ServiceConfigForm from '../../../components/ServiceConfigForm';
import { useTranslation } from 'react-i18next';
import React from 'react';

import { TEST_IMAGE } from '../test_image';
import { recognize } from './index';
import { Language } from './index';

export function Config(props) {
    const { instanceKey, updateServiceList, onClose } = props;
    const { t } = useTranslation();

    return (
        <ServiceConfigForm
            instanceKey={instanceKey}
            defaultConfig={{
                [INSTANCE_NAME_CONFIG_KEY]: t('services.recognize.iflytek_ocr.title'),
                appid: '',
                apisecret: '',
                apikey: '',
            }}
            onTest={(config) => recognize(TEST_IMAGE, Language.auto, { config })}
            updateServiceList={updateServiceList}
            onClose={onClose}
        >
            {(config, setConfig) => (
                <>
                    <HelpLink url='https://pot-app.com/docs/api/recognize/iflytek.html' />
                    <TextConfigField
                        label={t('services.recognize.iflytek_ocr.appid')}
                        value={config['appid']}
                        onChange={(value) => setConfig({ ...config, appid: value })}
                    />
                    <TextConfigField
                        label={t('services.recognize.iflytek_ocr.apisecret')}
                        value={config['apisecret']}
                        onChange={(value) => setConfig({ ...config, apisecret: value })}
                    />
                    <TextConfigField
                        label={t('services.recognize.iflytek_ocr.apikey')}
                        value={config['apikey']}
                        onChange={(value) => setConfig({ ...config, apikey: value })}
                    />
                </>
            )}
        </ServiceConfigForm>
    );
}
