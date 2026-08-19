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
                [INSTANCE_NAME_CONFIG_KEY]: t('services.recognize.tencent_img_ocr.title'),
                secret_id: '',
                secret_key: '',
            }}
            onTest={(config) => recognize(TEST_IMAGE, Language.auto, { config })}
            updateServiceList={updateServiceList}
            onClose={onClose}
        >
            {(config, setConfig) => (
                <>
                    <HelpLink url='https://pot-app.com/docs/api/recognize/tencent_img.html' />
                    <TextConfigField
                        label={t('services.recognize.tencent_img_ocr.secret_id')}
                        value={config['secret_id']}
                        onChange={(value) => setConfig({ ...config, secret_id: value })}
                    />
                    <TextConfigField
                        label={t('services.recognize.tencent_img_ocr.secret_key')}
                        value={config['secret_key']}
                        onChange={(value) => setConfig({ ...config, secret_key: value })}
                    />
                </>
            )}
        </ServiceConfigForm>
    );
}
