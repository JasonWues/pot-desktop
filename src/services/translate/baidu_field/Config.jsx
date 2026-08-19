import { HelpLink, SelectConfigField, TextConfigField } from '../../../components/ServiceConfigForm/ConfigField';
import { INSTANCE_NAME_CONFIG_KEY } from '../../../utils/service_instance';
import ServiceConfigForm from '../../../components/ServiceConfigForm';
import { useTranslation } from 'react-i18next';
import React from 'react';

import { translate } from './index';
import { Language } from './index';

const FIELD_LIST = [
    'it',
    'finance',
    'machinery',
    'senimed',
    'novel',
    'academic',
    'aerospace',
    'wiki',
    'news',
    'law',
    'contract',
];

export function Config(props) {
    const { instanceKey, updateServiceList, onClose } = props;
    const { t } = useTranslation();

    return (
        <ServiceConfigForm
            instanceKey={instanceKey}
            defaultConfig={{
                [INSTANCE_NAME_CONFIG_KEY]: t('services.translate.baidu_field.title'),
                appid: '',
                secret: '',
                field: 'it',
            }}
            onTest={(config) => translate('hello', Language.auto, Language.zh_cn, { config })}
            updateServiceList={updateServiceList}
            onClose={onClose}
        >
            {(config, setConfig) => (
                <>
                    <HelpLink url='https://pot-app.com/docs/api/translate/baidu.html' />
                    {/*
                        The heading and the credential labels are deepl's and
                        baidu's keys: this service has no strings of its own for
                        them beyond the domain names below.
                    */}
                    <SelectConfigField
                        label={t('services.translate.deepl.type')}
                        value={config.field}
                        options={FIELD_LIST.map((field) => ({
                            id: field,
                            label: t(`services.translate.baidu_field.${field}`),
                        }))}
                        onChange={(key) => setConfig({ ...config, field: key })}
                        scrollable
                    />
                    <TextConfigField
                        label={t('services.translate.baidu.appid')}
                        value={config['appid']}
                        onChange={(value) => setConfig({ ...config, appid: value })}
                    />
                    <TextConfigField
                        label={t('services.translate.baidu.secret')}
                        value={config['secret']}
                        onChange={(value) => setConfig({ ...config, secret: value })}
                    />
                </>
            )}
        </ServiceConfigForm>
    );
}
