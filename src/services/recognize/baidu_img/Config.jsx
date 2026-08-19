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
                [INSTANCE_NAME_CONFIG_KEY]: t('services.recognize.baidu_img_ocr.title'),
                appid: '',
                secret: '',
            }}
            onTest={(config) => recognize(TEST_IMAGE, Language.auto, { config })}
            updateServiceList={updateServiceList}
            onClose={onClose}
        >
            {(config, setConfig) => (
                <>
                    <HelpLink url='https://pot-app.com/docs/api/recognize/baidu_img.html' />
                    <TextConfigField
                        label={t('services.recognize.baidu_img_ocr.appid')}
                        value={config['appid']}
                        onChange={(value) => setConfig({ ...config, appid: value })}
                    />
                    <TextConfigField
                        label={t('services.recognize.baidu_img_ocr.secret')}
                        value={config['secret']}
                        onChange={(value) => setConfig({ ...config, secret: value })}
                    />
                </>
            )}
        </ServiceConfigForm>
    );
}
