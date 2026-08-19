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
                [INSTANCE_NAME_CONFIG_KEY]: t('services.recognize.baidu_accurate_ocr.title'),
                client_id: '',
                client_secret: '',
            }}
            onTest={(config) => recognize(TEST_IMAGE, Language.auto, { config })}
            updateServiceList={updateServiceList}
            onClose={onClose}
        >
            {(config, setConfig) => (
                <>
                    <HelpLink url='https://pot-app.com/docs/api/recognize/baidu.html' />
                    <TextConfigField
                        label={t('services.recognize.baidu_accurate_ocr.client_id')}
                        value={config['client_id']}
                        onChange={(value) => setConfig({ ...config, client_id: value })}
                    />
                    <TextConfigField
                        label={t('services.recognize.baidu_accurate_ocr.client_secret')}
                        value={config['client_secret']}
                        onChange={(value) => setConfig({ ...config, client_secret: value })}
                    />
                </>
            )}
        </ServiceConfigForm>
    );
}
