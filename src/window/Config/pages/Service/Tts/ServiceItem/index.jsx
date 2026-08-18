import { RxDragHandleHorizontal } from 'react-icons/rx';
import { useTranslation } from 'react-i18next';
import React from 'react';

import {
    INSTANCE_NAME_CONFIG_KEY,
    ServiceSourceType,
    getServiceName,
    getServiceSouceType,
} from '../../../../../../utils/service_instance';
import * as builtinServices from '../../../../../../services/tts';
import { osType } from '../../../../../../utils/env';
import { useConfig } from '../../../../../../hooks';

export default function ServiceItem(props) {
    const {
        serviceInstanceKey,
        pluginList,
        deleteServiceInstance,
        setCurrentConfigKey,
        onConfigOpen,
        index,
        isDragging,
        ...drag
    } = props;
    const { t } = useTranslation();

    const [serviceInstanceConfig] = useConfig(serviceInstanceKey, {});

    const serviceSourceType = getServiceSouceType(serviceInstanceKey);
    const serviceName = getServiceName(serviceInstanceKey);
    const isPlugin = serviceSourceType === ServiceSourceType.PLUGIN;

    return isPlugin && !(serviceName in pluginList) ? (
        <></>
    ) : (
        serviceInstanceConfig !== null && (
            <div
                className={`service-row ${index === 0 ? 'service-row--first' : ''} ${
                    isDragging ? 'service-row--marked' : ''
                }`}
            >
                <span className='service-row__rank'>{String(index + 1).padStart(2, '0')}</span>
                <img
                    className='service-row__logo'
                    src={
                        isPlugin
                            ? pluginList[serviceName].icon
                            : serviceName === 'system'
                              ? `logo/${osType}.svg`
                              : builtinServices[serviceName].info.icon
                    }
                    draggable={false}
                />
                <div className='service-row__body'>
                    <div className='service-row__name'>
                        {serviceInstanceConfig[INSTANCE_NAME_CONFIG_KEY] ||
                            (isPlugin ? pluginList[serviceName].display : t(`services.tts.${serviceName}.title`))}
                    </div>
                    <div className='service-row__note'>
                        {[index === 0 ? t('config.service.default') : null, isPlugin ? t('common.plugin') : null]
                            .filter(Boolean)
                            .join(' · ')}
                    </div>
                </div>
                <div className='service-row__tools'>
                    <span
                        {...drag}
                        className='service-row__grip'
                        aria-label={t('config.service.reorder')}
                    >
                        <RxDragHandleHorizontal />
                    </span>
                    <button
                        type='button'
                        className='flat-action'
                        onClick={() => {
                            setCurrentConfigKey(serviceInstanceKey);
                            onConfigOpen();
                        }}
                    >
                        {t('config.service.edit')}
                    </button>
                    <button
                        type='button'
                        className='flat-action flat-action--danger'
                        onClick={() => {
                            deleteServiceInstance(serviceInstanceKey);
                        }}
                    >
                        {t('config.service.remove')}
                    </button>
                </div>
            </div>
        )
    );
}
